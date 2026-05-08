'use client';

import { useResolvedLang } from '@/hooks/useResolvedLang';
import { translations } from '@/lib/translations';

/** Legacy numeric MangaDex routes that cannot resolve — copy follows UI language when available. */
export default function MangaDexUnresolvedPanel() {
  const lang = useResolvedLang();
  const t = translations[lang].library;

  return (
    <article className="min-h-screen bg-zinc-50 text-neutral-900 dark:bg-[#05060a] dark:text-white">
      <div className="mx-auto flex min-h-screen max-w-4xl flex-col items-center justify-center gap-6 px-4 text-center">
        <div className="text-[10px] font-black uppercase tracking-[0.5em] text-[#ff5a1f]">{t.unresolvedLegacyKicker}</div>
        <h1 className="text-4xl font-black uppercase tracking-tight sm:text-6xl">{t.unresolvedTitle}</h1>
        <p className="max-w-2xl text-sm leading-7 text-neutral-600 dark:text-white/60">{t.unresolvedBody}</p>
        <div className="flex flex-wrap justify-center gap-3">
          <a
            href="/library"
            className="rounded-full bg-neutral-900 px-5 py-3 text-[10px] font-black uppercase tracking-[0.35em] text-white dark:bg-white dark:text-black"
          >
            {t.unresolvedBrowseLibrary}
          </a>
          <a
            href="/"
            className="rounded-full border border-neutral-300 px-5 py-3 text-[10px] font-black uppercase tracking-[0.35em] text-neutral-900 dark:border-white/10 dark:text-white"
          >
            {t.unresolvedGoHome}
          </a>
        </div>
      </div>
    </article>
  );
}
