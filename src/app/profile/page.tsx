'use client';

import { useCallback, useEffect, useState, useRef, type ChangeEvent, type FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { LazyMotion, domAnimation, m } from 'framer-motion';
import Navbar from '@/components/Navbar';
import { translations, Lang } from '@/lib/translations';
import { readStorageItem } from '@/lib/browser-storage';

type ProfileUser = {
  id: string;
  firstName: string;
  lastName: string;
  username: string;
  email?: string | null;
  avatar?: string | null;
  authProvider: string;
  authProviderId?: string | null;
  createdAt: string;
  hasPassword: boolean;
  _count: {
    reading: number;
    completed: number;
  };
};

export default function ProfilePage() {
  const router = useRouter();
  const [lang, setLang] = useState<Lang>('en');
  const langRef = useRef<Lang>('en');
  const t = translations[lang].profile;

  const [user, setUser] = useState<ProfileUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    username: '',
    email: '',
    password: '',
  });

  useEffect(() => {
    langRef.current = lang;
  }, [lang]);

  useEffect(() => {
    const savedLang = readStorageItem('lang') as Lang;
    const timer =
      savedLang && translations[savedLang]
        ? window.setTimeout(() => setLang((c) => (savedLang !== c ? savedLang : c)), 0)
        : undefined;
    const handleLang = (event: Event) => setLang((event as CustomEvent<Lang>).detail);
    window.addEventListener('langChange', handleLang as EventListener);
    return () => {
      window.removeEventListener('langChange', handleLang as EventListener);
      if (timer) window.clearTimeout(timer);
    };
  }, []);

  const loadProfile = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/profile');
      if (res.status === 401) {
        router.replace('/auth');
        return;
      }

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || translations[langRef.current].profile.loadFailedMsg);

      setUser(data.user);
      setForm({
        firstName: data.user.firstName || '',
        lastName: data.user.lastName || '',
        username: data.user.username || '',
        email: data.user.email || '',
        password: '',
      });
    } catch (err: unknown) {
      const p = translations[langRef.current].profile;
      setError(err instanceof Error ? err.message : p.loadFailedMsg);
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    void loadProfile();
  }, [loadProfile]);

  const handleChange = (key: keyof typeof form) => (event: ChangeEvent<HTMLInputElement>) => {
    setForm((current) => ({ ...current, [key]: event.target.value }));
  };

  const handleSave = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError('');
    setSuccess('');

    try {
      const res = await fetch('/api/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || translations[langRef.current].profile.saveFailedMsg);

      setUser(data.user);
      setForm((current) => ({ ...current, password: '' }));
      setSuccess(translations[langRef.current].profile.profileUpdated);
      router.refresh();
    } catch (err: unknown) {
      const p = translations[langRef.current].profile;
      setError(err instanceof Error ? err.message : p.saveFailedMsg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <LazyMotion features={domAnimation} strict>
    <div className="min-h-dvh bg-app text-fg">
      <Navbar />

      <main id="main-content" tabIndex={-1} className="pt-nav-catalog">
        <div className="wrap grid max-w-6xl gap-8 py-14 sm:py-16 lg:grid-cols-[1fr_380px] lg:gap-12 lg:py-20">
          {/* Left Column: Form & Info */}
          <section className="space-y-8 sm:space-y-10">
            <div className="space-y-4">
              <p className="ic-eyebrow">{t.badge}</p>
              <h1 className="ic-display text-balance text-4xl sm:text-5xl md:text-6xl">
                {t.titleLine1}
                <br />
                <span className="text-accent-text">{t.titleAccent}</span>
              </h1>
              <p className="max-w-xl text-sm leading-relaxed text-fg-secondary">{t.intro}</p>
            </div>

            {loading ? (
              <div className="space-y-8">
                <div className="sk h-64 rounded-card" />
                <div className="sk h-96 rounded-card" />
              </div>
            ) : user ? (
              <div className="space-y-10">
                {/* Identity Card */}
                <div className="grid overflow-hidden rounded-card border border-line bg-card md:grid-cols-[240px_1fr]">
                  <div className="relative aspect-square overflow-hidden border-r border-line bg-sunken">
                      <img
                        src={user.avatar || '/logo.png'}
                        alt={`${user.firstName} ${user.lastName}`}
                        className="h-full w-full object-cover"
                      />
                      <div className="absolute bottom-3 left-3 right-3 rounded-btn px-3 py-2 text-center backdrop-blur-sm" style={{ background: 'rgba(12, 11, 16, 0.62)' }}>
                        <span className="ic-eyebrow">{t.verifiedReader}</span>
                      </div>
                    </div>
                    <div className="flex flex-col justify-between gap-6 p-6 sm:p-8 md:p-10">
                      <div className="space-y-2">
                        <p className="ic-eyebrow">{t.accountId}</p>
                        <p className="break-all font-mono text-base text-fg sm:text-lg">{user.id}</p>
                      </div>
                      <div className="flex flex-col gap-4 sm:flex-row sm:gap-10">
                        <div>
                          <p className="ic-eyebrow mb-1">{t.joined}</p>
                          <p className="text-sm text-fg-secondary">{new Date(user.createdAt).toLocaleDateString(lang === 'ru' ? 'ru-RU' : 'en-US')}</p>
                        </div>
                        <div>
                          <p className="ic-eyebrow mb-1">{t.security}</p>
                          <p className="text-sm text-accent-text">{t.encryptedBadge}</p>
                        </div>
                      </div>
                    </div>
                </div>

                {/* Settings Form */}
                <form onSubmit={handleSave} className="space-y-6 rounded-card border border-line bg-card p-6 sm:p-10">
                  <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                    <div className="ic-field">
                      <label className="ic-field__label">{t.labelFirstName}</label>
                      <input
                        value={form.firstName}
                        onChange={handleChange('firstName')}
                        className="ic-input"
                      />
                    </div>
                    <div className="ic-field">
                      <label className="ic-field__label">{t.labelLastName}</label>
                      <input
                        value={form.lastName}
                        onChange={handleChange('lastName')}
                        className="ic-input"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                    <div className="ic-field">
                      <label className="ic-field__label">{t.labelUsername}</label>
                      <input
                        value={form.username}
                        onChange={handleChange('username')}
                        className="ic-input"
                      />
                    </div>
                    <div className="ic-field">
                      <label className="ic-field__label">{t.labelEmail}</label>
                      <input
                        value={form.email}
                        onChange={handleChange('email')}
                        className="ic-input"
                        placeholder={t.placeholderEmail}
                      />
                    </div>
                  </div>

                  <div className="ic-field">
                    <label className="ic-field__label">
                      {t.passwordLabelFull} {user.hasPassword ? t.passwordChange : t.passwordSet}
                    </label>
                    <input
                      type="password"
                      value={form.password}
                      onChange={handleChange('password')}
                      className="ic-input"
                      placeholder="••••••••"
                    />
                  </div>

                  {error && (
                    <m.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="rounded-btn border border-line bg-inset p-4 text-center text-sm text-danger">
                      {t.errorPrefix}: {error}
                    </m.div>
                  )}

                  {success && (
                    <m.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="rounded-btn border border-line bg-inset p-4 text-center text-sm text-success">
                      {t.successPrefix}: {success}
                    </m.div>
                  )}

                  <button
                    type="submit"
                    disabled={saving}
                    className="ic-btn ic-btn--primary ic-btn--lg ic-btn--block"
                  >
                    {saving ? t.saving : t.saveProfile}
                  </button>
                </form>
              </div>
            ) : (
              <div className="state-block">
                <p>{t.couldntLoad}</p>
                {error && <p className="text-sm text-danger">{error}</p>}
                <button type="button" onClick={() => void loadProfile()} className="ic-btn ic-btn--secondary ic-btn--sm">{t.tryAgain}</button>
              </div>
            )}
          </section>

          {/* Right Column: Cards & Actions */}
          <aside className="space-y-6">
            <div className="space-y-5 rounded-card border border-line bg-card p-6 sm:p-8">
              <p className="ic-eyebrow">{t.signInMethods}</p>
              <div className="space-y-3">
                <div className="flex items-center justify-between rounded-btn border border-line-subtle bg-inset p-4">
                  <span className="text-sm font-medium text-fg-secondary">{t.google}</span>
                  <span className={`ic-badge ${user?.authProviderId ? 'ic-badge--accent' : 'ic-badge--neutral'}`}>
                    {user?.authProviderId ? t.enabled : t.disconnected}
                  </span>
                </div>
                <div className="flex items-center justify-between rounded-btn border border-line-subtle bg-inset p-4">
                  <span className="text-sm font-medium text-fg-secondary">{t.passwordShort}</span>
                  <span className={`ic-badge ${user?.hasPassword ? 'ic-badge--success' : 'ic-badge--neutral'}`}>
                    {user?.hasPassword ? t.active : t.unset}
                  </span>
                </div>
              </div>
            </div>

            <div className="space-y-5 rounded-card border border-line bg-card p-6 sm:p-8">
              <p className="ic-eyebrow">{t.yourLibrary}</p>
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col items-center justify-center space-y-1 rounded-card border border-line-subtle bg-inset p-5">
                  <div className="ic-display text-4xl text-accent-text">{user?._count?.reading ?? 0}</div>
                  <div className="ic-eyebrow">{t.reading}</div>
                </div>
                <div className="flex flex-col items-center justify-center space-y-1 rounded-card border border-line-subtle bg-inset p-5">
                  <div className="ic-display text-4xl text-fg">{user?._count?.completed ?? 0}</div>
                  <div className="ic-eyebrow">{t.completed}</div>
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-3">
              <Link href="/">
                <button type="button" className="ic-btn ic-btn--secondary ic-btn--md ic-btn--block">
                  {t.backHome}
                </button>
              </Link>
              <button
                type="button"
                onClick={async () => {
                  const res = await fetch('/api/auth/logout', { method: 'POST' });
                  if (res.ok) router.push('/');
                }}
                className="ic-btn ic-btn--danger ic-btn--md ic-btn--block"
              >
                {t.logOut}
              </button>
            </div>
          </aside>
        </div>
      </main>
    </div>
    </LazyMotion>
  );
}
