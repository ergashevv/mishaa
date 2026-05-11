# PageSpeed / Lighthouse baseline — 2026-05-11

Reference before performance work. Sources: PSI reports (`pagespeed.web.dev`) for **https://icomics.wiki/** (lab, Lighthouse 13).

## Mobile (`form_factor=mobile`)

| Bo‘lim | Bal |
|--------|-----|
| Performance | ~67 |
| Accessibility | ~84 |
| Best Practices | ~96 |
| SEO | 100 |

**Field (CrUX):** real-user data unavailable (“Нет данных”) for this URL.

**Lab Core metrics (reports vary by run):** LCP poor in one run (**~24s** lab, Moto G Power + throttled 4G); FCP ~1.4s acceptable; CLS 0.

**Highlighted audits:** Very large total download (**~8+ MB**), image optimization hint (**~6+ MB** savings), render-blocking requests, document latency / TTFB, main-thread work, long tasks, legacy JS snippet, accessibility (button names, contrast, tap targets, heading order), diagnostics (animations).

## Desktop (`form_factor=desktop`)

| Bo‘lim | Bal |
|--------|-----|
| Performance | ~68 |
| Accessibility | ~90 |
| Best Practices | ~96 |
| SEO | 100 |

**Lab Core metrics (typical):** FCP ~0.3s; LCP ~1.3s (needs improvement); TBT ~480ms; Speed Index ~3.2s; CLS 0.

**Highlighted audits:** Image payload (**~7 MB / ~6.9 MiB savings**), total network payload **~10 MB**, render-blocking CSS/JS (~170 ms), minimize main-thread work (~3.1s), long JS execution (~1.3s), unused JS (~49 KiB), forced layouts, accessibility (contrast, tap targets, heading order).

## Related Search Console context (same period)

Only **3 URLs** indexed (`/`, `/library`, `/auth`); thousands **Discovered – currently not indexed** (often crawl scheduling / crawl budget).

## Re-check checklist

After deploy, re-run PSI for mobile + desktop on `/` and note scores + LCP + total payload.

## Code changes (after baseline, same day)

Enabled **Next.js `Image` optimization** (removed `unoptimized`) for home covers, library grid, comic detail rails, plus `sizes` / `quality` tuning. Added `archive.org` to `remotePatterns` for Archive covers. Comic reader pages unchanged (still `unoptimized` for sequential full-page artwork).

## Post-fix snapshot — desktop (2026-05-11 ~16:41, after deploy / re-run)

Rough numbers from a fresh PSI run on `/` (Lighthouse 13, desktop):

| Bo‘lim | Bal |
|--------|-----|
| Performance | **65** |
| Accessibility | **90–96** (run-to-run / viewport) |
| Best Practices | **96** |
| SEO | **100** |

**Lab:** FCP **0.3 s** (yaxshi); **LCP ~1.3 s** (sariq zona); **CLS 0** (yaxshi); **TBT ~810 ms**, **Speed Index ~2.3 s** (qizil/sariq — asosan JS / render).

**Rasmlar auditi:** endi taxminan **~79 KiB** “tejash” (oldingi million baytlar emas) — optimizatsiya ishlayapti.

**Qolgan ustuvorlar:** hujjat/so‘rov kechikishi (**~640 ms**), **blocking** resurslar (**~150 ms**), **asosiy oqim / JS bajarilishi** (~2.5 s + ~1.3 s), **ishlatilmagan JS**, **layout thrashing** (forced layout). Accessibility: **kontrast**, **tap target**, ba’zi aylanmalarda **sarlavha tartibi**.

**Xulosa:** yuk kamaygan; umumiy **Performance ~65** hali **JS + server javobi** bilan cheklanadi — keyingi bosqich shular.
