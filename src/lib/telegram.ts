import { randomBytes } from 'node:crypto';
import { prisma } from '@/lib/prisma';
import { getHomeData } from '@/lib/home-data';
import { getPublicSiteUrl, preferSocialPreviewCover, toAbsoluteAssetUrl } from '@/lib/og-metadata';
import { resolveTelegramComicReadUrl as buildTelegramComicReadUrl } from '@/lib/telegram-read-url';
import { getSiteUrl } from '@/lib/site-url';
import {
  TELEGRAM_BOT_COMMANDS,
  TELEGRAM_BOT_DEFAULT_DESCRIPTION,
  TELEGRAM_BOT_DEFAULT_NAME,
  TELEGRAM_BOT_DEFAULT_SHORT_DESCRIPTION,
  TELEGRAM_CHANNEL_HANDLE,
  TELEGRAM_CHANNEL_URL,
} from '@/lib/telegram-config';

export type TelegramSlot = 'morning' | 'afternoon' | 'evening';

export type TelegramComicCandidate = {
  id: string;
  title: string;
  description: string;
  coverUrl?: string;
  href: string;
  /** Home feed source when present (mangadex / nhentai). */
  source?: string;
  rating?: string;
  shelf: string;
};

export type TelegramPostResult = {
  skipped: boolean;
  slotKey: string;
  slot: TelegramSlot;
  comic?: TelegramComicCandidate;
  messageId?: number;
};

const TELEGRAM_API_BASE = 'https://api.telegram.org/bot';

const TELEGRAM_SLOT_LABELS: Record<TelegramSlot, string> = {
  morning: 'Morning Feature',
  afternoon: 'Afternoon Feature',
  evening: 'Evening Feature',
};

const TELEGRAM_SLOT_HOURS_UTC: Record<TelegramSlot, number> = {
  morning: 3,
  afternoon: 9,
  evening: 15,
};

const safeEnv = (value: string | undefined, fallback = '') => (value?.trim() || fallback);

export const getTelegramToken = () => safeEnv(process.env.TELEGRAM_BOT_TOKEN);
export const getTelegramChannelId = () =>
  safeEnv(process.env.TELEGRAM_CHANNEL_ID, TELEGRAM_CHANNEL_HANDLE);
export const getTelegramBotName = () =>
  safeEnv(process.env.TELEGRAM_BOT_NAME, TELEGRAM_BOT_DEFAULT_NAME);
export const getTelegramBotShortDescription = () =>
  safeEnv(process.env.TELEGRAM_BOT_SHORT_DESCRIPTION, TELEGRAM_BOT_DEFAULT_SHORT_DESCRIPTION);
export const getTelegramBotDescription = () =>
  safeEnv(process.env.TELEGRAM_BOT_DESCRIPTION, TELEGRAM_BOT_DEFAULT_DESCRIPTION);
export const getTelegramWebhookSecret = () =>
  safeEnv(process.env.TELEGRAM_WEBHOOK_SECRET, process.env.TELEGRAM_SETUP_SECRET);

export function hasTelegramConfig() {
  return Boolean(getTelegramToken() && getTelegramChannelId());
}

/** For debugging: whether TELEGRAM_CHANNEL_ID was set (vs fallback @handle). */
export function isTelegramChannelIdFromEnv(): boolean {
  return Boolean(process.env.TELEGRAM_CHANNEL_ID?.trim());
}

export function getTelegramOutboundDiagnostics(): {
  hasBotToken: boolean;
  channelTarget: string;
  channelIdSetInEnv: boolean;
} {
  return {
    hasBotToken: Boolean(getTelegramToken()),
    channelTarget: getTelegramChannelId(),
    channelIdSetInEnv: isTelegramChannelIdFromEnv(),
  };
}

function assertTelegramConfig() {
  const token = getTelegramToken();
  const channelId = getTelegramChannelId();
  if (!token) throw new Error('TELEGRAM_BOT_TOKEN is missing');
  if (!channelId) throw new Error('TELEGRAM_CHANNEL_ID is missing');
  return { token, channelId };
}

function telegramApiUrl(token: string, method: string) {
  return `${TELEGRAM_API_BASE}${token}/${method}`;
}

