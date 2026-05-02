'use client';

import { Suspense, useState, useEffect } from 'react';
import Image from 'next/image';
import { useRouter, useSearchParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Eye, EyeOff, ArrowRight, ShieldCheck, User, Lock, Globe } from 'lucide-react';
import Link from 'next/link';
import { translations, Lang } from '@/lib/translations';
import { readStorageItem } from '@/lib/browser-storage';

type Mode = 'login' | 'signup';

const AVATAR_STYLES = [
  'adventurer', 'avataaars', 'big-ears', 'bottts', 'croodles',
  'fun-emoji', 'icons', 'lorelei', 'micah', 'miniavs', 'thumbs'
];

function AuthPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [mode, setMode] = useState<Mode>('login');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(() => {
    const authError = searchParams.get('error');
    if (authError === 'google_state_mismatch') return 'Google session expired. Please try again.';
    if (authError === 'google_login_failed') return 'Google sign-in failed.';
    return '';
  });
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
    window.addEventListener('langChange', handleLang);
    return () => {
      window.removeEventListener('langChange', handleLang);
      clearTimeout(t_timeout);
    };
  }, []);

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  const avatarUrl = username
    ? `https://api.dicebear.com/9.x/${selectedAvatarStyle}/svg?seed=${username}&backgroundColor=b6e3f4,c0aede,d1d4f9,ffd5dc,ffdfbf`
    : `https://api.dicebear.com/9.x/${selectedAvatarStyle}/svg?seed=icomics&backgroundColor=b6e3f4`;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
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
      if (!res.ok) throw new Error(data.error || 'Authentication failed');
      router.push('/');
      router.refresh();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#05060a] text-white flex flex-col items-center justify-center p-6 relative overflow-hidden font-sans">
      {/* Dynamic Background */}
      <div className="absolute inset-0 pointer-events-none">
         <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-[#ff5a1f]/10 blur-[120px] rounded-full" />
         <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-blue-500/10 blur-[120px] rounded-full" />
         <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-[0.03]" />
      </div>

      {/* Back Button */}
      <Link href="/" className="absolute top-8 left-8 flex items-center gap-3 text-white/40 hover:text-white transition-all group z-[100] scale-90 md:scale-100">
        <div className="w-10 h-10 rounded-full border border-white/10 flex items-center justify-center bg-white/5 backdrop-blur-md group-hover:border-white/30 transition-all">
          <ArrowRight size={16} className="rotate-180" />
        </div>
        <span className="text-[10px] font-black uppercase tracking-[0.3em]">{t.abortMission}</span>
      </Link>

      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        className="w-full max-w-[460px] z-10"
      >
        <div className="glass-panel border-white/10 bg-black/40 p-8 md:p-10 shadow-2xl rounded-[2.5rem] relative overflow-hidden">
          {/* Top Branding */}
          <div className="text-center mb-10 space-y-4">
            <motion.div 
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="inline-flex items-center justify-center w-16 h-16 bg-white rounded-2xl shadow-[0_0_40px_rgba(255,255,255,0.2)] mb-2"
            >
              <span className="text-3xl font-display font-black text-white">iC</span>
            </motion.div>
            <div className="space-y-1">
              <h1 className="text-4xl font-black uppercase tracking-tight text-white leading-none">
                {mode === 'login' ? 'Welcome Back' : 'Join the Studio'}
              </h1>
              <p className="text-sm text-white/40 font-medium">
                {mode === 'login' ? 'Sign in to access your creative uplink' : 'Create an account to start your narrative journey'}
              </p>
            </div>
          </div>

          {/* Mode Tabs */}
          <div className="flex p-1 bg-white/5 rounded-2xl mb-8 border border-white/10">
            <button
              onClick={() => setMode('login')}
              className={`flex-1 py-3 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all ${mode === 'login' ? 'bg-white text-white shadow-lg' : 'text-white/40 hover:text-white'}`}
            >
              Sign In
            </button>
            <button
              onClick={() => setMode('signup')}
              className={`flex-1 py-3 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all ${mode === 'signup' ? 'bg-white text-white shadow-lg' : 'text-white/40 hover:text-white'}`}
            >
              Register
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <AnimatePresence mode="wait">
              {mode === 'signup' && (
                <motion.div
                  key="signup"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="space-y-5"
                >
                  {/* Avatar Section */}
                  <div className="flex items-center gap-5 p-4 bg-white/5 rounded-2xl border border-white/5">
                    <div className="w-14 h-14 rounded-xl bg-black border border-white/10 overflow-hidden shadow-inner flex-shrink-0 relative">
                      <Image src={avatarUrl} alt="Avatar" fill className="object-cover" />
                    </div>
                    <div className="flex-1">
                       <p className="text-[9px] font-black uppercase tracking-widest text-white/30 mb-2">Avatar Prototype</p>
                       <div className="flex flex-wrap gap-1.5">
                          {AVATAR_STYLES.slice(0, 5).map(style => (
                            <button
                              key={style}
                              type="button"
                              onClick={() => setSelectedAvatarStyle(style)}
                              className={`px-2 py-1 text-[8px] font-black uppercase rounded-lg border transition-all ${selectedAvatarStyle === style ? 'bg-[#ff5a1f] border-transparent text-white' : 'border-white/10 text-white/40 hover:text-white'}`}
                            >
                              {style.split('-')[0]}
                            </button>
                          ))}
                       </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                       <label className="text-[10px] font-black uppercase tracking-widest text-white/30 ml-2">First Name</label>
                       <input 
                         type="text" 
                         value={firstName} 
                         onChange={e => setFirstName(e.target.value)} 
                         placeholder="John"
                         className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-sm focus:border-[#ff5a1f] outline-none transition-all"
                       />
                    </div>
                    <div className="space-y-2">
                       <label className="text-[10px] font-black uppercase tracking-widest text-white/30 ml-2">Last Name</label>
                       <input 
                         type="text" 
                         value={lastName} 
                         onChange={e => setLastName(e.target.value)} 
                         placeholder="Doe"
                         className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-sm focus:border-[#ff5a1f] outline-none transition-all"
                       />
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Username/Alias */}
            <div className="space-y-2">
               <label className="text-[10px] font-black uppercase tracking-widest text-white/30 ml-2">Username / Alias</label>
               <div className="relative group">
                  <User className="absolute left-4 top-1/2 -translate-y-1/2 text-white/20 group-focus-within:text-[#ff5a1f] transition-colors" size={18} />
                  <input 
                    type="text" 
                    value={username} 
                    onChange={e => setUsername(e.target.value.toLowerCase())} 
                    placeholder="creative_entity"
                    required
                    className="w-full bg-black/40 border border-white/10 rounded-xl pl-12 pr-4 py-4 text-sm focus:border-[#ff5a1f] outline-none transition-all"
                  />
               </div>
            </div>

            {/* Password */}
            <div className="space-y-2">
               <label className="text-[10px] font-black uppercase tracking-widest text-white/30 ml-2">Access Key</label>
               <div className="relative group">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-white/20 group-focus-within:text-[#ff5a1f] transition-colors" size={18} />
                  <input 
                    type={showPass ? 'text' : 'password'} 
                    value={password} 
                    onChange={e => setPassword(e.target.value)} 
                    placeholder="••••••••"
                    required
                    className="w-full bg-black/40 border border-white/10 rounded-xl pl-12 pr-12 py-4 text-sm focus:border-[#ff5a1f] outline-none transition-all"
                  />
                  <button type="button" onClick={() => setShowPass(!showPass)} className="absolute right-4 top-1/2 -translate-y-1/2 text-white/20 hover:text-white transition-colors">
                    {showPass ? <EyeOff size={18}/> : <Eye size={18}/>}
                  </button>
               </div>
            </div>

            {error && (
              <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} className="p-4 bg-red-500/10 border border-red-500/30 text-red-400 text-[11px] font-black uppercase tracking-widest rounded-xl text-center">
                System_Error: {error}
              </motion.div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-4 rounded-xl bg-white text-white text-[11px] font-black uppercase tracking-[0.2em] shadow-[0_0_30px_rgba(255,255,255,0.1)] hover:shadow-[0_0_30px_rgba(255,90,31,0.3)] hover:bg-[#ff5a1f] hover:text-white transition-all transform active:scale-[0.98] disabled:opacity-50"
            >
              {loading ? 'Authenticating...' : (mode === 'login' ? 'Establish Connection' : 'Initialize Account')}
            </button>

            <div className="relative py-4">
               <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-white/10"></div></div>
               <div className="relative flex justify-center text-[8px] font-black uppercase tracking-[0.4em] text-white/20">
                 <span className="bg-[#0b0c10] px-3">Protocol Security Active</span>
               </div>
            </div>

            <button
              type="button"
              onClick={() => window.location.assign('/api/auth/google')}
              className="w-full py-4 rounded-xl bg-white/5 border border-white/10 text-white text-[11px] font-black uppercase tracking-[0.15em] flex items-center justify-center gap-3 hover:bg-white/10 transition-all"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24">
                <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" />
                <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
              </svg>
              Continue with Google
            </button>
          </form>

          <div className="mt-8 text-center">
            <button
              type="button"
              onClick={() => setMode(mode === 'login' ? 'signup' : 'login')}
              className="text-[10px] font-black uppercase tracking-widest text-white/30 hover:text-[#ff5a1f] transition-all"
            >
              {mode === 'login' ? "Don't have an account? Register" : "Already have an account? Sign In"}
            </button>
          </div>
        </div>
      </motion.div>
      
      {/* Visual Accents */}
      <div className="mt-8 flex items-center gap-4 text-[9px] font-black uppercase tracking-[0.4em] text-white/10">
         <ShieldCheck size={14}/> Encrypted Session
         <span className="w-1 h-1 rounded-full bg-white/10"></span>
         <Globe size={14}/> Global Uplink
      </div>
    </div>
  );
}

export default function AuthPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#05060a]" />}>
      <AuthPageContent />
    </Suspense>
  );
}
