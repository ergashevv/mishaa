'use client';

/** Support — rebuilt in the Bold Pop Zine language. Reuses only the report logic + i18n copy. */

import { Suspense, useEffect, useMemo, useState, type FormEvent } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { trackEvent } from '@/lib/analytics';
import ZineNav from '@/components/zine/ZineNav';
import ZineFooter from '@/components/zine/ZineFooter';
import AppRouteLoading from '@/components/AppRouteLoading';
import { ChevronDown, MessageCircle, Send, LifeBuoy } from 'lucide-react';
import { readStorageItem } from '@/lib/browser-storage';
import { translations, type Lang } from '@/lib/translations';

type ReportCategory = 'CONTENT_ISSUE' | 'IDENTITY_FORGE_ERROR' | 'INKING_ENGINE_LAG' | 'EXPORT_FAILURE' | 'ACCOUNT_ACCESS';
const CATEGORY_ORDER: ReportCategory[] = ['CONTENT_ISSUE', 'IDENTITY_FORGE_ERROR', 'INKING_ENGINE_LAG', 'EXPORT_FAILURE', 'ACCOUNT_ACCESS'];

function categoryUiLabel(cat: ReportCategory, lang: Lang): string {
  const t = translations[lang].support;
  const map: Record<ReportCategory, string> = {
    CONTENT_ISSUE: t.catContentIssue, IDENTITY_FORGE_ERROR: t.catIdentityForgeError,
    INKING_ENGINE_LAG: t.catInkingEngineLag, EXPORT_FAILURE: t.catExportFailure, ACCOUNT_ACCESS: t.catAccountAccess,
  };
  return map[cat] || cat;
}

const ZINPUT = 'w-full rounded-[7px] border-[2.5px] border-[var(--z-ink)] bg-[var(--z-card)] px-4 py-3 text-[15px] font-bold text-[var(--z-ink)] shadow-[3px_3px_0_var(--z-ink)] placeholder:font-normal placeholder:text-[var(--z-ink-2)] focus:outline-none';
const ZLABEL = 'mb-2 block text-[12px] font-extrabold uppercase tracking-wide text-[var(--z-ink-2)]';

