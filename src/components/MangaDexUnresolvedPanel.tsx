'use client';

import { useResolvedLang } from '@/hooks/useResolvedLang';
import { translations } from '@/lib/translations';

/** Legacy numeric MangaDex routes that cannot resolve — copy follows UI language when available. */
export default function MangaDexUnresolvedPanel() {
  const lang = useResolvedLang();
  const t = translations[lang].library;

  return (
    <article className="min-h-dvh bg-app text-fg">
      <div className="mx-auto flex min-h-dvh max-w-4xl flex-col items-center justify-center gap-6 px-4 text-center">
        <div className="ic-eyebrow">{t.unresolvedLegacyKicker}</div>
        <h1 className="ic-display text-4xl sm:text-6xl">{t.unresolvedTitle}</h1>
        <p className="max-w-2xl text-sm leading-7 text-fg-secondary">{t.unresolvedBody}</p>
        <div className="flex flex-wrap justify-center gap-3">
          <a href="/library" className="ic-btn ic-btn--primary ic-btn--md">
            {t.unresolvedBrowseLibrary}
          </a>
          <a href="/" className="ic-btn ic-btn--secondary ic-btn--md">
            {t.unresolvedGoHome}
          </a>
        </div>
      </div>
    </article>
  );
}
