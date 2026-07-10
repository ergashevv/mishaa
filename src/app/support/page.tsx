'use client';

import { Suspense, useEffect, useMemo, useState, type FormEvent } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { trackEvent } from '@/lib/analytics';
import { LazyMotion, domAnimation, m } from 'framer-motion';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import AppRouteLoading from '@/components/AppRouteLoading';
import { ChevronDown, MessageCircle, Send, LifeBuoy } from 'lucide-react';
import { readStorageItem } from '@/lib/browser-storage';
import { translations, type Lang } from '@/lib/translations';

type ReportCategory =
  | 'CONTENT_ISSUE'
  | 'IDENTITY_FORGE_ERROR'
  | 'INKING_ENGINE_LAG'
  | 'EXPORT_FAILURE'
  | 'ACCOUNT_ACCESS';

const CATEGORY_ORDER: ReportCategory[] = [
  'CONTENT_ISSUE',
  'IDENTITY_FORGE_ERROR',
  'INKING_ENGINE_LAG',
  'EXPORT_FAILURE',
  'ACCOUNT_ACCESS',
];

function categoryUiLabel(cat: ReportCategory, lang: Lang): string {
  const t = translations[lang].support;
  switch (cat) {
    case 'CONTENT_ISSUE':
      return t.catContentIssue;
    case 'IDENTITY_FORGE_ERROR':
      return t.catIdentityForgeError;
    case 'INKING_ENGINE_LAG':
      return t.catInkingEngineLag;
    case 'EXPORT_FAILURE':
      return t.catExportFailure;
    case 'ACCOUNT_ACCESS':
      return t.catAccountAccess;
    default:
      return cat;
  }
}