function SupportPageContent() {
  const searchParams = useSearchParams();
  const [lang, setLang] = useState<Lang>('en');
  const [report, setReport] = useState(() => {
    const category = (searchParams.get('category') as ReportCategory) || 'EXPORT_FAILURE';
    const safe = CATEGORY_ORDER.includes(category) ? category : 'EXPORT_FAILURE';
    const comic = searchParams.get('comic'); const source = searchParams.get('source'); const chapter = searchParams.get('chapter');
    return {
      email: searchParams.get('email') || '', category: safe,
      details: [searchParams.get('details') || '', comic ? `Comic: ${comic}` : '', source ? `Source: ${source}` : '', chapter ? `Chapter: ${chapter}` : ''].filter(Boolean).join('\n'),
    };
  });
  const [submitted, setSubmitted] = useState(false);
  const [copied, setCopied] = useState(false);
  const t = translations[lang].support;
  const categoryOpts = useMemo(() => CATEGORY_ORDER.map((value) => ({ value, label: categoryUiLabel(value, lang) })), [lang]);

  useEffect(() => {
    const saved = readStorageItem('lang') as Lang;
    if (saved && translations[saved]) setLang(saved);
    const onLang = (e: Event) => setLang((e as CustomEvent<Lang>).detail);
    window.addEventListener('langChange', onLang as EventListener);
    return () => window.removeEventListener('langChange', onLang as EventListener);
  }, []);

  const compose = () => {
    const friendly = categoryUiLabel(report.category as ReportCategory, lang);
    const reporter = report.email.trim() || t.anonymous;
    return { subject: `${t.mailSubjectPrefix} ${friendly}`, body: `${t.mailReporterLabel}: ${reporter}\n${t.mailCategoryLabel}: ${friendly}\n\n${report.details}` };
  };
  const submitReport = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const { subject, body } = compose();
    window.location.href = `mailto:info@icomics.wiki?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    setSubmitted(true);
    trackEvent('report_submitted', { category: report.category, hasEmail: Boolean(report.email), detailsLength: report.details.length, delivery: 'mailto' });
  };
  const copyReport = async () => { const { subject, body } = compose(); try { await navigator.clipboard.writeText(`${subject}\n\n${body}`); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch { /* noop */ } };

  const channels = [
    { icon: Send, title: t.cardEmailTitle, body: t.cardEmailBody, val: 'info@icomics.wiki', href: 'mailto:info@icomics.wiki', color: 'var(--z-red)' },
    { icon: MessageCircle, title: t.cardTelegramTitle, body: t.cardTelegramBody, val: '@icomicsuz', href: 'https://t.me/icomicsuz', color: 'var(--z-blue)' },
    { icon: LifeBuoy, title: t.cardFaqTitle, body: t.cardFaqBody, val: t.cardFaqCta, href: '/faq', color: 'var(--z-green)' },
  ];

  return (
    <div className="zine min-h-dvh">
      <ZineNav />
      <main id="main-content" tabIndex={-1} className="z-wrap max-w-6xl space-y-14 py-14">
        <div className="max-w-2xl">
          <span className="z-tag z-tag--red">{t.badge}</span>
          <h1 className="z-display mt-4 text-[clamp(2.8rem,6vw,5rem)] leading-[0.8]">{t.titleLine1} {t.titleLine2}</h1>
          <p className="mt-4 text-[17px] font-semibold leading-relaxed text-[var(--z-ink-2)]">{t.intro}</p>
        </div>

        <div className="grid grid-cols-1 gap-8 lg:grid-cols-12 lg:items-start">
          <div className="grid gap-3 lg:col-span-4 lg:sticky lg:top-24 lg:self-start">
            {channels.map(({ icon: Icon, title, body, val, href, color }) => {
              const inner = (
                <>
                  <span className="grid h-11 w-11 shrink-0 place-items-center rounded-[7px] border-2 border-[var(--z-ink)] text-white" style={{ background: color }}><Icon size={20} strokeWidth={2.5} /></span>
                  <span className="min-w-0"><span className="block text-[15px] font-extrabold text-[var(--z-ink)]">{title}</span><span className="block text-[13px] font-semibold leading-relaxed text-[var(--z-ink-2)]">{body}</span><span className="mt-1 block truncate text-[13px] font-black" style={{ color }}>{val}</span></span>
                </>
              );
              return href.startsWith('/') ? <Link key={title} href={href} className="z-box z-pop flex items-start gap-4 p-5">{inner}</Link> : <a key={title} href={href} target={href.startsWith('http') ? '_blank' : undefined} rel="noreferrer" className="z-box z-pop flex items-start gap-4 p-5">{inner}</a>;
            })}
          </div>

          <form onSubmit={submitReport} className="z-box p-6 sm:p-10 lg:col-span-8">
            <h2 className="z-display text-[clamp(2rem,4vw,3rem)] leading-[0.85]">{t.formTitle}</h2>
            <p className="mb-8 mt-3 border-l-4 border-[var(--z-yellow)] py-1 pl-4 text-[16px] font-bold italic text-[var(--z-ink-2)]">{t.formQuote}</p>
            <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
              <div><label className={ZLABEL}>{t.labelEmail}</label><input value={report.email} onChange={(e) => setReport((c) => ({ ...c, email: e.target.value }))} className={ZINPUT} placeholder={t.placeholderEmail} /></div>
              <div><label className={ZLABEL}>{t.labelCategory}</label>
                <div className="relative">
                  <select value={report.category} onChange={(e) => setReport((c) => ({ ...c, category: e.target.value as ReportCategory }))} className={`${ZINPUT} appearance-none pr-10`}>
                    {categoryOpts.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                  <ChevronDown size={16} strokeWidth={2.5} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2" />
                </div>
              </div>
              <div className="md:col-span-2"><label className={ZLABEL}>{t.labelDetails}</label><textarea value={report.details} onChange={(e) => setReport((c) => ({ ...c, details: e.target.value }))} className={`${ZINPUT} min-h-[200px]`} placeholder={t.placeholderDetails} required /></div>
            </div>
            <button type="submit" className="z-btn z-btn--red mt-6"><Send size={16} /> {t.submitBtn}</button>
            {submitted ? (
              <div role="status" className="mt-4 flex flex-col gap-3 rounded-[7px] border-[2.5px] border-[var(--z-green)] bg-[color-mix(in_oklab,var(--z-green)_15%,var(--z-card))] p-4 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-[14px] font-bold text-[var(--z-ink)]">{t.submittedNotice}</p>
                <button type="button" onClick={copyReport} className="z-btn z-btn--paper z-btn--sm shrink-0">{copied ? t.copiedLabel : t.copyReportBtn}</button>
              </div>
            ) : null}
          </form>
        </div>
      </main>
      <ZineFooter />
    </div>
  );
}

export default function SupportPage() {
  return (
    <Suspense fallback={<AppRouteLoading />}>
      <SupportPageContent />
    </Suspense>
  );
}