async function telegramJsonRequest<T>(
  method: string,
  body: Record<string, unknown>,
): Promise<T> {
  const { token } = assertTelegramConfig();
  const response = await fetch(telegramApiUrl(token, method), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
    cache: 'no-store',
  });

  const data = await response.json().catch(() => null);
  if (!response.ok || !data?.ok) {
    throw new Error(data?.description || `Telegram ${method} failed`);
  }
  return data as T;
}

async function telegramMultipartRequest<T>(
  method: string,
  form: FormData,
): Promise<T> {
  const { token } = assertTelegramConfig();
  const response = await fetch(telegramApiUrl(token, method), {
    method: 'POST',
    body: form,
    cache: 'no-store',
  });

  const data = await response.json().catch(() => null);
  if (!response.ok || !data?.ok) {
    throw new Error(data?.description || `Telegram ${method} failed`);
  }
  return data as T;
}

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function shortText(value: string, maxLength: number) {
  const compact = value.replace(/\s+/g, ' ').trim();
  if (compact.length <= maxLength) return compact;
  return `${compact.slice(0, maxLength - 1).trimEnd()}…`;
}

function resolveTelegramComicReadUrl(comic: TelegramComicCandidate): string {
  const origin = getPublicSiteUrl().replace(/\/$/, '');
  return buildTelegramComicReadUrl(origin, comic);
}

/** Telegram `sendPhoto` needs a public absolute URL; home feed often uses `/api/proxy/...` paths. */
function telegramPhotoUrlForSend(coverUrl: string | undefined): string | undefined {
  if (!coverUrl?.trim()) return undefined;
  const site = getPublicSiteUrl().replace(/\/$/, '');
  const absolute = toAbsoluteAssetUrl(coverUrl, site);
  return preferSocialPreviewCover(absolute, site);
}

function extractTelegramCommand(text?: string | null) {
  if (!text) return null;
  const [firstToken] = text.trim().split(/\s+/);
  if (!firstToken?.startsWith('/')) return null;
  return firstToken.slice(1).split('@')[0]?.toLowerCase() || null;
}

function seededValue(seed: string) {
  let hash = 0;
  for (let index = 0; index < seed.length; index += 1) {
    hash = ((hash << 5) - hash + seed.charCodeAt(index)) | 0;
  }
  return Math.abs(hash);
}

function getSlotKey(slot: TelegramSlot, now = new Date()) {
  const isoDay = now.toISOString().slice(0, 10);
  return `${isoDay}:${slot}`;
}

function getSlotWindowLabel(slot: TelegramSlot) {
  const hour = TELEGRAM_SLOT_HOURS_UTC[slot];
  return `${String(hour).padStart(2, '0')}:00 UTC`;
}

export async function getTelegramComicCandidates() {
  const homeData = await getHomeData('en', { includeAdultContent: false });
  const shelfEntries = Object.entries(homeData).flatMap(([shelf, items]) =>
    Array.isArray(items)
      ? items.map((item: Record<string, unknown>) => ({
          id: String(item.id || ''),
          title: String(item.title || 'Untitled'),
          description: String(item.description || 'Featured comic pick'),
          coverUrl: item.coverUrl ? String(item.coverUrl) : undefined,
          href: String(item.href || '/library'),
          source: item.source ? String(item.source) : undefined,
          rating: item.rating ? String(item.rating) : undefined,
          shelf,
        }))
      : [],
  );

  return shelfEntries.filter((item) => item.id && item.title);
}

export function pickTelegramComic(slot: TelegramSlot, candidates: TelegramComicCandidate[]) {
  if (!candidates.length) return null;

  const now = new Date();
  const seed = `${getSlotKey(slot, now)}:${TELEGRAM_SLOT_HOURS_UTC[slot]}`;
  const hash = seededValue(seed);
  const ordered = [...candidates].sort((left, right) => {
    const leftWeight = Number.parseFloat(left.rating || '0') || 0;
    const rightWeight = Number.parseFloat(right.rating || '0') || 0;
    return rightWeight - leftWeight;
  });

  const weights = ordered.map((comic) => {
    const rating = Number.parseFloat(comic.rating || '0');
    return Number.isFinite(rating) && rating > 0 ? rating : 1;
  });
  const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
  let cursor = hash % Math.max(1, Math.floor(totalWeight * 1000));

  for (let index = 0; index < ordered.length; index += 1) {
    const weight = Math.max(1, Math.floor(weights[index] * 1000));
    if (cursor < weight) return ordered[index];
    cursor -= weight;
  }

  return ordered[hash % ordered.length] || ordered[0];
}

