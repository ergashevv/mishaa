import { prisma } from '@/lib/prisma';
import { getHomeData } from '@/lib/home-data';
import { getSiteUrl } from '@/lib/site-url';
import {
  TELEGRAM_BOT_COMMANDS,
  TELEGRAM_BOT_DEFAULT_DESCRIPTION,
  TELEGRAM_BOT_DEFAULT_NAME,
  TELEGRAM_BOT_DEFAULT_SHORT_DESCRIPTION,
  TELEGRAM_CHANNEL_HANDLE,
} from '@/lib/telegram-config';

export type TelegramSlot = 'morning' | 'afternoon' | 'evening';

export type TelegramComicCandidate = {
  id: string;
  title: string;
  description: string;
  coverUrl?: string;
  href: string;
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

export function hasTelegramConfig() {
  return Boolean(getTelegramToken() && getTelegramChannelId());
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
          rating: item.rating ? String(item.rating) : undefined,
          shelf,
        }))
      : [],
  );

  return shelfEntries.filter((item) => item.id && item.title && item.href);
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

function buildTelegramCaption(comic: TelegramComicCandidate, slot: TelegramSlot) {
  const siteUrl = getSiteUrl();
  const rating = comic.rating ? `⭐ ${comic.rating}` : '⭐ N/A';
  const shelfLabel = comic.shelf.replace(/-/g, ' ').toUpperCase();
  const title = escapeHtml(shortText(comic.title, 72));
  const description = escapeHtml(shortText(comic.description, 180));

  return [
    `<b>${title}</b>`,
    `${rating} • ${escapeHtml(shelfLabel)} • ${escapeHtml(TELEGRAM_SLOT_LABELS[slot])}`,
    description,
    `<a href="${siteUrl}${comic.href}">Read on iComics.wiki</a>`,
  ].join('\n');
}

async function sendTelegramComic(slot: TelegramSlot, comic: TelegramComicCandidate) {
  const channelId = getTelegramChannelId();
  const caption = buildTelegramCaption(comic, slot);

  if (comic.coverUrl) {
    return telegramJsonRequest<{ result: { message_id: number } }>('sendPhoto', {
      chat_id: channelId,
      photo: comic.coverUrl,
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

export async function postTelegramComicForSlot(slot: TelegramSlot): Promise<TelegramPostResult> {
  if (!hasTelegramConfig()) {
    throw new Error('Telegram configuration is incomplete');
  }

  const slotKey = getSlotKey(slot);
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
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
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
