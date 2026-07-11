'use client';

/**
 * Auth — sign-in / register, rebuilt from zero in the Bold Pop Zine language: a color-block
 * brand panel with halftone + poster type, and a paper form with bordered inputs, sticker
 * mode tabs and hard-shadow buttons. Reuses ONLY the auth API calls.
 */

import { Suspense, useState, useEffect } from 'react';
import Image from 'next/image';
import { useRouter, useSearchParams } from 'next/navigation';
import { Eye, EyeOff, ArrowLeft, ShieldCheck, User, Lock, Globe, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { translations, Lang } from '@/lib/translations';
import { readStorageItem } from '@/lib/browser-storage';

type Mode = 'login' | 'signup';
const AVATAR_STYLES = ['adventurer', 'avataaars', 'big-ears', 'bottts', 'fun-emoji'];
const ZINPUT = 'w-full rounded-[7px] border-[2.5px] border-[var(--z-ink)] bg-[var(--z-card)] px-4 py-3 text-[15px] font-bold text-[var(--z-ink)] shadow-[3px_3px_0_var(--z-ink)] placeholder:font-normal placeholder:text-[var(--z-ink-2)] focus:outline-none focus:-translate-y-0.5 transition-transform';
const ZLABEL = 'mb-2 block text-[12px] font-extrabold uppercase tracking-wide text-[var(--z-ink-2)]';

function AuthPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [mode, setMode] = useState<Mode>('login');
  const [loading, setLoading] = useState(false);
  const [urlAuthError, setUrlAuthError] = useState<string | null>(() => {
    const e = searchParams.get('error');
    return e === 'google_state_mismatch' || e === 'google_login_failed' ? e : null;
  });
  const [formError, setFormError] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [avatarStyle, setAvatarStyle] = useState('adventurer');
  const [lang, setLang] = useState<Lang>('en');
  const t = translations[lang].auth;

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  useEffect(() => {
    const saved = readStorageItem('lang') as Lang;
    if (saved && translations[saved]) setLang(saved);
    const onLang = (e: Event) => setLang((e as CustomEvent<Lang>).detail);
    window.addEventListener('langChange', onLang as EventListener);
    return () => window.removeEventListener('langChange', onLang as EventListener);
  }, []);

  const displayError = formError || (urlAuthError === 'google_state_mismatch' ? t.errGoogleState : urlAuthError === 'google_login_failed' ? t.errGoogleLogin : '');

  const avatarUrl = `https://api.dicebear.com/9.x/${avatarStyle}/svg?seed=${username || 'icomics.wiki'}&backgroundColor=b6e3f4,c0aede,d1d4f9,ffd5dc,ffdfbf`;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setFormError(''); setUrlAuthError(null); setLoading(true);
    try {
      const endpoint = mode === 'login' ? '/api/auth/login' : '/api/auth/signup';
      const body = mode === 'login' ? { username, password } : { firstName, lastName, username, password, avatar: avatarUrl };
      const res = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || t.errAuthFailed);
      router.push('/'); router.refresh();
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : t.errUnexpected);
    } finally { setLoading(false); }
  };

  return (
    <div className="zine grid min-h-dvh lg:grid-cols-[1.05fr_1fr]">
      {/* Brand color-block */}
      <div className="relative hidden flex-col justify-between overflow-hidden border-r-[3px] border-[var(--z-ink)] bg-[var(--z-blue)] px-14 py-12 text-[var(--z-paper)] lg:flex xl:px-20">
        <div className="pointer-events-none absolute inset-0 opacity-[0.14]" style={{ backgroundImage: 'radial-gradient(#fff 24%, transparent 26%)', backgroundSize: '18px 18px' }} aria-hidden />
        <Link href="/" className="relative z-tag z-tag--yellow w-fit"><ArrowLeft size={13} strokeWidth={3} /> {t.abortMission}</Link>
        <div className="relative max-w-md">
          <span className="z-tag z-tag--red -rotate-2">{t.studioAccess}</span>
          <h1 className="z-display mt-5 text-[clamp(3rem,6vw,5.5rem)] leading-[0.82] text-[var(--z-paper)]">{mode === 'login' ? t.titleLogin : t.titleSignup}</h1>
          <p className="mt-5 text-[16px] font-semibold leading-relaxed text-[var(--z-paper)]/90">{mode === 'login' ? t.subtitleLogin : t.subtitleSignup}</p>
        </div>
        <div className="relative flex items-center gap-3 text-[12px] font-bold text-[var(--z-paper)]/80" style={{ fontFamily: 'var(--font-zine-mono)' }}>
          <ShieldCheck size={14} /> {t.footerEncrypted} <span className="text-[var(--z-yellow)]">★</span> <Globe size={14} /> {t.footerGlobalUplink}
        </div>
      </div>

      {/* Form */}
      <div className="flex flex-col justify-center px-6 py-12 sm:px-10 md:px-16 lg:px-14 xl:px-20">
        <Link href="/" className="z-tag z-tag--ink mb-8 w-fit lg:hidden"><ArrowLeft size={13} strokeWidth={3} /> {t.abortMission}</Link>
        <div className="mx-auto w-full max-w-[420px]">
          <div className="mb-8 lg:hidden">
            <span className="z-tag z-tag--red">{t.studioAccess}</span>
            <h1 className="z-display mt-3 text-[2.6rem] leading-[0.82]">{mode === 'login' ? t.titleLogin : t.titleSignup}</h1>
          </div>

          {/* Mode tabs */}
          <div className="mb-8 grid grid-cols-2 gap-0 overflow-hidden rounded-[8px] border-[2.5px] border-[var(--z-ink)] shadow-[3px_3px_0_var(--z-ink)]">
            {(['login', 'signup'] as Mode[]).map((m) => (
              <button key={m} type="button" onClick={() => setMode(m)} className="py-3 text-[14px] font-extrabold uppercase" style={{ fontFamily: 'var(--font-zine-mono)', background: mode === m ? 'var(--z-red)' : 'var(--z-card)', color: mode === m ? '#fff' : 'var(--z-ink)', borderRight: m === 'login' ? '2.5px solid var(--z-ink)' : undefined }}>
                {m === 'login' ? t.tabSignIn : t.tabRegister}
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {mode === 'signup' ? (
              <>
                <div className="z-box flex items-center gap-4 p-4">
                  <span className="relative h-14 w-14 shrink-0 overflow-hidden rounded-[7px] border-2 border-[var(--z-ink)]"><Image src={avatarUrl} alt="Avatar" fill unoptimized className="object-cover" /></span>
                  <div className="min-w-0 flex-1">
                    <p className={ZLABEL}>{t.avatarPrototype}</p>
                    <div className="flex flex-wrap gap-1.5">
                      {AVATAR_STYLES.map((s) => (
                        <button key={s} type="button" onClick={() => setAvatarStyle(s)} className="z-tag" style={{ background: avatarStyle === s ? 'var(--z-yellow)' : 'var(--z-card)' }}>{s.split('-')[0]}</button>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div><label className={ZLABEL}>{t.firstName}</label><input value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder={t.placeholderFirstDemo} className={ZINPUT} /></div>
                  <div><label className={ZLABEL}>{t.lastName}</label><input value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder={t.placeholderLastDemo} className={ZINPUT} /></div>
                </div>
              </>
            ) : null}

            <div>
              <label className={ZLABEL}>{t.labelUsernameAlias}</label>
              <div className="relative">
                <User size={17} strokeWidth={2.5} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--z-ink-2)]" />
                <input value={username} onChange={(e) => setUsername(e.target.value.toLowerCase())} placeholder={t.placeholderUsername} required className={`${ZINPUT} !pl-11`} />
              </div>
            </div>

            <div>
              <label className={ZLABEL}>{t.accessKeyShort}</label>
              <div className="relative">
                <Lock size={17} strokeWidth={2.5} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--z-ink-2)]" />
                <input type={showPass ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" required className={`${ZINPUT} !pl-11 !pr-11`} />
                <button type="button" onClick={() => setShowPass(!showPass)} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[var(--z-ink-2)]">{showPass ? <EyeOff size={17} /> : <Eye size={17} />}</button>
              </div>
            </div>

            {displayError ? <div className="rounded-[7px] border-[2.5px] border-[var(--z-red)] bg-[color-mix(in_oklab,var(--z-red)_15%,var(--z-card))] p-3 text-center text-[14px] font-bold text-[var(--z-red)]">{t.errLabel}: {displayError}</div> : null}

            <button type="submit" disabled={loading} className="z-btn z-btn--red w-full text-[16px]" style={loading ? { opacity: 0.6 } : undefined}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {loading ? (mode === 'login' ? t.signingInEllipsis : t.createAccountEllipsis) : (mode === 'login' ? t.signInSubmit : t.createAccountSubmit)}
            </button>

            <div className="flex items-center gap-3 py-1">
              <span className="h-[2.5px] flex-1 bg-[var(--z-ink)]" />
              <span className="text-[11px] font-bold uppercase text-[var(--z-ink-2)]" style={{ fontFamily: 'var(--font-zine-mono)' }}>{t.securedConnection}</span>
              <span className="h-[2.5px] flex-1 bg-[var(--z-ink)]" />
            </div>

            <button type="button" onClick={() => window.location.assign('/api/auth/google')} className="z-btn z-btn--paper w-full">
              <svg className="h-4 w-4" viewBox="0 0 24 24"><path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" /><path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" /><path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" /><path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" /></svg>
              {t.google}
            </button>
          </form>

          <div className="mt-8 text-center">
            <button type="button" onClick={() => setMode(mode === 'login' ? 'signup' : 'login')} className="text-[14px] font-extrabold text-[var(--z-ink-2)] underline-offset-4 hover:text-[var(--z-red)] hover:underline">
              {mode === 'login' ? t.switchToRegister : t.switchToSignIn}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function AuthPage() {
  return (
    <Suspense fallback={<div className="zine min-h-dvh" />}>
      <AuthPageContent />
    </Suspense>
  );
}