/** Bot /featured: uniform pick so one day / rating weighting does not repeat the same title every time. */
function pickTelegramFeatureComic(candidates: TelegramComicCandidate[]): TelegramComicCandidate | null {
  if (!candidates.length) return null;
  const n = randomBytes(4).readUInt32BE(0);
  return candidates[n % candidates.length] ?? candidates[0];
}

function buildTelegramCaptionLines(comic: TelegramComicCandidate, featureLabel: string) {
  const readUrl = resolveTelegramComicReadUrl(comic);
  const rating = comic.rating ? `⭐ ${comic.rating}` : '⭐ N/A';
  const shelfLabel = comic.shelf.replace(/-/g, ' ').toUpperCase();
  const title = escapeHtml(shortText(comic.title, 72));
  const description = escapeHtml(shortText(comic.description, 180));

  return [
    `<b>${title}</b>`,
    `${rating} • ${escapeHtml(shelfLabel)} • ${escapeHtml(featureLabel)}`,
    description,
    `<a href="${escapeHtml(readUrl)}">Read on iComics.wiki</a>`,
  ].join('\n');
}

function buildTelegramCaption(comic: TelegramComicCandidate, slot: TelegramSlot) {
  return buildTelegramCaptionLines(comic, TELEGRAM_SLOT_LABELS[slot]);
}

async function sendTelegramComicWithFeatureLabel(comic: TelegramComicCandidate, featureLabel: string) {
  const channelId = getTelegramChannelId();
  const caption = buildTelegramCaptionLines(comic, featureLabel);
  const photoUrl = telegramPhotoUrlForSend(comic.coverUrl);

  if (photoUrl) {
    return telegramJsonRequest<{ result: { message_id: number } }>('sendPhoto', {
      chat_id: channelId,
      photo: photoUrl,
      caption,
      parse_mode: 'HTML',
      disable_web_page_preview: false,
    });
  }

  return telegramJsonRequest<{ result: { message_id: number } }>('sendMessage', {
    chat_id: channelId,
    text: caption,
    parse_mode: 'HTML',
    disable_web_page_preview: false,
  });
}

async function sendTelegramComic(slot: TelegramSlot, comic: TelegramComicCandidate) {
  const channelId = getTelegramChannelId();
  const caption = buildTelegramCaption(comic, slot);
  const photoUrl = telegramPhotoUrlForSend(comic.coverUrl);

  if (photoUrl) {
    return telegramJsonRequest<{ result: { message_id: number } }>('sendPhoto', {
      chat_id: channelId,
      photo: photoUrl,
      caption,
      parse_mode: 'HTML',
      disable_web_page_preview: false,
    });
  }

  return telegramJsonRequest<{ result: { message_id: number } }>('sendMessage', {
    chat_id: channelId,
    text: caption,
    parse_mode: 'HTML',
    disable_web_page_preview: false,
  });
}

async function sendTelegramChatMessage(
  chatId: string | number,
  text: string,
  replyToMessageId?: number,
) {
  return telegramJsonRequest<{ result: { message_id: number } }>('sendMessage', {
    chat_id: chatId,
    text,
    parse_mode: 'HTML',
    disable_web_page_preview: false,
    ...(replyToMessageId ? { reply_to_message_id: replyToMessageId } : {}),
  });
}

async function sendTelegramChatComic(
  chatId: string | number,
  comic: TelegramComicCandidate,
  slot: TelegramSlot,
  replyToMessageId?: number,
) {
  const caption = buildTelegramCaption(comic, slot);
  const photoUrl = telegramPhotoUrlForSend(comic.coverUrl);

  if (photoUrl) {
    return telegramJsonRequest<{ result: { message_id: number } }>('sendPhoto', {
      chat_id: chatId,
      photo: photoUrl,
      caption,
      parse_mode: 'HTML',
      disable_web_page_preview: false,
      ...(replyToMessageId ? { reply_to_message_id: replyToMessageId } : {}),
    });
  }

  return sendTelegramChatMessage(chatId, caption, replyToMessageId);
}

