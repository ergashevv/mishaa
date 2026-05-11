# Loyihada ishlatiladigan API va tashqi manbalar

Ushbu hujjat `icomics.wiki` kod bazasidagi **Server Actions**, **route handler** (`src/app/api/**`) va kutubxonalar orqali **tashqi HTTP API** lar va qisman **faqat URL (brauzer / UI)** chiqadigan xizmatlarni qisqacha sanab chiqadi.

## 1. Manhva va meta-ma’lumot

| Manba | Asosiy URL | Qo‘llanishi |
| ----- | ----------- | ----------- |
| **MangaDex** | `https://api.mangadex.org/` | Kartalar, manga tafsiloti, boblar (`at-home/server`), `/manga/random`, **`/statistics/manga/{uuid}`**, **`/manga/{uuid}/aggregate`**, `/manga/.../feed` (`includes[]=scanlation_group`). Qisman `fetch` bilan to‘g‘ridan-to‘g‘ri, qisman **`/api/proxy/mangadex`** (proxy: `manga/**`, `at-home/server/**`, `statistics/manga/{uuid}`). |
| | `https://uploads.mangadex.org/` | Muqova rasmlari. |
| **AniList** | `https://graphql.anilist.co` | Manga aniqligi, trending, tavsiyalar (`fetchAniListManga`), **`/api/proxy/anilist`**, **`/api/recommendations`**, **`/api/home/data`**. |
| **Jikan (MAL)** | `https://api.jikan.moe/v4` | `fetchJikanManga` (`src/lib/jikan.ts`) — boyitish uchun. |

## 2. Komiks / superhero / Marvel

| Manba | Asosiy URL | Qo‘llanishi |
| ----- | ----------- | ----------- |
| **Superhero API** | `https://superheroapi.com/api/{token}/...` | `getComicDetails` / qidiruv (server actions), **`/api/superhero/*`**. Token: `SUPERHERO_API_TOKEN`. Eslatma: ba’zi route larda fallback token yozuvlari mavjud — prod uchun faqat env ishlating. |
| **Marvel (umumiy JSON API)** | `https://marvel.emreparker.com/v1` | `MARVEL_PUBLIC_API_BASE` — seriya, soniyalar qidiruv, shelf. |
| **RapidAPI (Marvel personajlar)** | `https://marvelstefan-skliarovv1.p.rapidapi.com/` | **`/api/marvel/characters`** — Character Forge uchun. `RAPIDAPI_KEY`, host: `marvelstefan-skliarovv1.p.rapidapi.com`. |

## 3. Katta yosh kontenti va illyustratsiya kutubxonalari

| Manba | Asosiy URL | Qo‘llanishi |
| ----- | ----------- | ----------- |
| **NHentai** | `https://{mirror}/api/...`, `mirror ∈ { nhentai.net, nhentai.xxx, nhentai.to }` | Kutubxonada qidiruv, galereya API, **`/api/proxy/nhentai`**, **`/api/nhentai/search`**, server action `fetchNHentaiRaw`. Ba’zan zaxira: **codetabs** va **corsproxy** (`api.codetabs.com`, `corsproxy.io`) orqali. |
| **Booru** | `https://e621.net`, `https://danbooru.donmai.us`, `https://gelbooru.com`, `https://api.rule34.xxx` | **`/api/proxy/booru`**, `comic-service` da post JSON. |

## 4. Arxiv va matn kutubxonasi

| Manba | Asosiy URL | Qo‘llanishi |
| ----- | ----------- | ----------- |
| **Internet Archive** | `https://archive.org/metadata/...`, `advancedsearch.php`, `services/img/`, `download/...` | Qidiruv, metadata, sahifa rasmlari. To‘g‘ridan-to‘g‘ri `fetch` ham, **`/api/proxy/archive`** ham. |

## 5. Sun’iy intellekt va generatsiya

| Manba | Asosiy URL | Qo‘llanishi | Muhim env |
| ----- | ----------- | ----------- | --------- |
| **Azure OpenAI** | `{AZURE_IMAGE_ENDPOINT}/openai/deployments/...` | Matn (+vision): **`/api/describe-character`**, **`/api/ai/architect`**, **`/api/ai/suggest-panel`**. Rasm: **`/api/generate`**, **`/api/test-limit`**. | `AZURE_IMAGE_KEY`, `AZURE_IMAGE_ENDPOINT`, `AZURE_GPT_DEPLOYMENT` (deployment nomlari kodda yozilgan variantlar bilan moslashishi kerak). |
| **Replicate** | `https://api.replicate.com/v1/predictions` | **`/api/faceswap`** | `REPLICATE_API_TOKEN` |
| **LlamaGen** | `https://api.llamagen.ai/v1/comics/generations` | **`/api/llamagen/generate`**, **`/api/llamagen/status/[id]`** | `LLAMAGEN_API_KEY` (`Authorization: Bearer …`). |

## 6. Autentifikatsiya va bildirishnomalar

| Manba | Asosiy URL | Qo‘llanishi |
| ----- | ----------- | ----------- |
| **Google OAuth** | `https://accounts.google.com/o/oauth2/v2/auth`, `https://oauth2.googleapis.com/token`, `https://openidconnect.googleapis.com/v1/userinfo` | `src/lib/google-oauth.ts`, **`/api/auth/google*`**. |
| **Telegram Bot API** | `https://api.telegram.org/bot{token}/{method}` | `src/lib/telegram.ts`, **`/api/telegram/*`** (webhook, cron, test). |

## 7. SEO va ichki telemetry

| Manba | Asosiy URL | Qo‘llanishi |
| ----- | ----------- | ----------- |
| **IndexNow** | `https://api.indexnow.org/IndexNow` | `src/lib/indexnow.ts`, **`/api/indexnow`** |
| **`/api/analytics`** | Ichki POST | Hajmga qarab log; tashqi SaaS yo‘qligi shu kod versiyasida tekshirish mumkin (`src/app/api/analytics/route.ts`). |

## 8. Rasm va aktivlar (CDN / kosmetika)

Bu qatorlar asosan **HTTPS URL** bo‘lib, asosiy kontent API emas, lekin sahifada ishlaydi:

- **`https://images.weserv.nl/`** — NHentai rasm uchun WebP proxysi (**`/api/proxy/nhentai/image`**).
- **`https://api.dicebear.com/`** — default avatar SVG (signup/auth UI).
- **`https://via.placeholder.com/`** — yuklash xatosida fallback rasm (**`StoryViewer`**).
- **`https://www.transparenttextures.com/`** — tekstura URL lari (**`ProfessionalCanvas`**, **`auth/page`**).

## 9. Aloqa uchun UI havolalari (oddiy HTTPS)

Masalan Telegram (`t.me/...`), ijtimoiy ulashish (`twitter.com/intent`, `api.whatsapp.com`), sayt tashqi havolalari — asosan brauzer orqali, server `fetch` emas.

## 10. Mijozdan keladigan asosiy ichki `/api/*` uchlari

Komponentlar odatda o‘z `fetch('/api/...')` larini chaqiradi, masalan: `home/data`, `reading-progress`, `auth/me`, `stories`, `profile`, proxy route lar, LlamaGen, AI marshrutlar, superstar/Marvel yordam marshrutlar.

---

**Yangilanish**: kod o‘zgarganda `grep https://`, `grep fetch(` va `src/app/api/` katalogini qayta ko‘rib chiqish tavsiya etiladi.
