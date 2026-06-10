# iComics.wiki — Product & Home‑Page Redesign Brief

> **For the designer:** This document describes **what the product does and how it behaves** — its purpose, users, flows, and functions. It deliberately does **not** prescribe colors, spacing, type, or layout — those are yours to design. Two things are **hard constraints** and explained in detail below: (1) the **reader read‑modes** must keep working exactly as specified, and (2) the **existing logo stays as‑is** (do not redesign it).

---

## 0. Scope & constraints

- **Primary deliverable:** a redesign of the **Home page** (and, by extension, the overall visual language the home establishes). You may propose the visual system the rest of the app inherits.
- **Hard constraint A — Reader read‑modes are core and must not change functionally.** Only their *visual* presentation may change. Every reading mode, reading direction, navigation gesture, and control described in **Section 6** must remain present and behave identically. See Section 6 for the exact behavior.
- **Hard constraint B — Keep the existing logo.** The wordmark/logo is liked as‑is; do not redesign or replace it.
- **Out of scope / non‑goals:** This is a **reader‑only** product. There is no content‑creation/“studio”/builder, and no Telegram bot — do not add or imply any authoring, uploading, or posting features.

---

## 1. Product overview

**iComics.wiki** is an online **reader and catalog** for manga, manhwa, webtoons, and comics. It aggregates several public content sources into one browsing + reading experience: users discover titles, open a title’s detail page, read chapters in a fullscreen reader, and (optionally) create an account to keep their reading progress and library.

It is purely a **consumption** product — browse, read, track. It does not host user‑generated comics.

**Content is aggregated from multiple external sources**, each contributing titles/chapters/metadata:
- **MangaDex** — primary manga/manhwa/webtoon catalog (search, tags/genres, original language, chapters, covers).
- **AniList / Jikan (MyAnimeList)** — metadata enrichment (ratings, scores, descriptions, trending).
- **Marvel** — comic series, issues, characters.
- **Superhero database** — comic‑character browsing (profiles, power stats).
- **Internet Archive** — public domain / archival books.
- **Adult / age‑restricted sources** (e.g. nHentai and booru‑type galleries) — gated behind age verification.

Different sources have different content ratings; some are **age‑restricted** and only appear after the user verifies they are an adult (see Section 8).

---

## 2. Goals

- Make **discovery** effortless: a returning reader should immediately find something to read (continue where they left off, plus fresh and personalized suggestions).
- Make **reading** excellent across content shapes — Japanese page comics, Korean vertical webtoons, Western comics — which is why multiple **read modes** exist.
- Respect the reader: fast, low‑friction, works for logged‑out users, and only asks for an account when there’s a payoff (cross‑device progress, profile).
- Be safe and compliant: adult content is clearly gated.

---

## 3. User types & states

The UI must adapt to these states (they combine):

1. **Anonymous (logged‑out)** — can browse and read everything that isn’t age‑gated. Reading history & bookmarks are stored **locally in the browser**. Can verify age locally.
2. **Logged‑in** — same as above plus: a profile, and **reading progress synced to the account** (so progress follows them across devices). Sign‑in is via username/password or Google.
3. **Age‑verified vs not** — adult sources/shelves are hidden or blurred until the user confirms they are 18+. Verification is remembered (expires after ~24h).
4. **Language** — the user has two independent language settings:
   - **UI language** (interface text): English, Japanese, Korean, Chinese, Russian.
   - **Manga content language** (which translated chapters/titles to prefer): a larger set (en, ja, ko, ru, es, fr, de, pt‑br, zh, zh‑hk, th, it, “all”).

Design must accommodate all five UI languages (text length varies; avoid fixed‑width text assumptions).

---

## 4. Primary flows

1. **Discover → Read:** Home (or Library) → tap a title → **Comic detail** (description, chapters) → tap a chapter → **Reader** → progress is tracked automatically → at chapter end, auto‑advance to the next chapter.
2. **Continue reading:** Returning user sees “continue where you left off” surfaced on the Home page; one tap resumes at the saved chapter/page.
3. **Search:** Quick search (on Home) or full search (in Library) → results → detail → read.
4. **Account:** Sign up / sign in (username+password or Google) → progress syncs to account; profile shows reading stats.
5. **Personalize:** As the user reads and bookmarks, a local preference profile builds up and feeds a “For You” recommendation row.

