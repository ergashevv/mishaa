'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Eye, EyeOff, AtSign, ArrowRight } from 'lucide-react';
import Link from 'next/link';
import { translations, Lang } from '@/lib/translations';

type Mode = 'login' | 'signup';

const AVATAR_STYLES = [
  'adventurer', 'avataaars', 'big-ears', 'bottts', 'croodles',
  'fun-emoji', 'icons', 'lorelei', 'micah', 'miniavs', 'thumbs'
];

export default function AuthPage() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>('login');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [selectedAvatarStyle, setSelectedAvatarStyle] = useState('adventurer');
  const [lang, setLang] = useState<Lang>('en');

  const t = translations[lang].auth;

  useEffect(() => {
    const savedLang = localStorage.getItem('lang') as Lang;
    if (savedLang && translations[savedLang]) setLang(savedLang);

    const handleLang = (e: any) => setLang(e.detail as Lang);
    window.addEventListener('langChange', handleLang);
    return () => window.removeEventListener('langChange', handleLang);
  }, []);

  // Form state
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
      if (!res.ok) throw new Error(data.error || 'Something went wrong');

      router.push('/');
      router.refresh();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  const switchMode = (m: Mode) => {
    setMode(m);
    setError('');
    setUsername('');
    setPassword('');
    setFirstName('');
    setLastName('');
  };

  return (
    <div className="min-h-screen bg-[#080808] text-white flex flex-col items-center justify-center relative overflow-y-auto py-24 px-4 selection:bg-[#ff4d00]/30 selection:text-white font-sans">
      <div className="absolute top-0 right-0 w-[60%] h-[60%] bg-[#ff4d00]/5 blur-[150px] pointer-events-none" />
      <div className="absolute inset-0 halftone-bg opacity-[0.05] pointer-events-none" />
      
      {/* Back home */}
      <Link href="/" className="absolute top-8 left-8 flex items-center gap-3 text-white/20 hover:text-[#ff4d00] transition-all group z-[100]">
        <div className="w-10 h-10 border border-white/10 flex items-center justify-center group-hover:bg-[#ff4d00] group-hover:text-white transition-all">
          <ArrowRight size={14} className="rotate-180" />
        </div>
        <span className="text-[10px] font-black uppercase tracking-[0.4em] hidden sm:block">{t.abortMission}</span>
      </Link>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-[500px] relative z-10 perspective-container"
      >
        {/* Card */}
        <div className="bg-black p-8 md:p-12 border-2 border-white/5 shadow-2xl relative perspective-card">
          {/* Industrial Corners */}
          <div className="absolute top-0 right-0 p-4 border-t border-r border-[#ff4d00]/20 w-16 h-16" />
          <div className="absolute bottom-0 left-0 p-4 border-b border-l border-[#ff4d00]/20 w-16 h-16" />

          <div className="flex flex-col items-center mb-8 text-center space-y-6">
            <Link href="/" className="relative group">
              <div className="w-12 h-12 bg-white p-2 rotate-[-4deg] group-hover:rotate-0 transition-transform">
                <img src="/logo.png" className="w-full h-full object-contain" alt="iComics" />
              </div>
            </Link>
            <div className="space-y-2">
              <h1 className="text-3xl md:text-4xl font-display uppercase tracking-[-0.04em] leading-none text-white">
                Studio <span className="text-[#ff4d00] italic font-light">{translations[lang].auth.studioAccess}</span>
              </h1>
              <div className="inline-block px-3 py-0.5 text-[#ff4d00] text-[8px] font-black uppercase tracking-[0.5em] border border-[#ff4d00]/20">
                {t.uplink}
              </div>
            </div>
          </div>

          {/* Mode switcher */}
          <div className="flex gap-0 mb-8 border border-white/5">
            {(['login', 'signup'] as Mode[]).map(m => (
              <button
                key={m}
                onClick={() => switchMode(m)}
                className={`flex-1 py-3 text-[9px] font-black uppercase tracking-[0.3em] transition-all ${mode === m ? 'bg-white text-black' : 'text-white/20 hover:text-white hover:bg-white/5'}`}
              >
                {m === 'login' ? t.establish : t.registry}
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <AnimatePresence mode="wait">
              {mode === 'signup' && (
                <motion.div
                  key="signup-fields"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="space-y-6"
                >
                  <div className="flex items-center gap-6 p-6 bg-white/[0.02] border border-white/5">
                    <div className="relative flex-shrink-0">
                      <div className="w-16 h-16 bg-black border-2 border-white/10 overflow-hidden rotate-2">
                        <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                      </div>
                    </div>
                    <div className="space-y-3">
                       <p className="text-[8px] font-black uppercase tracking-[0.3em] text-white/20">{t.labelStyle}:</p>
                       <div className="flex flex-wrap gap-2">
                          {AVATAR_STYLES.slice(0, 4).map(style => (
                            <button
                              key={style}
                              type="button"
                              onClick={() => setSelectedAvatarStyle(style)}
                              className={`px-2 py-1 text-[7px] font-black uppercase tracking-widest border transition-all ${selectedAvatarStyle === style ? 'bg-[#ff4d00] border-transparent text-white' : 'border-white/5 text-white/20 hover:text-white'}`}
                            >
                              {style.split('-')[0]}
                            </button>
                          ))}
                       </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-[9px] font-black uppercase tracking-[0.4em] text-white/20 ml-1">{t.firstName}</label>
                      <input
                        type="text"
                        value={firstName}
                        onChange={e => setFirstName(e.target.value)}
                        required={mode === 'signup'}
                        className="w-full bg-black border border-white/10 px-4 py-3 text-xs font-black text-white focus:outline-none focus:border-[#ff4d00] transition-all uppercase"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[9px] font-black uppercase tracking-[0.4em] text-white/20 ml-1">{t.lastName}</label>
                      <input
                        type="text"
                        value={lastName}
                        onChange={e => setLastName(e.target.value)}
                        required={mode === 'signup'}
                        className="w-full bg-black border border-white/10 px-4 py-3 text-xs font-black text-white focus:outline-none focus:border-[#ff4d00] transition-all uppercase"
                      />
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Username */}
            <div className="space-y-2">
              <label className="text-[9px] font-black uppercase tracking-[0.4em] text-white/20 ml-1">{t.alias}</label>
              <div className="relative">
                <AtSign size={14} className="absolute right-4 top-1/2 -translate-y-1/2 text-[#ff4d00]/40" />
                <input
                  type="text"
                  placeholder={t.usernamePlaceholder}
                  value={username}
                  onChange={e => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                  required
                  className="w-full bg-black border border-white/10 px-4 py-3.5 text-xs font-black text-white focus:outline-none focus:border-[#ff4d00] transition-all uppercase"
                />
              </div>
            </div>

            {/* Password */}
            <div className="space-y-2">
              <label className="text-[9px] font-black uppercase tracking-[0.4em] text-white/20 ml-1">{t.key}</label>
              <div className="relative">
                <input
                  type={showPass ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  className="w-full bg-black border border-white/10 px-4 py-3.5 text-xs font-black text-white focus:outline-none focus:border-[#ff4d00] transition-all uppercase"
                />
                <button
                  type="button"
                  onClick={() => setShowPass(!showPass)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-white/10 hover:text-[#ff4d00] transition-colors"
                >
                  {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {error && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="px-4 py-3 bg-[#ff4d00]/10 border border-[#ff4d00]/20 text-[#ff4d00] text-[9px] font-black uppercase tracking-widest text-center"
              >
                ERR: {error}
              </motion.div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full group relative"
            >
              <div className="absolute inset-0 border-2 border-[#ff4d00] translate-x-2 translate-y-2 group-hover:translate-x-0 group-hover:translate-y-0 transition-transform" />
              <div className="relative w-full h-full bg-white text-black py-4 font-black uppercase tracking-[0.3em] text-xs group-hover:bg-[#ff4d00] group-hover:text-white transition-colors flex items-center justify-center gap-4">
                {loading ? t.authenticating : (
                  <>
                    <span>{mode === 'login' ? t.establishUplink : t.initializeForge}</span>
                    <ArrowRight size={18} />
                  </>
                )}
              </div>
            </button>
          </form>

          <div className="mt-8 text-center">
            <button
              onClick={() => switchMode(mode === 'login' ? 'signup' : 'login')}
              className="text-[9px] font-black uppercase tracking-[0.5em] text-white/20 hover:text-[#ff4d00] transition-all border-b border-transparent hover:border-[#ff4d00]/30 pb-1"
            >
              {mode === 'login' ? t.requestRegistry : t.abortRegistry}
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