function buildTelegramStartMessage() {
  return [
    `<b>${escapeHtml(getTelegramBotName())}</b>`,
    'Ishlaydigan buyruqlar:',
    '/start - bot haqida qisqacha',
    '/featured - tasodifiy featured comic',
    '/about - kanal va bot haqida',
    '',
    `Kanal: <a href="${TELEGRAM_CHANNEL_URL}">${escapeHtml(TELEGRAM_CHANNEL_URL)}</a>`,
  ].join('\n');
}

function buildTelegramAboutMessage() {
  return [
    `<b>${escapeHtml(getTelegramBotName())}</b>`,
    'IComics wiki uchun featured comic curator.',
    'Kanalga kuniga 3 marta post tashlaydi va chatda asosiy buyruqlarga javob beradi.',
    '',
    `Kanal: <a href="${TELEGRAM_CHANNEL_URL}">${escapeHtml(TELEGRAM_CHANNEL_URL)}</a>`,
  ].join('\n');
}

export async function setTelegramWebhook() {
  const siteUrl = getSiteUrl();
  if (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(siteUrl)) {
    throw new Error('Telegram webhook needs a public HTTPS URL');
  }

  const webhookSecret = getTelegramWebhookSecret();
  const payload: Record<string, unknown> = {
    url: `${siteUrl}/api/telegram/webhook`,
    allowed_updates: ['message'],
  };

  if (webhookSecret) {
    payload.secret_token = webhookSecret;
  }

  await telegramJsonRequest('setWebhook', payload);
  return {
    url: `${siteUrl}/api/telegram/webhook`,
    secretConfigured: Boolean(webhookSecret),
  };
}

type TelegramUpdateMessage = {
  message_id?: number;
  chat?: { id?: number | string };
  text?: string;
};

type TelegramUpdate = {
  message?: TelegramUpdateMessage;
  edited_message?: TelegramUpdateMessage;
};

export async function handleTelegramUpdate(update: TelegramUpdate) {
  const message = update.message || update.edited_message;
  if (!message?.chat?.id) {
    return { ok: true, ignored: true };
  }

  const command = extractTelegramCommand(message.text);
  if (!command) {
    return { ok: true, ignored: true };
  }

  const chatId = message.chat.id;
  const replyToMessageId = message.message_id;

  if (command === 'start') {
    await sendTelegramChatMessage(chatId, buildTelegramStartMessage(), replyToMessageId);
    return { ok: true, command };
  }

  if (command === 'about') {
    await sendTelegramChatMessage(chatId, buildTelegramAboutMessage(), replyToMessageId);
    return { ok: true, command };
  }

  if (command === 'featured') {
    const candidates = await getTelegramComicCandidates();
    const comic = pickTelegramFeatureComic(candidates);

    if (!comic) {
      await sendTelegramChatMessage(
        chatId,
        'Hozircha featured comic topilmadi. Birozdan keyin qayta urinib ko‘ring.',
        replyToMessageId,
      );
      return { ok: true, command, featured: false };
    }

    await sendTelegramChatComic(chatId, comic, 'morning', replyToMessageId);
    return { ok: true, command, featured: true };
  }

  return { ok: true, ignored: true };
}

const TELEGRAM_CAMPAIGN_ID = 'singleton';
const MS_HOUR = 60 * 60 * 1000;

export async function isTelegramIntensiveCampaignActive(): Promise<boolean> {
  const row = await prisma.telegramCampaignState.findUnique({
    where: { id: TELEGRAM_CAMPAIGN_ID },
  });
  if (!row?.intensiveEndsAt) return false;
  return row.intensiveEndsAt.getTime() > Date.now();
}