---

## 5. HOME PAGE — functional spec (redesign target)

**Purpose:** the main entry point and discovery surface. It must serve a cold/anonymous visitor (give them something compelling immediately) and a returning/logged‑in reader (resume + personalized picks). Everything below is described by **function and content**, not layout — you decide how to arrange and present it.

### 5.1 Regions (by function, in rough priority — order is yours to design)

- **Featured / hero area.** Rotates through a set of **trending** titles. Auto‑advances on a timer; pauses when the user is interacting (hover/focus); respects “reduced motion.” Manual selection between featured items is possible. Each featured item shows the title, a short description, a rating/score or status, and a primary call‑to‑action that opens that title’s detail/reading. Adult featured items are blurred until age‑verified (and, even when verified, are “politely” blurred until hovered/focused).

- **Quick search.** A compact search that queries the catalog as the user types (debounced, needs ≥2 characters), shows a short list of matching titles, and also live‑filters the title rows already on the page. Selecting a result opens its detail page; a “view all” affordance jumps into the full Library search.

- **Themed rows / shelves (horizontal collections).** Multiple curated rows, each a horizontally‑scrollable set of title cards (~8–12 per row, fewer on touch). Rows auto‑advance gently (pausable; off under reduced motion). Current rows by meaning:
  - **Romance**, **Fantasy**, **Drama** (genre rows)
  - **Trending** (globally trending titles)
  - **For You** (personalized — see 5.2; hidden when empty)
  - **Manga Hub** (Japanese‑origin manga)
  - **New** (recently added)
  - **Manhwa** (Korean‑origin)
  - **Webtoons** (long vertical‑strip format)
  - **Adult rows** (e.g. “Doujinshi” and other mature categories) — **only shown when age‑verified.**
  Each row has a heading and a “see all” link into the Library filtered to that category. Each **title card** shows cover, title, and light metadata (source/status/score or genres). Tapping a card opens its detail page. On touch, an adult (verified) card may require a first tap to reveal, second tap to open.

- **“Continue reading” / recently read.** Returning readers should be able to resume in‑progress titles. This is derived from reading history (local for everyone, plus account‑synced progress when logged in). Surface in‑progress items with their progress state.

- **Infinite discovery grid (“More titles”).** Below the curated rows, an endlessly‑paginating grid of titles that loads more as the user scrolls (paged; bounded to a max number of pages). De‑duplicates against everything already shown. Has loading and “you’re all caught up” end states.

- **Footer.** Brand mark + a small set of navigation links (Guides, Reading hub, FAQ, Library, About, Privacy, Terms) + copyright. (The Telegram **channel link** that exists elsewhere is a plain marketing link, not a feature.)

### 5.2 Personalization (“For You”)

A lightweight, **client‑side** recommendation system builds a preference profile from the user’s reading history and bookmarks (genre affinities, what they’ve seen/saved/skipped). It ranks titles pooled from the other rows and shows the top picks. It updates as the user reads/bookmarks. It is privacy‑local (no server profile required) and seeded so results feel stable but not identical every visit. The “For You” row is hidden if there’s nothing meaningful yet (e.g. brand‑new visitor).

### 5.3 Cross‑cutting home behaviors

- **De‑duplication:** a given title appears in only one curated row (earlier rows claim it), and the infinite grid never repeats a title already shown.
- **Language reactivity:** changing the UI language re‑labels everything; changing the manga content language reloads the rows with that language’s titles/translations.
- **Age gating:** adult rows/cards are hidden or blurred per the verification state; attempting to open adult content unverified prompts age verification.
- **States to design for:** initial **loading** (skeletons per region), **empty** (e.g. a source returned nothing — show a graceful fallback and a path to the Library), **error** (fall back to cached/sane defaults; never a blank page), and **hydration** (server renders an initial set; the client may refresh/extend it).
- **Performance intent:** the home is data‑heavy (many external sources). Keep the first meaningful content fast; treat below‑the‑fold rows and the infinite grid as progressively loaded.

