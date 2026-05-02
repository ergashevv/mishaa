'use client';

import { useEffect, useState, type ChangeEvent, type FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Navbar from '@/components/Navbar';

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
    stories: number;
    characters: number;
  };
};

export default function ProfilePage() {
  const router = useRouter();
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
    const loadProfile = async () => {
      try {
        const res = await fetch('/api/profile');
        if (res.status === 401) {
          router.replace('/auth');
          return;
        }

        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to load profile');

        setUser(data.user);
        setForm({
          firstName: data.user.firstName || '',
          lastName: data.user.lastName || '',
          username: data.user.username || '',
          email: data.user.email || '',
          password: '',
        });
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Failed to load profile');
      } finally {
        setLoading(false);
      }
    };

    void loadProfile();
  }, [router]);

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
      if (!res.ok) throw new Error(data.error || 'Failed to save profile');

      setUser(data.user);
      setForm((current) => ({ ...current, password: '' }));
      setSuccess('Profile updated successfully');
      router.refresh();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to save profile');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#fcfaf2] text-[#111111] halftone-bg overflow-x-hidden">
      <div className="noise-overlay" />
      <div className="paper-grain" />
      <Navbar />

      <main className="container mx-auto px-6 pt-40 pb-24">
        <div className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr]">
          <section className="studio-panel bg-white p-8 md:p-12 shadow-[0_24px_80px_rgba(0,0,0,0.08)]">
            <div className="inline-block bg-[#e63946] px-4 py-1 border-2 border-black mb-6">
              <span className="text-white text-[9px] font-black uppercase tracking-widest">Profile Control</span>
            </div>
            <h1 className="text-5xl md:text-7xl font-display uppercase tracking-tighter leading-none mb-4">
              Your Account
            </h1>
            <p className="text-black/60 max-w-2xl text-lg leading-relaxed">
              Manage your avatar, username, email, and password. If you connect Google and password login to the same email, both sign-in methods can point to one account.
            </p>

            {loading ? (
              <div className="mt-10 h-64 animate-pulse bg-black/5 border-2 border-black/10" />
            ) : user ? (
              <div className="mt-10 grid gap-6 md:grid-cols-[220px_1fr] items-start">
                <div className="bg-[#111111] text-white p-6 border-2 border-black shadow-[8px_8px_0_#111]">
                  <div className="aspect-square bg-white overflow-hidden border-2 border-white/10">
                    <img
                      src={user.avatar || '/logo.png'}
                      alt={`${user.firstName} ${user.lastName}`}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="mt-4 space-y-2">
                    <p className="text-[10px] uppercase tracking-[0.4em] text-white/40">User ID</p>
                    <p className="text-xs break-all font-mono">{user.id}</p>
                  </div>
                </div>

                <form onSubmit={handleSave} className="space-y-5">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <label className="space-y-2">
                      <span className="text-[9px] font-black uppercase tracking-[0.4em] text-black/40">First name</span>
                      <input
                        value={form.firstName}
                        onChange={handleChange('firstName')}
                        className="w-full border-2 border-black px-4 py-3 bg-white font-black uppercase"
                      />
                    </label>
                    <label className="space-y-2">
                      <span className="text-[9px] font-black uppercase tracking-[0.4em] text-black/40">Last name</span>
                      <input
                        value={form.lastName}
                        onChange={handleChange('lastName')}
                        className="w-full border-2 border-black px-4 py-3 bg-white font-black uppercase"
                      />
                    </label>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <label className="space-y-2">
                      <span className="text-[9px] font-black uppercase tracking-[0.4em] text-black/40">Unique username</span>
                      <input
                        value={form.username}
                        onChange={handleChange('username')}
                        className="w-full border-2 border-black px-4 py-3 bg-white font-black uppercase"
                      />
                    </label>
                    <label className="space-y-2">
                      <span className="text-[9px] font-black uppercase tracking-[0.4em] text-black/40">Email</span>
                      <input
                        value={form.email}
                        onChange={handleChange('email')}
                        className="w-full border-2 border-black px-4 py-3 bg-white font-black"
                        placeholder="optional, but useful for account linking"
                      />
                    </label>
                  </div>

                  <label className="space-y-2 block">
                    <span className="text-[9px] font-black uppercase tracking-[0.4em] text-black/40">
                      Password {user.hasPassword ? '(change or leave empty)' : '(set one now)'}
                    </span>
                    <input
                      type="password"
                      value={form.password}
                      onChange={handleChange('password')}
                      className="w-full border-2 border-black px-4 py-3 bg-white font-black"
                      placeholder={user.hasPassword ? '••••••••' : 'Create a password'}
                    />
                  </label>

                  {error && (
                    <div className="px-4 py-3 bg-[#ff4d00]/10 border border-[#ff4d00]/20 text-[#ff4d00] text-[10px] font-black uppercase tracking-widest">
                      {error}
                    </div>
                  )}

                  {success && (
                    <div className="px-4 py-3 bg-[#16a34a]/10 border border-[#16a34a]/20 text-[#16a34a] text-[10px] font-black uppercase tracking-widest">
                      {success}
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={saving}
                    className="inline-flex items-center gap-3 bg-[#111111] text-white px-6 py-4 font-black uppercase tracking-[0.3em] text-[10px] border-2 border-black shadow-[6px_6px_0_#e63946]"
                  >
                    {saving ? 'Saving...' : 'Save Profile'}
                  </button>
                </form>
              </div>
            ) : (
              <div className="mt-10">
                <p className="text-red-600 font-black uppercase tracking-widest">Unable to load profile</p>
              </div>
            )}
          </section>

          <aside className="space-y-6">
            <div className="bg-[#111111] text-white p-8 border-2 border-black shadow-[12px_12px_0_#ffca3a]">
              <p className="text-[9px] uppercase tracking-[0.5em] text-white/40 mb-4">Linked Methods</p>
              <div className="space-y-4 text-sm">
                <div className="flex items-center justify-between border-b border-white/10 pb-3">
                  <span>Google sign-in</span>
                  <span className={user?.authProviderId ? 'text-[#ffca3a] font-black uppercase' : 'text-white/30 font-black uppercase'}>
                    {user?.authProviderId ? 'Active' : 'Not linked'}
                  </span>
                </div>
                <div className="flex items-center justify-between border-b border-white/10 pb-3">
                  <span>Password sign-in</span>
                  <span className={user?.hasPassword ? 'text-[#16a34a] font-black uppercase' : 'text-white/30 font-black uppercase'}>
                    {user?.hasPassword ? 'Active' : 'Not set'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Username</span>
                  <span className="font-black">{user?.username || '---'}</span>
                </div>
              </div>
            </div>

            <div className="bg-white p-8 border-2 border-black">
              <p className="text-[9px] uppercase tracking-[0.5em] text-black/40 mb-4">Stats</p>
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 border-2 border-black">
                  <div className="text-3xl font-display">{user?._count.stories ?? 0}</div>
                  <div className="text-[10px] uppercase tracking-widest text-black/40">Stories</div>
                </div>
                <div className="p-4 border-2 border-black">
                  <div className="text-3xl font-display">{user?._count.characters ?? 0}</div>
                  <div className="text-[10px] uppercase tracking-widest text-black/40">Characters</div>
                </div>
              </div>
            </div>

            <div className="bg-[#f8f1e4] p-8 border-2 border-black">
              <p className="text-[9px] uppercase tracking-[0.5em] text-black/40 mb-4">Tip</p>
              <p className="text-sm leading-relaxed text-black/70">
                If you want the same person to use Google and password login, set the same email here. Google sign-in will then merge to this account on the next login.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-4">
              <Link href="/" className="flex-1 sm:flex-none">
                <button className="w-full bg-[#111111] text-white px-6 py-4 font-black uppercase tracking-[0.3em] text-[10px] border-2 border-black shadow-[6px_6px_0_#111] hover:translate-x-1 hover:translate-y-1 hover:shadow-none transition-all">
                  Back Home
                </button>
              </Link>
              <button 
                onClick={async () => {
                  const res = await fetch('/api/auth/logout', { method: 'POST' });
                  if (res.ok) router.push('/');
                }}
                className="flex-1 sm:flex-none bg-white text-red-600 px-6 py-4 font-black uppercase tracking-[0.3em] text-[10px] border-2 border-black shadow-[6px_6px_0_#e63946] hover:translate-x-1 hover:translate-y-1 hover:shadow-none transition-all"
              >
                Logout_Session
              </button>
            </div>
          </aside>
        </div>
      </main>
    </div>
  );
}