function SupportPageContent() {
  const searchParams = useSearchParams();
  const [lang, setLang] = useState<Lang>('en');
  const [report, setReport] = useState(() => {
    const category = (searchParams.get('category') as ReportCategory) || 'EXPORT_FAILURE';
    const safeCategory = CATEGORY_ORDER.includes(category) ? category : 'EXPORT_FAILURE';
    const comic = searchParams.get('comic');
    const source = searchParams.get('source');
    const chapter = searchParams.get('chapter');
    const details = searchParams.get('details') || '';

    return {
      email: searchParams.get('email') || '',
      category: safeCategory,
      details: [
        details,
        comic ? `Comic: ${comic}` : '',
        source ? `Source: ${source}` : '',
        chapter ? `Chapter: ${chapter}` : '',
      ]
        .filter(Boolean)
        .join('\n'),
    };
  });

  const [submitted, setSubmitted] = useState(false);
  const [copied, setCopied] = useState(false);

  const t = translations[lang].support;

  const categoryOpts = useMemo(
    () => CATEGORY_ORDER.map((value) => ({ value, label: categoryUiLabel(value, lang) })),
    [lang],
  );

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const saved = readStorageItem('lang') as Lang;
      if (saved && translations[saved]) setLang(saved);
    }, 0);

    const onLang = (e: Event) => setLang((e as CustomEvent<Lang>).detail);
    window.addEventListener('langChange', onLang as EventListener);

    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('langChange', onLang as EventListener);
    };
  }, []);

  const composeReport = () => {
    const friendly = categoryUiLabel(report.category as ReportCategory, lang);
    const reporter = report.email.trim() || t.anonymous;
    return {
      subject: `${t.mailSubjectPrefix} ${friendly}`,
      body: `${t.mailReporterLabel}: ${reporter}\n${t.mailCategoryLabel}: ${friendly}\n\n${report.details}`,
    };
  };

  const submitReport = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const { subject, body } = composeReport();

    window.location.href = `mailto:info@icomics.wiki?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    setSubmitted(true);
    trackEvent('report_submitted', {
      category: report.category,
      hasEmail: Boolean(report.email),
      detailsLength: report.details.length,
      delivery: 'mailto',
    });
  };

  const copyReport = async () => {
    const { subject, body } = composeReport();
    try {
      await navigator.clipboard.writeText(`${subject}\n\n${body}`);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard unavailable — the notice already shows the address to write to.
    }
  };

  return (
    <LazyMotion features={domAnimation} strict>
    <div className="min-h-dvh overflow-x-hidden bg-app text-fg">
      <Navbar />

      <main id="main-content" tabIndex={-1} className="pt-nav-catalog">
        <m.div
          initial={false}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.28, ease: [0.22, 0.61, 0.36, 1] }}
          className="wrap max-w-6xl space-y-14 py-14 sm:py-16 lg:py-20"
        >
          <div className="max-w-2xl space-y-5">
            <p className="ic-eyebrow">{t.badge}</p>
            <h1 className="ic-display text-balance text-4xl text-fg sm:text-5xl lg:text-6xl">
              {t.titleLine1}
              <br />
              <span className="text-accent-text">{t.titleLine2}</span>
            </h1>
            <p className="text-base leading-relaxed text-fg-secondary sm:text-lg">{t.intro}</p>
          </div>

          <div className="grid grid-cols-1 gap-8 lg:grid-cols-12 lg:items-start lg:gap-10">
            {/* Fast channels, stacked as one considered rail */}
            <div className="divide-y divide-line-subtle rounded-card border border-line bg-card lg:col-span-4 lg:sticky lg:top-[calc(var(--header-h)+2rem)] lg:self-start">
              <a href="mailto:info@icomics.wiki" className="flex items-start gap-4 p-6 transition-colors duration-150 hover:bg-card-hov">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-btn bg-accent-tint text-accent-text">
                  <Send size={20} />
                </span>
                <span className="min-w-0 space-y-1">
                  <span className="block text-base font-semibold text-fg">{t.cardEmailTitle}</span>
                  <span className="block text-sm leading-relaxed text-fg-secondary">{t.cardEmailBody}</span>
                  <span className="mt-1 block truncate text-sm font-medium text-accent-text">info@icomics.wiki</span>
                </span>
              </a>
              <a href="https://t.me/icomicsuz" target="_blank" rel="noreferrer" className="flex items-start gap-4 p-6 transition-colors duration-150 hover:bg-card-hov">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-btn bg-accent-tint text-accent-text">
                  <MessageCircle size={20} />
                </span>
                <span className="min-w-0 space-y-1">
                  <span className="block text-base font-semibold text-fg">{t.cardTelegramTitle}</span>
                  <span className="block text-sm leading-relaxed text-fg-secondary">{t.cardTelegramBody}</span>
                  <span className="mt-1 block truncate text-sm font-medium text-accent-text">@icomicsuz</span>
                </span>
              </a>
              <Link href="/faq" className="flex items-start gap-4 p-6 transition-colors duration-150 hover:bg-card-hov">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-btn bg-inset text-fg-muted">
                  <LifeBuoy size={20} />
                </span>
                <span className="min-w-0 space-y-1">
                  <span className="block text-base font-semibold text-fg">{t.cardFaqTitle}</span>
                  <span className="block text-sm leading-relaxed text-fg-secondary">{t.cardFaqBody}</span>
                  <span className="mt-1 block text-sm font-medium text-accent-text">{t.cardFaqCta}</span>
                </span>
              </Link>
            </div>

            {/* The report form is the page's actual content */}
            <form
              onSubmit={submitReport}
              className="rounded-card border border-line bg-card p-6 sm:p-10 md:p-12 lg:col-span-8"
            >
              <div className="space-y-8">
                <h2 className="ic-display text-balance text-3xl text-fg sm:text-4xl">{t.formTitle}</h2>
                <p className="border-l-2 border-line py-2 pl-5 font-display text-lg italic leading-snug text-fg-secondary">
                  {t.formQuote}
                </p>

                <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                  <div className="ic-field">
                    <label className="ic-field__label">{t.labelEmail}</label>
                    <input
                      type="text"
                      value={report.email}
                      onChange={(event) => setReport((current) => ({ ...current, email: event.target.value }))}
                      className="ic-input"
                      placeholder={t.placeholderEmail}
                    />
                  </div>
                  <div className="ic-field">
                    <label className="ic-field__label">{t.labelCategory}</label>
                    <div className="ic-select-wrap">
                      <select
                        value={report.category}
                        onChange={(event) =>
                          setReport((current) => ({ ...current, category: event.target.value as ReportCategory }))
                        }
                        className="ic-select"
                      >
                        {categoryOpts.map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                      <ChevronDown size={16} />
                    </div>
                  </div>
                  <div className="ic-field md:col-span-2">
                    <label className="ic-field__label">{t.labelDetails}</label>
                    <textarea
                      value={report.details}
                      onChange={(event) => setReport((current) => ({ ...current, details: event.target.value }))}
                      className="ic-input min-h-[200px] py-3!"
                      placeholder={t.placeholderDetails}
                      required
                    />
                  </div>
                </div>
                <button
                  type="submit"
                  className="ic-btn ic-btn--primary ic-btn--lg w-full sm:w-auto"
                >
                  {t.submitBtn}
                </button>
                {submitted && (
                  <div
                    role="status"
                    className="flex flex-col gap-3 rounded-btn border border-line bg-accent-tint p-4 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <p className="text-sm leading-relaxed text-fg-secondary">{t.submittedNotice}</p>
                    <button
                      type="button"
                      onClick={copyReport}
                      className="ic-btn ic-btn--secondary ic-btn--sm shrink-0"
                    >
                      {copied ? t.copiedLabel : t.copyReportBtn}
                    </button>
                  </div>
                )}
              </div>
            </form>
          </div>
        </m.div>
      </main>

      <Footer />
    </div>
    </LazyMotion>
  );
}

export default function SupportPage() {
  return (
    <Suspense fallback={<AppRouteLoading />}>
      <SupportPageContent />
    </Suspense>
  );
}
