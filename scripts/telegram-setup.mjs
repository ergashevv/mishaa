import { File as NodeFile } from 'node:buffer';

const token = process.env.TELEGRAM_BOT_TOKEN;

if (!token) {
  console.error('TELEGRAM_BOT_TOKEN is missing.');
  process.exit(1);
}

const botName = process.env.TELEGRAM_BOT_NAME || 'iComics Wiki Bot';
const shortDescription = process.env.TELEGRAM_BOT_SHORT_DESCRIPTION || 'Official iComics.wiki channel curator for featured comic drops.';
const description = process.env.TELEGRAM_BOT_DESCRIPTION || 'Official iComics.wiki Telegram curator. Shares featured comic drops three times a day and links back to the site.';
const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || 'https://icomics.wiki').replace(/\/$/, '');
const botApiBase = `https://api.telegram.org/bot${token}`;

async function telegramJson(method, payload) {
  const response = await fetch(`${botApiBase}/${method}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  const data = await response.json().catch(() => null);
  if (!response.ok || !data?.ok) {
    throw new Error(data?.description || `${method} failed`);
  }
  return data;
}

async function telegramMultipart(method, form) {
  const response = await fetch(`${botApiBase}/${method}`, {
    method: 'POST',
    body: form,
  });

  const data = await response.json().catch(() => null);
  if (!response.ok || !data?.ok) {
    throw new Error(data?.description || `${method} failed`);
  }
  return data;
}

try {
  await telegramJson('setMyName', { name: botName });
  await telegramJson('setMyShortDescription', { short_description: shortDescription });
  await telegramJson('setMyDescription', { description });
  await telegramJson('setMyCommands', {
    commands: [
      { command: 'start', description: 'Show what this bot does' },
      { command: 'featured', description: 'Share a featured comic now' },
      { command: 'about', description: 'Show bot information' },
    ],
  });

  const photoUrl = process.env.TELEGRAM_BOT_PHOTO_URL || `${siteUrl}/logo.png`;
  const photoResponse = await fetch(photoUrl);
  if (photoResponse.ok) {
    const mimeType = photoResponse.headers.get('content-type') || 'image/png';
    const extension = mimeType.includes('jpeg') ? 'jpg' : mimeType.includes('png') ? 'png' : 'jpg';
    const buffer = await photoResponse.arrayBuffer();
    const form = new FormData();
    form.set('photo', JSON.stringify({ type: 'static', photo: 'attach://profile_photo' }));
    form.set('profile_photo', new NodeFile([buffer], `telegram-bot.${extension}`, { type: mimeType }));
    await telegramMultipart('setMyProfilePhoto', form);
  }

  console.log('Telegram bot profile updated successfully.');
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
