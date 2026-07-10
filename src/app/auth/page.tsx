'use client';

import { Suspense, useState, useEffect } from 'react';
import Image from 'next/image';
import { useRouter, useSearchParams } from 'next/navigation';
import { LazyMotion, domAnimation, m, AnimatePresence } from 'framer-motion';
import { Eye, EyeOff, ArrowRight, ShieldCheck, User, Lock, Globe } from 'lucide-react';
import Link from 'next/link';
import { translations, Lang } from '@/lib/translations';
import { readStorageItem } from '@/lib/browser-storage';

type Mode = 'login' | 'signup';

const AVATAR_STYLES = [
  'adventurer', 'avataaars', 'big-ears', 'bottts', 'croodles',
  'fun-emoji', 'icons', 'lorelei', 'micah', 'miniavs', 'thumbs'
];

type UrlAuthError = 'google_state_mismatch' | 'google_login_failed';

function AuthPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [mode, setMode] = useState<Mode>('login');
  const [loading, setLoading] = useState(false);
  const [urlAuthError, setUrlAuthError] = useState<UrlAuthError | null>(() => {
    const authError = searchParams.get('error');
    if (authError === 'google_state_mismatch') return 'google_state_mismatch';
    if (authError === 'google_login_failed') return 'google_login_failed';
    return null;
  });
  const [formError, setFormError] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [selectedAvatarStyle, setSelectedAvatarStyle] = useState('adventurer');
  const [lang, setLang] = useState<Lang>('en');

  const t = translations[lang].auth;

  useEffect(() => {
    let t_timeout: NodeJS.Timeout;
    // Load persisted language after mount to avoid hydration mismatch
    const savedLang = readStorageItem('lang') as Lang;
    if (savedLang && translations[savedLang]) {
      t_timeout = setTimeout(() => setLang(prev => (savedLang !== prev ? savedLang : prev)), 0);
    }
    const handleLang = (e: Event) => setLang((e as CustomEvent<Lang>).detail);
    window.addEventListener('langChange', handleLang as EventListener);
    return () => {
      window.removeEventListener('langChange', handleLang as EventListener);
      clearTimeout(t_timeout);
    };
  }, []);

  const displayError =
    formError ||
    (urlAuthError === 'google_state_mismatch'
      ? t.errGoogleState
      : urlAuthError === 'google_login_failed'
        ? t.errGoogleLogin
        : '');

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  const avatarUrl = username
    ? `https://api.dicebear.com/9.x/${selectedAvatarStyle}/svg?seed=${username}&backgroundColor=b6e3f4,c0aede,d1d4f9,ffd5dc,ffdfbf`
    : `https://api.dicebear.com/9.x/${selectedAvatarStyle}/svg?seed=icomics.wiki&backgroundColor=b6e3f4`;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    setUrlAuthError(null);
    setLoading(true);
    try {
      const endpoint = mode === 'login' ? '/api/auth/login' : '/api/auth/signup';
      const body = mode === 'login' 
        ? { username, password } 
        : { firstName, lastName, username, password, avatar: avatarUrl };
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || t.errAuthFailed);
      router.push('/');
      router.refresh();
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : t.errUnexpected);
    } finally {
      setLoading(false);
    }
  };

  const backLink = (
    <Link href="/" className="group inline-flex items-center gap-3 text-fg-muted transition-colors hover:text-fg">
      <span className="ic-iconbtn ic-iconbtn--sm ic-iconbtn--solid">
        <ArrowRight size={16} className="rotate-180" />
      </span>
      <span className="text-sm font-medium">{t.abortMission}</span>
    </Link>
  );

  return (
    <LazyMotion features={domAnimation} strict>
    <div className="min-h-dvh bg-app font-sans text-fg">
      <div className="grid min-h-dvh lg:grid-cols-[1.05fr_1fr]">
        {/* Editorial panel - the brand moment. Collapses away below lg; a compact
            header takes its place inside the form column instead. */}
        <div className="relative hidden flex-col justify-between overflow-hidden border-r border-line bg-surface px-14 py-12 lg:flex xl:px-20 xl:py-16">
          {backLink}

          <div className="max-w-md">
            <p className="ic-eyebrow">{t.studioAccess}</p>
            <h1 className="ic-display mt-5 text-5xl xl:text-6xl">
              {mode === 'login' ? t.titleLogin : t.titleSignup}
            </h1>
            <p className="mt-5 text-base leading-relaxed text-fg-secondary">
              {mode === 'login' ? t.subtitleLogin : t.subtitleSignup}
            </p>
          </div>

          {/* Decorative shelf: same gradient-plate language as cover placeholders
              elsewhere in the app, just without titles attached to them. */}
          <div className="mt-12 grid flex-1 max-h-[360px] grid-cols-2 gap-4" aria-hidden="true">
            <div className="ic-cover__poster col-span-2" style={{ ['--poster-h' as string]: 18, aspectRatio: '16 / 7' }} />
            <div className="ic-cover__poster" style={{ ['--poster-h' as string]: 268 }} />
            <div className="ic-cover__poster" style={{ ['--poster-h' as string]: 340 }} />
          </div>

          <div className="ic-eyebrow flex items-center gap-3">
            <ShieldCheck size={14} /> {t.footerEncrypted}
            <span className="h-1 w-1 rounded-full bg-line" />
            <Globe size={14} /> {t.footerGlobalUplink}
          </div>
        </div>

        {/* Form column */}
        <div className="flex flex-col justify-center px-6 py-12 sm:px-10 md:px-16 lg:px-14 xl:px-20">
          <div className="mb-8 flex items-center justify-between lg:hidden">
            {backLink}
          </div>

          <m.div
            initial={false}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.28, ease: [0.22, 0.61, 0.36, 1] }}
            className="mx-auto w-full max-w-[420px]"
          >
            <div className="mb-8 space-y-2 lg:hidden">
              <p className="ic-eyebrow">{t.studioAccess}</p>
              <h1 className="ic-display text-3xl">
                {mode === 'login' ? t.titleLogin : t.titleSignup}
              </h1>
              <p className="text-sm text-fg-secondary">
                {mode === 'login' ? t.subtitleLogin : t.subtitleSignup}
              </p>
            </div>

            {/* Mode Tabs */}
            <div className="ic-seg mb-8 flex w-full">
              <button
                onClick={() => setMode('login')}
                className={`ic-seg__opt flex-1 justify-center ${mode === 'login' ? 'is-active' : ''}`}
              >
                {t.tabSignIn}
              </button>
              <button
                onClick={() => setMode('signup')}
                className={`ic-seg__opt flex-1 justify-center ${mode === 'signup' ? 'is-active' : ''}`}
              >
                {t.tabRegister}
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              <AnimatePresence mode="wait">
                {mode === 'signup' && (
                  <m.div
                    key="signup"
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="space-y-5"
                  >
                    {/* Avatar Section */}
                    <div className="flex items-center gap-5 rounded-card border border-line bg-inset p-4">
                      <div className="w-14 h-14 rounded-cover border border-line bg-sunken overflow-hidden flex-shrink-0 relative">
                        <Image src={avatarUrl} alt="Avatar" fill unoptimized className="object-cover" />
                      </div>
                      <div className="flex-1">
                         <p className="ic-field__label mb-2">{t.avatarPrototype}</p>
                         <div className="flex flex-wrap gap-1.5">
                            {AVATAR_STYLES.slice(0, 5).map(style => (
                              <button
                                key={style}
                                type="button"
                                onClick={() => setSelectedAvatarStyle(style)}
                                className={`ic-tag ic-tag--interactive ${selectedAvatarStyle === style ? 'border-transparent bg-accent-tint text-accent-text' : ''}`}
                              >
                                {style.split('-')[0]}
                              </button>
                            ))}
                         </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="ic-field">
                         <label className="ic-field__label">{t.firstName}</label>
                         <input
                           type="text"
                           value={firstName}
                           onChange={e => setFirstName(e.target.value)}
                           placeholder={t.placeholderFirstDemo}
                           className="ic-input"
                         />
                      </div>
                      <div className="ic-field">
                         <label className="ic-field__label">{t.lastName}</label>
                         <input
                           type="text"
                           value={lastName}
                           onChange={e => setLastName(e.target.value)}
                           placeholder={t.placeholderLastDemo}
                           className="ic-input"
                         />
                      </div>
                    </div>
                  </m.div>
                )}
              </AnimatePresence>

              {/* Username/Alias */}
              <div className="ic-field">
                 <label className="ic-field__label">{t.labelUsernameAlias}</label>
                 <div className="ic-input-wrap has-icon">
                    <User size={18} />
                    <input
                      type="text"
                      value={username}
                      onChange={e => setUsername(e.target.value.toLowerCase())}
                      placeholder={t.placeholderUsername}
                      required
                      className="ic-input"
                    />
                 </div>
              </div>

              {/* Password */}
              <div className="ic-field">
                 <label className="ic-field__label">{t.accessKeyShort}</label>
                 <div className="ic-input-wrap has-icon">
                    <Lock size={18} />
                    <input
                      type={showPass ? 'text' : 'password'}
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      placeholder="••••••••"
                      required
                      className="ic-input pr-12!"
                    />
                    <button type="button" onClick={() => setShowPass(!showPass)} className="absolute right-4 top-1/2 -translate-y-1/2 text-fg-muted transition-colors hover:text-fg">
                      {showPass ? <EyeOff size={18}/> : <Eye size={18}/>}
                    </button>
                 </div>
              </div>

              {displayError && (
                <m.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="rounded-btn border border-line bg-inset p-4 text-center text-sm text-danger">
                  {t.errLabel}: {displayError}
                </m.div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="ic-btn ic-btn--primary ic-btn--lg ic-btn--block"
              >
                {loading
                  ? mode === 'login'
                    ? t.signingInEllipsis
                    : t.createAccountEllipsis
                  : mode === 'login'
                    ? t.signInSubmit
                    : t.createAccountSubmit}
              </button>

              <div className="relative py-4">
                 <div className="absolute inset-0 flex items-center"><div className="ic-rule w-full"></div></div>
                 <div className="relative flex justify-center">
                   <span className="ic-eyebrow bg-app px-3 lg:bg-card">{t.securedConnection}</span>
                 </div>
              </div>

              <button
                type="button"
                onClick={() => window.location.assign('/api/auth/google')}
                className="ic-btn ic-btn--secondary ic-btn--lg ic-btn--block"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24">
                  <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                  <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" />
                  <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                </svg>
                {t.google}
              </button>
            </form>

            <div className="mt-8 text-center">
              <button
                type="button"
                onClick={() => setMode(mode === 'login' ? 'signup' : 'login')}
                className="text-sm font-medium text-fg-muted transition-colors hover:text-accent-text"
              >
                {mode === 'login' ? t.switchToRegister : t.switchToSignIn}
              </button>
            </div>

            {/* Quiet footer note (mobile only - desktop shows it in the editorial panel) */}
            <div className="ic-eyebrow mt-10 flex items-center justify-center gap-3 lg:hidden">
               <ShieldCheck size={14}/> {t.footerEncrypted}
               <span className="h-1 w-1 rounded-full bg-line"></span>
               <Globe size={14}/> {t.footerGlobalUplink}
            </div>
          </m.div>
        </div>
      </div>
    </div>
    </LazyMotion>
  );
}

export default function AuthPage() {
  return (
    <Suspense fallback={<div className="min-h-dvh bg-app" />}>
      <AuthPageContent />
    </Suspense>
  );
}