---

## 6. READER & READ MODES — CORE, MUST NOT BREAK

> The reader is the heart of the product. You may restyle it, but **every mode, direction, gesture, and control below must remain and behave the same.** Read‑mode behavior is functional, not decorative.

The reader opens fullscreen on a single chapter and tracks progress automatically. The single most important concept: **there are three view modes plus a reading direction, and they change how pages are laid out and how navigation works.** A title can be page‑based (Japanese/Western comics) or a continuous vertical strip (Korean webtoons), so the reader must support both shapes.

### 6.1 The three view modes

1. **Classic — single page (paged).**
   - One full page on screen at a time. Advancing moves **one page** forward/back.
   - Horizontal/paged reading. This is the **default on desktop**.
   - The current page is preloaded before it’s shown; the next few pages (and one previous) are prefetched in the background.

2. **Journal — two‑page spread (paged, book‑like).**
   - Two facing pages shown side‑by‑side, like an open book/print comic. Advancing moves **two pages** at a time.
   - **Spread cover rule:** the first page (cover) is shown **alone** as a single page; after the cover, pages are grouped into 2‑up spreads. (So step from the cover is 1; subsequent steps are 2.) When jumping back from a later chapter, the reader must land on a valid spread boundary, honoring this rule.

3. **Flow — continuous vertical scroll (webtoon).**
   - All pages stacked vertically; the user **scrolls** continuously (no paging). This is the natural mode for **long‑strip webtoons**.
   - This is the **default on mobile**. Pages load lazily as they enter the viewport; an initial batch is preloaded for smooth start.
   - Progress here is **scroll‑based** (how far down the chapter you are), not page‑index based.

The user can switch modes at any time; the choice is **persisted** (remembered next time). Zoom and paged click‑zones apply to classic/journal only (not flow).

### 6.2 Reading direction — LTR vs RTL

- The reader supports **left‑to‑right** (default) and **right‑to‑left** (for manga and other RTL comics). The user can toggle it; the choice is persisted.
- Direction **reverses the meaning of “forward/back”** for: arrow keys, on‑screen click/tap zones, and horizontal swipes. (It applies to the paged modes; flow is vertical and unaffected horizontally.)
- This must stay correct everywhere navigation happens — a redesign must not desync the direction logic.

### 6.3 Navigation mechanisms (all must remain)

- **Keyboard:** Left/Right arrows and Space page forward/back (direction‑aware); Up/Down & PageUp/PageDown (in flow, scroll by ~viewport; in paged, move pages); Home/End jump to first/last; `0`/`+`/`-` reset/zoom in/out (paged); `F` toggles fullscreen; `Esc` exits back to the title’s detail page. (Keyboard is ignored while typing in a field.)
- **On‑screen zones (pointer devices):** left zone = previous, right zone = next (direction‑aware), center = toggle the reader UI. On touch, swipe is used instead.
- **Swipe (touch):** horizontal swipe pages forward/back (direction‑aware), with a small threshold and only when the horizontal movement dominates.
- **Zoom (paged modes):** pinch‑to‑zoom, on‑screen zoom buttons (in/out/reset), keyboard, and Ctrl/Cmd+wheel; zoom is clamped to a sane min/max and persisted.
- **Chapter boundaries:** going past the last page auto‑advances to the **next chapter**; going before the first page goes to the **previous chapter**. Adjacent chapters are prefetched so this is instant. On entering a previous chapter you land on its last valid page (mode‑aware).

### 6.4 Reader controls/settings (all must remain available)

A settings surface lets the reader change: **view mode** (classic/journal/flow), **reading direction** (LTR/RTL), **zoom**, a **reader theme** (a light/dark/sepia reading background — keep the option, restyle as you like), **page‑overview/thumbnail grid** (jump to any page), **fullscreen**, and a **keyboard‑shortcuts help** overlay. There’s also: an auto‑hiding UI (controls fade while reading, reappear on interaction), a **resume prompt** (“continue from where you left off?” when reopening a chapter), a **chapter selector/navigator**, and a **progress indicator** (page x/total or scroll %). When a source only links out (e.g. official Marvel/VIZ pages with no in‑app images), the reader shows a “read on the official platform” affordance instead of pages.

