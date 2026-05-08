#!/usr/bin/env node

// Automated Vitest twin: npm run test:integration (same routes + stronger assertions).
const defaultBaseUrl = process.env.SITE_URL || process.env.NEXT_PUBLIC_SITE_URL || 'https://icomics.wiki';
const rawBaseArg = process.argv[2] || defaultBaseUrl;
const baseUrl = rawBaseArg.startsWith('http://') || rawBaseArg.startsWith('https://')
  ? rawBaseArg.replace(/\/$/, '')
  : `https://${rawBaseArg.replace(/\/$/, '')}`;

const cookieHeader = 'age_verified=true';

const headers = {
  accept: 'application/json',
  cookie: cookieHeader,
};

function buildUrl(path) {
  return new URL(path, baseUrl).toString();
}

async function fetchJson(path, label, init = {}) {
  const response = await fetch(buildUrl(path), {
    ...init,
    headers: {
      ...headers,
      ...(init.headers || {}),
    },
  });

  const text = await response.text();
  let data;

  try {
    data = JSON.parse(text);
  } catch {
    throw new Error(`${label}: non-JSON response (${response.status}) ${text.slice(0, 160)}`);
  }

  if (!response.ok) {
    throw new Error(`${label}: HTTP ${response.status} ${JSON.stringify(data).slice(0, 160)}`);
  }

  return data;
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function run() {
  console.log(`Smoke testing ${baseUrl}`);

  const home = await fetchJson('/api/home/data?lang=en', 'home data');
  const shelves = home?.shelves;
  assert(shelves && typeof shelves === 'object', 'home data: missing shelves object');
  assert(Array.isArray(shelves.trending), 'home data: trending shelf missing');
  assert(Array.isArray(shelves['manga-hub']), 'home data: manga-hub shelf missing');
  assert(shelves.trending.length > 0, 'home data: trending shelf empty');
  assert(shelves['manga-hub'].length > 0, 'home data: manga-hub shelf empty');
  console.log(`home data ok: trending=${shelves.trending.length}, manga-hub=${shelves['manga-hub'].length}`);

  const mangaDex = await fetchJson('/api/proxy/mangadex?path=' + encodeURIComponent('manga?limit=1&offset=0&includes[]=cover_art&order[followedCount]=desc'), 'mangadex proxy');
  assert(Array.isArray(mangaDex.data), 'mangadex proxy: missing data array');
  assert(mangaDex.data.length > 0, 'mangadex proxy: empty result');
  console.log(`mangadex proxy ok: ${mangaDex.data.length} item(s)`);

  const nhentai = await fetchJson('/api/proxy/nhentai?path=' + encodeURIComponent('v2/search?query=%20&page=1'), 'nhentai proxy');
  const nhentaiResults = Array.isArray(nhentai?.result) ? nhentai.result : Array.isArray(nhentai) ? nhentai : [];
  assert(nhentaiResults.length > 0, 'nhentai proxy: empty result');
  console.log(`nhentai proxy ok: ${nhentaiResults.length} item(s)`);

  const nhentaiPageResponse = await fetch(buildUrl('/library/nhentai/648185'), {
    headers: {
      accept: 'text/html',
    },
  });
  const nhentaiPageHtml = await nhentaiPageResponse.text();
  assert(nhentaiPageResponse.ok, `nhentai page: HTTP ${nhentaiPageResponse.status}`);
  assert(
    nhentaiPageHtml.includes('/api/proxy/nhentai/image?path=galleries/3911833/2.webp'),
    'nhentai page: missing expected gallery image URL'
  );
  console.log('nhentai page ok: gallery image URL rendered');

  const nhentaiImageResponse = await fetch(
    buildUrl('/api/proxy/nhentai/image?path=' + encodeURIComponent('galleries/3911833/2.webp')),
    {
      headers: {
        cookie: cookieHeader,
        referer: buildUrl('/library/nhentai/648185'),
      },
    }
  );
  assert(nhentaiImageResponse.ok, `nhentai image: HTTP ${nhentaiImageResponse.status}`);
  assert(
    (nhentaiImageResponse.headers.get('content-type') || '').startsWith('image/'),
    `nhentai image: unexpected content-type ${nhentaiImageResponse.headers.get('content-type') || 'missing'}`
  );
  console.log('nhentai image ok: 200 image response');

  console.log('Smoke test passed');
}

run().catch((error) => {
  console.error(String(error?.message || error));
  process.exit(1);
});
