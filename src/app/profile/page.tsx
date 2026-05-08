'use client';

import { useEffect, useState, type ChangeEvent, type FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
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
    <div className="min-h-screen bg-[#020202] text-white selection:bg-[#ff4d00] selection:text-white">
      <Navbar />

      <main className="container mx-auto px-4 sm:px-6 lg:px-8 pt-24 sm:pt-28 lg:pt-32 pb-20 sm:pb-28 lg:pb-32">
        <div className="max-w-6xl mx-auto grid gap-8 lg:gap-12 lg:grid-cols-[1fr_380px]">
          {/* Left Column: Form & Info */}
          <section className="space-y-8 sm:space-y-12">
            <div className="space-y-4 sm:space-y-6">
              <div className="inline-flex items-center gap-2 px-3 py-1 bg-[#ff4d00]/10 border border-[#ff4d00]/20 rounded-full">
                <span className="w-1.5 h-1.5 bg-[#ff4d00] rounded-full animate-pulse" />
                <span className="text-[#ff4d00] text-[10px] font-black uppercase tracking-[0.2em]">Your account</span>
              </div>
              <h1 className="text-4xl sm:text-6xl md:text-8xl font-black italic uppercase tracking-tighter leading-[0.85] text-balance">
                Profile<br/>
                <span className="text-[#ff4d00]">Settings</span>
              </h1>
              <p className="text-neutral-500 dark:text-white/40 max-w-xl text-sm font-medium leading-relaxed tracking-wide">
                Update how you appear on iComics.wiki and keep your login methods in sync across devices.
              </p>
            </div>

            {loading ? (
              <div className="space-y-8 animate-pulse">
                <div className="h-64 bg-black/[0.04] dark:bg-white/5 border border-neutral-200 dark:border-white/10 rounded-3xl" />
                <div className="h-96 bg-black/[0.04] dark:bg-white/5 border border-neutral-200 dark:border-white/10 rounded-3xl" />
              </div>
            ) : user ? (
              <div className="space-y-12">
                {/* Identity Card */}
                <div className="relative group">
                  <div className="absolute -inset-1 bg-gradient-to-r from-[#ff4d00] to-transparent opacity-20 blur-xl group-hover:opacity-40 transition-opacity" />
                <div className="relative grid md:grid-cols-[240px_1fr] bg-white/[0.03] border border-neutral-200 dark:border-white/10 rounded-3xl overflow-hidden backdrop-blur-xl">
                  <div className="aspect-square relative bg-[#0a0a0a] border-r border-neutral-200 dark:border-white/10 overflow-hidden">
                      <img
                        src={user.avatar || '/logo.png'}
                        alt={`${user.firstName} ${user.lastName}`}
                        className="w-full h-full object-cover grayscale opacity-80 group-hover:grayscale-0 group-hover:opacity-100 transition-all duration-700"
                      />
                      <div className="absolute bottom-4 left-4 right-4 py-2 px-3 bg-black/60 backdrop-blur-md border border-neutral-200 dark:border-white/10 text-[8px] font-black uppercase tracking-widest text-center">
                        Verified reader
                      </div>
                    </div>
                    <div className="p-6 sm:p-8 md:p-10 flex flex-col justify-between gap-6">
                      <div className="space-y-1">
                        <p className="text-[10px] font-black uppercase tracking-[0.4em] text-neutral-500 dark:text-white/30 italic">Account ID</p>
                        <p className="text-xl md:text-2xl font-black tracking-tighter text-white/90 break-all font-mono">{user.id}</p>
                      </div>
                      <div className="flex flex-col gap-4 sm:flex-row sm:gap-10">
                        <div>
                          <p className="text-[9px] font-black uppercase tracking-[0.3em] text-neutral-400 dark:text-white/20 mb-1">Joined</p>
                          <p className="text-xs font-black text-neutral-600 dark:text-white/60">{new Date(user.createdAt).toLocaleDateString()}</p>
                        </div>
                        <div>
                          <p className="text-[9px] font-black uppercase tracking-[0.3em] text-neutral-400 dark:text-white/20 mb-1">Security</p>
                          <p className="text-xs font-black text-[#ff4d00]">ENCRYPTED</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Settings Form */}
                <form onSubmit={handleSave} className="space-y-8 sm:space-y-10 p-6 sm:p-10 bg-white/[0.02] border border-neutral-100 dark:border-white/5 rounded-3xl">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-8">
                    <div className="space-y-2">
                      <label className="text-[9px] font-black uppercase tracking-[0.4em] text-neutral-500 dark:text-white/30 ml-1">First name</label>
                      <input
                        value={form.firstName}
                        onChange={handleChange('firstName')}
                        className="w-full bg-[#0a0a0a] border border-neutral-200 dark:border-white/10 rounded-2xl px-5 py-4 text-sm font-black uppercase tracking-widest text-white focus:border-[#ff4d00] focus:ring-1 focus:ring-[#ff4d00] transition-all outline-none"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[9px] font-black uppercase tracking-[0.4em] text-neutral-500 dark:text-white/30 ml-1">Last name</label>
                      <input
                        value={form.lastName}
                        onChange={handleChange('lastName')}
                        className="w-full bg-[#0a0a0a] border border-neutral-200 dark:border-white/10 rounded-2xl px-5 py-4 text-sm font-black uppercase tracking-widest text-white focus:border-[#ff4d00] focus:ring-1 focus:ring-[#ff4d00] transition-all outline-none"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-8">
                    <div className="space-y-2">
                      <label className="text-[9px] font-black uppercase tracking-[0.4em] text-neutral-500 dark:text-white/30 ml-1">Username</label>
                      <input
                        value={form.username}
                        onChange={handleChange('username')}
                        className="w-full bg-[#0a0a0a] border border-neutral-200 dark:border-white/10 rounded-2xl px-5 py-4 text-sm font-black uppercase tracking-widest text-white focus:border-[#ff4d00] focus:ring-1 focus:ring-[#ff4d00] transition-all outline-none"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[9px] font-black uppercase tracking-[0.4em] text-neutral-500 dark:text-white/30 ml-1">Email</label>
                      <input
                        value={form.email}
                        onChange={handleChange('email')}
                        className="w-full bg-[#0a0a0a] border border-neutral-200 dark:border-white/10 rounded-2xl px-5 py-4 text-sm font-black text-neutral-800 dark:text-white/80 focus:border-[#ff4d00] focus:ring-1 focus:ring-[#ff4d00] transition-all outline-none"
                        placeholder="Link email for recovery"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[9px] font-black uppercase tracking-[0.4em] text-neutral-500 dark:text-white/30 ml-1">
                      Password {user.hasPassword ? '(change)' : '(set)'}
                    </label>
                    <input
                      type="password"
                      value={form.password}
                      onChange={handleChange('password')}
                      className="w-full bg-[#0a0a0a] border border-neutral-200 dark:border-white/10 rounded-2xl px-5 py-4 text-sm font-black tracking-[0.5em] text-white focus:border-[#ff4d00] focus:ring-1 focus:ring-[#ff4d00] transition-all outline-none"
                      placeholder="••••••••"
                    />
                  </div>

                  {error && (
                    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="p-4 bg-[#ff4d00]/10 border border-[#ff4d00]/20 text-[#ff4d00] text-[10px] font-black uppercase tracking-widest text-center">
                      Error: {error}
                    </motion.div>
                  )}

                  {success && (
                    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="p-4 bg-[#16a34a]/10 border border-[#16a34a]/20 text-[#16a34a] text-[10px] font-black uppercase tracking-widest text-center">
                      Success: {success}
                    </motion.div>
                  )}

                  <button
                    type="submit"
                    disabled={saving}
                    className="w-full relative group py-5 bg-white text-black font-black uppercase tracking-[0.4em] text-[11px] overflow-hidden transition-all hover:bg-[#ff4d00] hover:text-neutral-900 dark:hover:text-white disabled:opacity-50"
                  >
                    <span className="relative z-10">{saving ? 'Saving…' : 'Save profile'}</span>
                  </button>
                </form>
              </div>
            ) : (
              <div className="p-8 sm:p-20 border border-neutral-100 dark:border-white/5 bg-white/[0.01] rounded-3xl flex flex-col items-center justify-center space-y-4">
                <p className="text-neutral-400 dark:text-white/20 font-black uppercase tracking-[0.5em] text-xs">Couldn&apos;t load profile</p>
                <button onClick={() => router.refresh()} className="text-[10px] font-black uppercase tracking-widest text-[#ff4d00]">Try again</button>
              </div>
            )}
          </section>

          {/* Right Column: Cards & Actions */}
          <aside className="space-y-8">
            <div className="bg-[#0a0a0a] p-6 sm:p-8 border border-neutral-200 dark:border-white/10 rounded-3xl space-y-6">
              <p className="text-[10px] font-black uppercase tracking-[0.5em] text-neutral-500 dark:text-white/30 italic">Sign-in methods</p>
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 bg-white/[0.02] border border-neutral-100 dark:border-white/5 rounded-2xl">
                  <span className="text-[10px] font-black uppercase text-neutral-500 dark:text-white/50 tracking-widest">Google</span>
                  <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded ${user?.authProviderId ? 'bg-[#ffca3a]/10 text-[#ffca3a] border border-[#ffca3a]/20' : 'bg-black/[0.04] dark:bg-white/5 text-neutral-400 dark:text-white/20'}`}>
                    {user?.authProviderId ? 'Enabled' : 'Disconnected'}
                  </span>
                </div>
                <div className="flex items-center justify-between p-4 bg-white/[0.02] border border-neutral-100 dark:border-white/5 rounded-2xl">
                  <span className="text-[10px] font-black uppercase text-neutral-500 dark:text-white/50 tracking-widest">Password</span>
                  <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded ${user?.hasPassword ? 'bg-[#16a34a]/10 text-[#16a34a] border border-[#16a34a]/20' : 'bg-black/[0.04] dark:bg-white/5 text-neutral-400 dark:text-white/20'}`}>
                    {user?.hasPassword ? 'Active' : 'Unset'}
                  </span>
                </div>
              </div>
            </div>

            <div className="bg-white/[0.02] p-6 sm:p-8 border border-neutral-100 dark:border-white/5 rounded-3xl space-y-6">
              <p className="text-[10px] font-black uppercase tracking-[0.5em] text-neutral-500 dark:text-white/30 italic">Your library</p>
              <div className="grid grid-cols-2 gap-4">
                <div className="p-5 bg-black border border-neutral-200 dark:border-white/10 rounded-2xl flex flex-col items-center justify-center space-y-1">
                  <div className="text-3xl font-black italic text-[#ff4d00]">{user?._count.stories ?? 0}</div>
                  <div className="text-[8px] font-black uppercase tracking-[0.2em] text-neutral-500 dark:text-white/40">Stories</div>
                </div>
                <div className="p-5 bg-black border border-neutral-200 dark:border-white/10 rounded-2xl flex flex-col items-center justify-center space-y-1">
                  <div className="text-3xl font-black italic text-white">{user?._count.characters ?? 0}</div>
                  <div className="text-[8px] font-black uppercase tracking-[0.2em] text-neutral-500 dark:text-white/40">Chars</div>
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-3">
              <Link href="/">
                <button className="w-full py-4 sm:py-5 bg-white/[0.05] border border-neutral-200 dark:border-white/10 text-white font-black uppercase tracking-[0.4em] text-[10px] hover:bg-white hover:text-black transition-all">
                  Back home
                </button>
              </Link>
              <button 
                onClick={async () => {
                  const res = await fetch('/api/auth/logout', { method: 'POST' });
                  if (res.ok) router.push('/');
                }}
                className="w-full py-4 sm:py-5 bg-[#ff4d00]/10 border border-[#ff4d00]/20 text-[#ff4d00] font-black uppercase tracking-[0.4em] text-[10px] hover:bg-[#ff4d00] hover:text-neutral-900 dark:hover:text-white transition-all"
              >
                Log out
              </button>
            </div>
          </aside>
        </div>
      </main>
    </div>
  );
}