### 6.5 Reading‑progress tracking (must keep working)

Progress is computed continuously and combines **chapter position** (which chapter of how many) with **within‑chapter position** (page index for paged modes, scroll percent for flow). It’s mapped to a status: *started → in‑progress → almost‑done → completed*. Progress is saved **locally for everyone** and, **when logged in, also to the account** (so it syncs across devices and powers “continue reading” and profile stats). The redesign must preserve where/when these signals are captured (mode, page/scroll, chapter index) — they feed Home and Profile.

### 6.6 Source/adult nuances in the reader

Age‑restricted sources require verification before the reader/detail loads. Some sources behave slightly differently (e.g. external‑only chapters). The reader must keep honoring per‑source behavior; don’t assume every chapter has in‑app page images.

---

## 7. Other surfaces (brief functional notes)

These aren’t the redesign focus but define the product the home leads into; keep them coherent with whatever visual language you establish.

- **Library / browse:** the full catalog. Source/category **tabs**, a per‑tab **search** (debounced, reflected in the URL), **load‑more** pagination, and title cards that link to detail. Age‑restricted tabs are hidden until verified. Respects the manga content language.
- **Comic detail:** a title’s hub — cover, title, author, description, genres/tags, status, rating/score (enriched from AniList/Jikan/Marvel), the **chapter list**, related titles, a **Start/Continue reading** CTA (continue if there’s saved progress), **bookmark**, and **share**. Age‑gated for restricted sources.
- **Auth:** one screen toggling sign‑in/sign‑up; username+password or **Google**. Being logged in unlocks profile + account‑synced progress.
- **Profile:** account info + reading stats (e.g. how many titles in‑progress / completed) + edit fields.
- **Settings:** UI language, manga content language, age‑verification toggle, local bookmarks/history management (with clear‑all), logout.
- **Reading hub:** a guide/resources landing (links to guides, FAQ, RSS).
- **Guides:** getting‑started, library sources, manga formats (explains manga vs manhwa vs webtoon vs doujinshi).
- **Superheroes:** comic‑character browsing — featured characters, a 1‑v‑1 stat “arena,” and a team builder.
- **Legal/info pages:** about, faq, support, contact, privacy, terms, content‑policy, dmca, link‑to‑us, and an “icomics‑wiki” disambiguation page.

---

## 8. Cross‑cutting systems (keep intact behaviorally)

- **Sessions/auth:** logged‑in state persists; logged‑out is fully usable.
- **Age gate:** a blocking overlay for adult content; verification is remembered (~24h), togglable in settings, and gates restricted sources, adult shelves, and adult cards (blur/lock when unverified).
- **i18n:** two independent language axes (UI language: en/ja/ko/zh/ru; manga content language: larger set). Switching either updates the relevant content/labels live. **Design for text expansion across all UI languages.**
- **Local library:** bookmarks + reading history live in the browser for everyone; account sync layers on top when logged in. Changes broadcast app‑wide so “continue reading,” counts, and recommendations stay fresh.

---

## 9. Design constraints checklist (for sign‑off)

- ✅ **Keep the existing logo** (no redesign).
- ✅ **Preserve all reader read‑modes** (classic / journal / flow), **LTR/RTL direction**, the **spread‑cover** rule, every **navigation gesture** (keyboard, zones, swipe, zoom, wheel), every **control** (mode switch, direction, theme, thumbnails, fullscreen, help, chapter nav, progress, resume), and **progress tracking** semantics. Visual restyle only.
- ✅ Support **anonymous + logged‑in** and **age‑verified + not** states everywhere relevant.
- ✅ Support **5 UI languages** (text expansion).
- ✅ Preserve **age‑gating** of adult content (hide/blur/verify).
- ✅ It’s a **reader only** — no authoring/upload/posting UI.
- ✅ Home must handle **loading / empty / error / hydration** states gracefully and stay fast despite heavy multi‑source data.
