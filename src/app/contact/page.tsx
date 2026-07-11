'use client';

/** Contact — rebuilt in the Bold Pop Zine language. Reuses only the i18n copy + mailto logic. */

import { useState, useEffect, type FormEvent } from 'react';
import ZineNav from '@/components/zine/ZineNav';
import ZineFooter from '@/components/zine/ZineFooter';
import { Mail, Send, Globe } from 'lucide-react';
import { translations, Lang } from '@/lib/translations';
import { readStorageItem } from '@/lib/browser-storage';
import { TELEGRAM_CHANNEL_URL } from '@/lib/telegram-config';

const ZINPUT = 'w-full rounded-[7px] border-[2.5px] border-[var(--z-ink)] bg-[var(--z-card)] px-4 py-3 text-[15px] font-bold text-[var(--z-ink)] shadow-[3px_3px_0_var(--z-ink)] placeholder:font-normal placeholder:text-[var(--z-ink-2)] focus:outline-none';
const ZLABEL = 'mb-2 block text-[12px] font-extrabold uppercase tracking-wide text-[var(--z-ink-2)]';

export default function ContactPage() {
  const [lang, setLang] = useState<Lang>('en');
  const [sent, setSent] = useState(false);
  const t = translations[lang].contact;

  useEffect(() => {
    const saved = readStorageItem('lang') as Lang;
    if (saved && translations[saved]) setLang(saved);
    const onLang = (e: Event) => setLang((e as CustomEvent<Lang>).detail);
    window.addEventListener('langChange', onLang as EventListener);
    return () => window.removeEventListener('langChange', onLang as EventListener);
  }, []);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const fd = new FormData(event.currentTarget);
    const name = String(fd.get('name') || '').trim();
    const email = String(fd.get('email') || '').trim();
    const subjectText = String(fd.get('subject') || '').trim() || `${translations[lang].support.mailSubjectPrefix} ${t.badge}`;
    const message = String(fd.get('message') || '').trim();
    const sender = name || translations[lang].support.anonymous;
    window.location.href = `mailto:info@icomics.wiki?subject=${encodeURIComponent(subjectText)}&body=${encodeURIComponent(`${message}\n\n— ${sender}${email ? ` (${email})` : ''}`)}`;
    setSent(true);
  };

  const channels = [
    { icon: Mail, label: t.email, value: 'info@icomics.wiki', href: 'mailto:info@icomics.wiki', color: 'var(--z-red)' },
    { icon: Send, label: t.telegram, value: '@icomicswiki', href: TELEGRAM_CHANNEL_URL, color: 'var(--z-blue)' },
    { icon: Globe, label: t.domain, value: 'icomics.wiki', href: undefined, color: 'var(--z-green)' },
  ];

  return (
    <div className="zine min-h-dvh">
      <ZineNav />
      <main id="main-content" tabIndex={-1} className="z-wrap max-w-6xl py-14">
        <div className="grid grid-cols-1 gap-10 lg:grid-cols-12">
          <div className="space-y-8 lg:col-span-5 lg:sticky lg:top-24 lg:self-start">
            <div>
              <span className="z-tag z-tag--red">{t.badge}</span>
              <h1 className="z-display mt-4 text-[clamp(2.8rem,6vw,5rem)] leading-[0.8]">{t.titleLine1} {t.titleLine2}</h1>
              <p className="mt-4 text-[18px] font-bold italic leading-snug text-[var(--z-ink-2)]">&ldquo;{t.subtitle}&rdquo;</p>
            </div>
            <div className="grid gap-3">
              {channels.map(({ icon: Icon, label, value, href, color }) => {
                const inner = (
                  <>
                    <span className="grid h-11 w-11 shrink-0 place-items-center rounded-[7px] border-2 border-[var(--z-ink)] text-white" style={{ background: color }}><Icon size={18} strokeWidth={2.5} /></span>
                    <span className="min-w-0"><span className="z-kicker block text-[var(--z-ink-2)]">{label}</span><span className="block truncate text-[16px] font-extrabold text-[var(--z-ink)]">{value}</span></span>
                  </>
                );
                return href ? <a key={label} href={href} target={href.startsWith('http') ? '_blank' : undefined} rel="noreferrer" className="z-box z-pop flex items-center gap-4 p-4">{inner}</a> : <div key={label} className="z-box flex items-center gap-4 p-4">{inner}</div>;
              })}
            </div>
            <div className="border-l-4 border-[var(--z-yellow)] pl-4">
              <h4 className="z-display text-[1.4rem]">{t.hq}</h4>
              <p className="mt-2 text-[13px] font-semibold leading-relaxed text-[var(--z-ink-2)]">{t.hqAddress}</p>
            </div>
          </div>

          <div className="z-box p-6 sm:p-10 lg:col-span-7">
            <h2 className="z-display text-[clamp(2rem,4vw,3rem)] leading-[0.85]">{t.sendTitle}</h2>
            <p className="mb-8 mt-2 text-[14px] font-semibold text-[var(--z-ink-2)]">{t.sendHint}</p>
            <form className="grid grid-cols-1 gap-5 md:grid-cols-2" onSubmit={handleSubmit}>
              <div><label className={ZLABEL}>{t.alias}</label><input name="name" className={ZINPUT} placeholder={t.placeholderAlias} /></div>
              <div><label className={ZLABEL}>{t.frequency}</label><input type="email" name="email" className={ZINPUT} placeholder={t.placeholderFreq} /></div>
              <div className="md:col-span-2"><label className={ZLABEL}>{t.subject}</label><input name="subject" className={ZINPUT} placeholder={t.placeholderSub} /></div>
              <div className="md:col-span-2"><label className={ZLABEL}>{t.payload}</label><textarea name="message" required className={`${ZINPUT} min-h-[160px]`} placeholder={t.placeholderMsg} /></div>
              <div className="md:col-span-2 space-y-4">
                <button type="submit" className="z-btn z-btn--red w-full text-[16px]"><Send size={16} /> {t.sendBtn}</button>
                {sent ? <p role="status" className="rounded-[7px] border-[2.5px] border-[var(--z-green)] bg-[color-mix(in_oklab,var(--z-green)_15%,var(--z-card))] px-4 py-3 text-[14px] font-bold text-[var(--z-green)]">{t.sentNote} {t.sentFallback} <a href="mailto:info@icomics.wiki" className="underline">info@icomics.wiki</a></p> : null}
              </div>
            </form>
          </div>
        </div>
      </main>
      <ZineFooter />
    </div>
  );
}