function shuffleInPlace<T>(items: T[]): T[] {
  const a = items;
  for (let i = a.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function dedupeTelegramCandidates(list: TelegramComicCandidate[]): TelegramComicCandidate[] {
  const seen = new Set<string>();
  return list.filter((c) => {
    const key = `${c.shelf}:${c.id}:${c.href}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export type StartTelegramIntensiveCampaignOptions = {
  poolSize?: number;
  postsInWeek?: number;
  hoursBetweenPosts?: number;
  intensiveDays?: number;
  dryRun?: boolean;
};

/** Shuffled pool → post #1 now (no rating re-sort, so kickoff is not always the same #1 title), queue the rest every `hoursBetweenPosts` until `postsInWeek` total. Sets intensive window so slot crons pause. */
export async function startTelegramIntensiveCampaign(
  options: StartTelegramIntensiveCampaignOptions = {},
): Promise<{
  ok: boolean;
  dryRun: boolean;
  totalInWeek: number;
  queued: number;
  firstTitle?: string;
  error?: string;
}> {
  const poolSize = options.poolSize ?? 100;
  const postsInWeek = options.postsInWeek ?? 84;
  const hoursBetween = options.hoursBetweenPosts ?? 2;
  const intensiveDays = options.intensiveDays ?? 7;
  const dryRun = options.dryRun ?? false;

  if (!hasTelegramConfig()) {
    return { ok: false, dryRun, totalInWeek: 0, queued: 0, error: 'Telegram not configured' };
  }

  try {
    const raw = dedupeTelegramCandidates(await getTelegramComicCandidates());
    shuffleInPlace(raw);
    const pool = raw.slice(0, Math.min(poolSize, raw.length));

    const totalInWeek = Math.min(postsInWeek, pool.length);
    if (totalInWeek < 1) {
      return { ok: false, dryRun, totalInWeek: 0, queued: 0, error: 'No comic candidates' };
    }

    const selected = pool.slice(0, totalInWeek);
    const intensiveEndsAt = new Date(Date.now() + intensiveDays * 24 * MS_HOUR);

    if (dryRun) {
      return {
        ok: true,
        dryRun: true,
        totalInWeek,
        queued: totalInWeek - 1,
        firstTitle: selected[0]?.title,
      };
    }

    await prisma.telegramScheduledPost.deleteMany({ where: { status: 'pending' } });

    await prisma.telegramCampaignState.upsert({
      where: { id: TELEGRAM_CAMPAIGN_ID },
      create: { id: TELEGRAM_CAMPAIGN_ID, intensiveEndsAt },
      update: { intensiveEndsAt },
    });

    await sendTelegramComicWithFeatureLabel(selected[0], `Campaign kickoff · 1/${totalInWeek}`);

    const rest = selected.slice(1);
    if (rest.length > 0) {
      const intervalMs = hoursBetween * MS_HOUR;
      const base = Date.now();
      await prisma.telegramScheduledPost.createMany({
        data: rest.map((comic, index) => ({
          scheduledAt: new Date(base + (index + 1) * intervalMs),
          orderIndex: index + 1,
          featureLabel: `2h campaign · ${index + 2}/${totalInWeek}`,
          comicPayload: JSON.parse(JSON.stringify(comic)) as object,
        })),
      });
    }

    return {
      ok: true,
      dryRun: false,
      totalInWeek,
      queued: rest.length,
      firstTitle: selected[0]?.title,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Campaign start failed';
    return { ok: false, dryRun, totalInWeek: 0, queued: 0, error: message };
  }
}

export type TelegramTestPostResult =
  | {
      ok: true;
      messageId: number;
      title: string;
      channelTarget: string;
      channelIdFromEnv: boolean;
    }
  | {
      ok: false;
      error: string;
      channelTarget?: string;
      channelIdFromEnv?: boolean;
    };

/** Single channel post for manual checks (caption shows 🔧 Test post). */
export async function sendTelegramChannelTestPost(): Promise<TelegramTestPostResult> {
  const channelTarget = getTelegramChannelId();
  const channelIdFromEnv = isTelegramChannelIdFromEnv();

  if (!hasTelegramConfig()) {
    return {
      ok: false,
      error: 'TELEGRAM_BOT_TOKEN missing or empty',
      channelTarget,
      channelIdFromEnv,
    };
  }

  let candidates: TelegramComicCandidate[];
  try {
    candidates = await getTelegramComicCandidates();
  } catch (error) {
    const message = error instanceof Error ? error.message : 'getTelegramComicCandidates failed';
    return { ok: false, error: message, channelTarget, channelIdFromEnv };
  }

  const comic = pickTelegramFeatureComic(candidates);
  if (!comic) {
    return {
      ok: false,
      error: 'No comic candidates from home data',
      channelTarget,
      channelIdFromEnv,
    };
  }

  try {
    const result = await sendTelegramComicWithFeatureLabel(comic, '🔧 Test post');
    return {
      ok: true,
      messageId: result.result.message_id,
      title: comic.title,
      channelTarget,
      channelIdFromEnv,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Telegram send failed';
    return { ok: false, error: message, channelTarget, channelIdFromEnv };
  }
}

export async function processTelegramScheduledQueue(): Promise<{
  ok: boolean;
  sent: boolean;
  cancelledPending?: number;
  comicTitle?: string;
  error?: string;
}> {
  if (!hasTelegramConfig()) {
    return { ok: false, sent: false, error: 'Telegram not configured' };
  }

  const state = await prisma.telegramCampaignState.findUnique({
    where: { id: TELEGRAM_CAMPAIGN_ID },
  });
  const now = new Date();

  if (state?.intensiveEndsAt && state.intensiveEndsAt.getTime() <= now.getTime()) {
    const cancel = await prisma.telegramScheduledPost.updateMany({
      where: { status: 'pending' },
      data: { status: 'cancelled' },
    });
    await prisma.telegramCampaignState.update({
      where: { id: TELEGRAM_CAMPAIGN_ID },
      data: { intensiveEndsAt: null },
    });
    return { ok: true, sent: false, cancelledPending: cancel.count };
  }

  if (!state?.intensiveEndsAt) {
    return { ok: true, sent: false };
  }

  const next = await prisma.telegramScheduledPost.findFirst({
    where: { status: 'pending', scheduledAt: { lte: now } },
    orderBy: [{ scheduledAt: 'asc' }, { orderIndex: 'asc' }],
  });

  if (!next) {
    const pendingLeft = await prisma.telegramScheduledPost.count({ where: { status: 'pending' } });
    if (pendingLeft === 0) {
      await prisma.telegramCampaignState.update({
        where: { id: TELEGRAM_CAMPAIGN_ID },
        data: { intensiveEndsAt: null },
      });
    }
    return { ok: true, sent: false };
  }

  const comic = next.comicPayload as unknown as TelegramComicCandidate;

  try {
    const result = await sendTelegramComicWithFeatureLabel(comic, next.featureLabel);
    const messageId = result.result.message_id;
    await prisma.telegramScheduledPost.update({
      where: { id: next.id },
      data: {
        status: 'sent',
        sentAt: new Date(),
        telegramMessageId: messageId,
        error: null,
      },
    });
    return { ok: true, sent: true, comicTitle: comic.title };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Queue send failed';
    await prisma.telegramScheduledPost.update({
      where: { id: next.id },
      data: { status: 'failed', error: message },
    });
    return { ok: false, sent: false, error: message };
  }
}

export async function runTelegramQueueCron(request: Request) {
  const secret = process.env.CRON_SECRET?.trim();
  const auth = request.headers.get('authorization')?.trim();
  if (!secret || auth !== `Bearer ${secret}`) {
    return new Response('Unauthorized', { status: 401 });
  }

  const result = await processTelegramScheduledQueue();
  return Response.json({
    ok: result.ok,
    sent: result.sent,
    cancelledPending: result.cancelledPending ?? null,
    comicTitle: result.comicTitle ?? null,
    error: result.error ?? null,
  });
}

export async function postTelegramComicForSlot(slot: TelegramSlot): Promise<TelegramPostResult> {
  if (!hasTelegramConfig()) {
    throw new Error('Telegram configuration is incomplete');
  }

  const slotKey = getSlotKey(slot);
  if (await isTelegramIntensiveCampaignActive()) {
    return { skipped: true, slotKey, slot };
  }

  const existing = await prisma.telegramPostLog.findUnique({ where: { slotKey } });
  if (existing?.status === 'posted' || existing?.status === 'sending') {
    return { skipped: true, slotKey, slot };
  }

  const candidates = await getTelegramComicCandidates();
  const comic = pickTelegramComic(slot, candidates);
  if (!comic) {
    await prisma.telegramPostLog.upsert({
      where: { slotKey },
      create: {
        slotKey,
        slotName: slot,
        comicId: '',
        comicSource: 'unknown',
        comicTitle: 'No comic available',
        comicUrl: '',
        status: 'failed',
        error: 'No comic candidates were available',
      },
      update: {
        status: 'failed',
        error: 'No comic candidates were available',
      },
    });
    return { skipped: true, slotKey, slot };
  }

  try {
    await prisma.telegramPostLog.create({
      data: {
        slotKey,
        slotName: slot,
        comicId: comic.id,
        comicSource: comic.shelf,
        comicTitle: comic.title,
        comicUrl: comic.href,
        comicRating: comic.rating || null,
        status: 'sending',
      },
    });
  } catch (error) {
    const code = error && typeof error === 'object' ? (error as { code?: string }).code : undefined;
    if (code === 'P2002') {
      return { skipped: true, slotKey, slot };
    }
    throw error;
  }

  try {
    const result = await sendTelegramComic(slot, comic);
    const messageId = result.result.message_id;

    await prisma.telegramPostLog.update({
      where: { slotKey },
      data: {
        status: 'posted',
        sentAt: new Date(),
        telegramMessageId: messageId,
        error: null,
      },
    });

    return {
      skipped: false,
      slotKey,
      slot,
      comic,
      messageId,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown Telegram error';
    await prisma.telegramPostLog.update({
      where: { slotKey },
      data: {
        status: 'failed',
        error: message,
      },
    });
    throw error;
  }
}

export async function setTelegramBotProfile() {
  if (!getTelegramToken()) {
    throw new Error('TELEGRAM_BOT_TOKEN is missing');
  }

  await telegramJsonRequest('setMyName', {
    name: getTelegramBotName(),
  });

  await telegramJsonRequest('setMyShortDescription', {
    short_description: getTelegramBotShortDescription(),
  });

  await telegramJsonRequest('setMyDescription', {
    description: getTelegramBotDescription(),
  });

  await telegramJsonRequest('setMyCommands', {
    commands: TELEGRAM_BOT_COMMANDS,
  });

  const photoUrl = process.env.TELEGRAM_BOT_PHOTO_URL || `${getSiteUrl()}/logo.png`;
  const photoResponse = await fetch(photoUrl, { cache: 'no-store' });
  if (photoResponse.ok) {
    const arrayBuffer = await photoResponse.arrayBuffer();
    const mimeType = photoResponse.headers.get('content-type') || 'image/png';
    const extension = mimeType.includes('jpeg') ? 'jpg' : mimeType.includes('png') ? 'png' : 'jpg';
    const fileName = `telegram-bot.${extension}`;
    const file = new File([arrayBuffer], fileName, { type: mimeType });
    const form = new FormData();
    form.set(
      'photo',
      JSON.stringify({
        type: 'static',
        photo: 'attach://profile_photo',
      }),
    );
    form.set('profile_photo', file, fileName);

    await telegramMultipartRequest('setMyProfilePhoto', form);
  }

  return {
    name: getTelegramBotName(),
    shortDescription: getTelegramBotShortDescription(),
    description: getTelegramBotDescription(),
    commands: TELEGRAM_BOT_COMMANDS,
  };
}

export async function runTelegramCron(request: Request, slot: TelegramSlot) {
  const secret = process.env.CRON_SECRET?.trim();
  const auth = request.headers.get('authorization')?.trim();
  if (!secret || auth !== `Bearer ${secret}`) {
    return new Response('Unauthorized', { status: 401 });
  }

  try {
    const result = await postTelegramComicForSlot(slot);
    return Response.json({
      ok: true,
      slot,
      slotKey: result.slotKey,
      skipped: result.skipped,
      comic: result.comic
        ? {
            id: result.comic.id,
            title: result.comic.title,
            rating: result.comic.rating,
            shelf: result.comic.shelf,
          }
        : null,
      messageId: result.messageId || null,
      runAtUtc: getSlotWindowLabel(slot),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown Telegram cron error';
    return Response.json({ ok: false, error: message }, { status: 500 });
  }
}
