'use client';

/**
 * Profile — the reader's account "card", rebuilt from zero in the Bold Pop Zine language.
 * Reuses ONLY the data layer (/api/profile GET+PUT, logout). No JSX from the old profile page.
 */

import { useCallback, useEffect, useState, useRef, type ChangeEvent, type FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { LogOut, Home, User, Loader2 } from 'lucide-react';
import ZineNav from '@/components/zine/ZineNav';
import ZineFooter from '@/components/zine/ZineFooter';
import { translations, Lang } from '@/lib/translations';
import { readStorageItem } from '@/lib/browser-storage';

type ProfileUser = {
  id: string; firstName: string; lastName: string; username: string;
  email?: string | null; avatar?: string | null; authProvider: string;
  authProviderId?: string | null; createdAt: string; hasPassword: boolean;
  _count: { reading: number; completed: number };
};

const INPUT = 'w-full rounded-[7px] border-[2.5px] border-[var(--z-ink)] bg-[var(--z-card)] px-4 py-3 text-[15px] font-bold text-[var(--z-ink)] shadow-[3px_3px_0_var(--z-ink)] placeholder:font-normal placeholder:text-[var(--z-ink-2)] focus:outline-none focus:-translate-y-0.5 transition-transform';
const LABEL = 'mb-2 block text-[12px] font-extrabold uppercase tracking-wide text-[var(--z-ink-2)]';

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
  const [form, setForm] = useState({ firstName: '', lastName: '', username: '', email: '', password: '' });

  useEffect(() => { langRef.current = lang; }, [lang]);

  useEffect(() => {
    const savedLang = readStorageItem('lang') as Lang;
    if (savedLang && translations[savedLang]) setLang(savedLang);
    const handleLang = (e: Event) => setLang((e as CustomEvent<Lang>).detail);
    window.addEventListener('langChange', handleLang as EventListener);
    return () => window.removeEventListener('langChange', handleLang as EventListener);
  }, []);

  const loadProfile = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const res = await fetch('/api/profile');
      if (res.status === 401) { router.replace('/auth'); return; }
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || translations[langRef.current].profile.loadFailedMsg);
      setUser(data.user);
      setForm({ firstName: data.user.firstName || '', lastName: data.user.lastName || '', username: data.user.username || '', email: data.user.email || '', password: '' });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : translations[langRef.current].profile.loadFailedMsg);
    } finally { setLoading(false); }
  }, [router]);

  useEffect(() => { void loadProfile(); }, [loadProfile]);

  const handleChange = (key: keyof typeof form) => (e: ChangeEvent<HTMLInputElement>) => setForm((c) => ({ ...c, [key]: e.target.value }));

  const handleSave = async (e: FormEvent) => {
    e.preventDefault(); setSaving(true); setError(''); setSuccess('');
    try {
      const res = await fetch('/api/profile', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || translations[langRef.current].profile.saveFailedMsg);
      setUser(data.user);
      setForm((c) => ({ ...c, password: '' }));
      setSuccess(translations[langRef.current].profile.profileUpdated);
      router.refresh();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : translations[langRef.current].profile.saveFailedMsg);
    } finally { setSaving(false); }
  };

  const logout = async () => { const res = await fetch('/api/auth/logout', { method: 'POST' }); if (res.ok) router.push('/'); };

  return (
    <div className="zine min-h-dvh">
      <ZineNav />

      <main id="main-content" tabIndex={-1} className="z-wrap py-12">
        {/* masthead */}
        <div className="mb-10 flex flex-wrap items-center gap-6">
          <div className="z-box grid h-28 w-28 shrink-0 place-items-center overflow-hidden !shadow-[6px_6px_0_var(--z-ink)]" style={{ background: 'var(--z-yellow)' }}>
            {user?.avatar ? <img src={user.avatar} alt={user.username} className="h-full w-full object-cover" /> : <User size={44} strokeWidth={2.5} />}
          </div>
          <div>
            <span className="z-tag z-tag--red">{t.badge}</span>
            <h1 className="z-display mt-3 text-[clamp(2.6rem,7vw,5rem)] leading-[0.82]">
              {user ? `${user.firstName || user.username}` : t.titleLine1}
            </h1>
            {user ? <p className="mt-1 text-[15px] font-bold text-[var(--z-ink-2)]">@{user.username}</p> : null}
          </div>
        </div>

        {loading ? (
          <div className="flex items-center gap-3"><Loader2 className="h-6 w-6 animate-spin" /><span className="z-tag z-tag--yellow">Loading…</span></div>
        ) : user ? (
          <div className="grid gap-10 lg:grid-cols-[1fr_360px]">
            {/* edit form */}
            <form onSubmit={handleSave}>
              <h2 className="z-display -rotate-1 mb-5 inline-block border-[3px] border-[var(--z-ink)] bg-[var(--z-blue)] px-3 py-1 text-[1.8rem] leading-[0.82] text-[var(--z-paper)] shadow-[4px_4px_0_var(--z-ink)]">{t.sectionEdit}</h2>
              <div className="z-box space-y-5 p-6 sm:p-8">
                <div className="grid gap-5 sm:grid-cols-2">
                  <div><label className={LABEL}>{t.labelFirstName}</label><input value={form.firstName} onChange={handleChange('firstName')} className={INPUT} /></div>
                  <div><label className={LABEL}>{t.labelLastName}</label><input value={form.lastName} onChange={handleChange('lastName')} className={INPUT} /></div>
                </div>
                <div className="grid gap-5 sm:grid-cols-2">
                  <div><label className={LABEL}>{t.labelUsername}</label><input value={form.username} onChange={handleChange('username')} className={INPUT} /></div>
                  <div><label className={LABEL}>{t.labelEmail}</label><input value={form.email} onChange={handleChange('email')} className={INPUT} placeholder={t.placeholderEmail} /></div>
                </div>
                <div>
                  <label className={LABEL}>{t.passwordLabelFull} {user.hasPassword ? t.passwordChange : t.passwordSet}</label>
                  <input type="password" value={form.password} onChange={handleChange('password')} className={INPUT} placeholder="••••••••" />
                </div>
                {error ? <div className="rounded-[7px] border-[2.5px] border-[var(--z-red)] bg-[color-mix(in_oklab,var(--z-red)_15%,var(--z-card))] p-3 text-center text-[14px] font-bold text-[var(--z-red)]">{t.errorPrefix}: {error}</div> : null}
                {success ? <div className="rounded-[7px] border-[2.5px] border-[var(--z-green)] bg-[color-mix(in_oklab,var(--z-green)_15%,var(--z-card))] p-3 text-center text-[14px] font-bold text-[var(--z-green)]">{t.successPrefix}: {success}</div> : null}
                <button type="submit" disabled={saving} className="z-btn z-btn--red w-full text-[16px]" style={saving ? { opacity: 0.6 } : undefined}>
                  {saving ? <><Loader2 className="h-4 w-4 animate-spin" /> {t.saving}</> : t.saveProfile}
                </button>
              </div>
            </form>

            {/* side */}
            <aside className="space-y-8">
              {/* stats */}
              <div className="grid grid-cols-2 gap-4">
                <div className="z-box p-5 text-center" style={{ background: 'var(--z-pink)' }}>
                  <div className="z-display text-[3rem] leading-none text-[var(--z-ink)]">{user._count?.reading ?? 0}</div>
                  <div className="z-kicker mt-1 text-[var(--z-ink)]">{t.reading}</div>
                </div>
                <div className="z-box p-5 text-center" style={{ background: 'var(--z-green)' }}>
                  <div className="z-display text-[3rem] leading-none text-[var(--z-paper)]">{user._count?.completed ?? 0}</div>
                  <div className="z-kicker mt-1 text-[var(--z-paper)]">{t.completed}</div>
                </div>
              </div>

              {/* account facts */}
              <div className="z-box p-6">
                <h3 className="z-kicker mb-4 text-[var(--z-ink-2)]">{t.signInMethods}</h3>
                <div className="space-y-3">
                  <Row label={t.google} on={Boolean(user.authProviderId)} onText={t.enabled} offText={t.disconnected} />
                  <Row label={t.passwordShort} on={user.hasPassword} onText={t.active} offText={t.unset} />
                </div>
                <hr className="z-rule my-5" />
                <div className="space-y-2 text-[13px] font-bold text-[var(--z-ink-2)]">
                  <div className="flex justify-between gap-3"><span className="uppercase">{t.joined}</span><span>{new Date(user.createdAt).toLocaleDateString(lang === 'ru' ? 'ru-RU' : 'en-US')}</span></div>
                  <div className="flex items-start justify-between gap-3"><span className="uppercase">{t.accountId}</span><span className="break-all text-right" style={{ fontFamily: 'var(--font-zine-mono)', fontSize: 11 }}>{user.id}</span></div>
                </div>
              </div>

              <div className="grid gap-3">
                <Link href="/" className="z-btn z-btn--paper w-full"><Home size={16} strokeWidth={2.5} /> {t.backHome}</Link>
                <button type="button" onClick={logout} className="z-btn z-btn--blue w-full"><LogOut size={16} strokeWidth={2.5} /> {t.logOut}</button>
              </div>
            </aside>
          </div>
        ) : (
          <div className="z-box grid place-items-center p-12 text-center">
            <h3 className="z-display text-[2rem]">{t.couldntLoad}</h3>
            {error ? <p className="mt-2 text-[14px] font-bold text-[var(--z-red)]">{error}</p> : null}
            <button type="button" onClick={() => void loadProfile()} className="z-btn z-btn--red z-btn--sm mt-5">{t.tryAgain}</button>
          </div>
        )}
      </main>

      <ZineFooter />
    </div>
  );
}

function Row({ label, on, onText, offText }: { label: string; on: boolean; onText: string; offText: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-[14px] font-extrabold text-[var(--z-ink)]">{label}</span>
      <span className="z-tag" style={{ background: on ? 'var(--z-green)' : 'var(--z-card)', color: on ? '#fff' : 'var(--z-ink-2)' }}>{on ? onText : offText}</span>
    </div>
  );
}
