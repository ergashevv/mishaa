import Link from "next/link";

const quickLinks = [
  {
    href: "/",
    label: "Go home",
    description: "Return to the main feed and pick up from the front page.",
  },
  {
    href: "/library",
    label: "Browse library",
    description: "Explore manga, manhwa, Marvel, and webtoon archives.",
  },
  {
    href: "/studio",
    label: "Open studio",
    description: "Jump into the creation workspace and start a new panel run.",
  },
];

export default function NotFound() {
  return (
    <main className="relative flex min-h-[calc(100vh-2rem)] items-center justify-center overflow-hidden px-4 py-24">
      <div className="pointer-events-none absolute inset-0" aria-hidden="true">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(255,90,31,0.18),transparent_26%),radial-gradient(circle_at_top_right,rgba(115,247,255,0.12),transparent_20%),radial-gradient(circle_at_bottom,rgba(255,211,107,0.08),transparent_18%)]" />
        <div className="absolute left-1/2 top-1/2 h-[34rem] w-[34rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#ff5a1f]/12 blur-3xl" />
        <div className="absolute left-[12%] top-[18%] h-40 w-40 rounded-full border border-white/10 bg-white/[0.03] blur-[1px]" />
        <div className="absolute bottom-[18%] right-[10%] h-56 w-56 rounded-full border border-[#73f7ff]/15 bg-[#73f7ff]/5 blur-[1px]" />
        <div className="absolute inset-0 halftone-bg opacity-20" />
      </div>

      <section className="glass-panel relative z-10 w-full max-w-5xl overflow-hidden rounded-[2rem] border border-white/10 bg-white/[0.03] p-6 shadow-[0_30px_120px_rgba(0,0,0,0.65)] backdrop-blur-2xl md:p-10">
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/30 to-transparent" />
        <div className="absolute inset-y-0 left-0 w-px bg-gradient-to-b from-transparent via-white/10 to-transparent" />
        <div className="grid gap-10 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
          <div className="space-y-8">
            <div className="inline-flex items-center gap-3 rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-[9px] font-black uppercase tracking-[0.35em] text-white/55">
              <span className="h-2 w-2 rounded-full bg-[#ff5a1f]" />
              Lost page detected
            </div>

            <div className="space-y-5">
              <p className="font-accent text-[clamp(4rem,10vw,7rem)] leading-none tracking-[0.06em] text-white">
                404
              </p>
              <div className="max-w-2xl space-y-4">
                <h1 className="font-display text-3xl font-black uppercase leading-[0.9] tracking-[-0.04em] text-white md:text-5xl">
                  This chapter slipped out of the archive.
                </h1>
                <p className="max-w-xl text-sm leading-7 text-white/65 md:text-base">
                  The link you opened does not exist in our comic universe, but the library, studio,
                  and homepage are still here. Let&apos;s get you back on track.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap gap-3">
              <Link
                href="/"
                className="rounded-2xl border border-white/10 bg-white px-6 py-3 text-[10px] font-black uppercase tracking-[0.3em] text-black transition-all hover:bg-[#ff5a1f] hover:text-white"
              >
                Return home
              </Link>
              <Link
                href="/library"
                className="rounded-2xl border border-white/10 bg-white/[0.04] px-6 py-3 text-[10px] font-black uppercase tracking-[0.3em] text-white transition-all hover:border-white/20 hover:bg-white/10"
              >
                Browse library
              </Link>
            </div>
          </div>

          <div className="relative">
            <div className="absolute -left-6 top-8 h-24 w-24 rounded-full bg-[#ff5a1f]/20 blur-2xl" />
            <div className="absolute right-0 top-0 h-20 w-20 rounded-full bg-[#73f7ff]/10 blur-2xl" />

            <div className="relative overflow-hidden rounded-[1.75rem] border border-white/10 bg-[#090b10] p-5 shadow-2xl">
              <div className="absolute inset-0 opacity-40 halftone-bg" />
              <div className="relative space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-[9px] font-black uppercase tracking-[0.35em] text-white/35">
                    Recovery panel
                  </span>
                  <span className="rounded-full border border-[#ff5a1f]/30 bg-[#ff5a1f]/10 px-3 py-1 text-[9px] font-black uppercase tracking-[0.35em] text-[#ffb08f]">
                    Offline route
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-4">
                    <div className="mb-6 flex items-start justify-between">
                      <span className="text-[9px] font-black uppercase tracking-[0.3em] text-white/30">
                        Signal
                      </span>
                      <span className="text-[9px] font-black uppercase tracking-[0.3em] text-[#73f7ff]">
                        Strong
                      </span>
                    </div>
                    <div className="h-24 rounded-2xl border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.08),rgba(255,255,255,0.02))] p-3">
                      <div className="h-full rounded-xl border border-dashed border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(255,90,31,0.18),transparent_34%),radial-gradient(circle_at_bottom_right,rgba(115,247,255,0.15),transparent_30%)]" />
                    </div>
                  </div>

                  <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-4">
                    <div className="mb-6 flex items-start justify-between">
                      <span className="text-[9px] font-black uppercase tracking-[0.3em] text-white/30">
                        Navigator
                      </span>
                      <span className="text-[9px] font-black uppercase tracking-[0.3em] text-[#ffd36b]">
                        Ready
                      </span>
                    </div>
                    <div className="space-y-2">
                      {["Home", "Library", "Studio"].map((item) => (
                        <div
                          key={item}
                          className="flex items-center justify-between rounded-2xl border border-white/8 bg-black/20 px-3 py-2 text-[9px] font-black uppercase tracking-[0.28em] text-white/65"
                        >
                          <span>{item}</span>
                          <span className="h-2 w-2 rounded-full bg-[#ff5a1f]" />
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-3">
                  {quickLinks.map((link, index) => (
                    <Link
                      key={link.href}
                      href={link.href}
                      className="group rounded-3xl border border-white/10 bg-white/[0.03] p-4 transition-all hover:-translate-y-0.5 hover:border-white/20 hover:bg-white/[0.06]"
                    >
                      <div className="mb-3 flex items-center justify-between">
                        <span className="text-[9px] font-black uppercase tracking-[0.3em] text-white/35">
                          Route
                        </span>
                        <span className="text-[9px] font-black uppercase tracking-[0.3em] text-[#ff5a1f]">
                          0{index + 1}
                        </span>
                      </div>
                      <p className="text-sm font-black uppercase tracking-[0.18em] text-white transition-colors group-hover:text-[#ffd36b]">
                        {link.label}
                      </p>
                    </Link>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-8 grid gap-3 border-t border-white/8 pt-6 sm:grid-cols-3">
          {quickLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="rounded-2xl border border-white/8 bg-white/[0.02] p-4 transition-all hover:border-white/15 hover:bg-white/[0.05]"
            >
              <div className="flex items-center justify-between">
                <span className="text-[9px] font-black uppercase tracking-[0.3em] text-white/35">
                  Next step
                </span>
                <span className="text-[9px] font-black uppercase tracking-[0.3em] text-[#73f7ff]">
                  Go
                </span>
              </div>
              <p className="mt-3 text-sm font-black uppercase tracking-[0.18em] text-white">
                {link.label}
              </p>
              <p className="mt-2 text-xs leading-6 text-white/55">
                {link.description}
              </p>
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}
