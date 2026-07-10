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
    description: "Explore manga, manhwa, adult‑gated catalogs, and webtoon archives.",
  },
  {
    href: "/reading",
    label: "Reading hub",
    description:
      "Guides for manga/manhwa/webtoon formats, fullscreen browser tips, RSS & FAQs on iComics.wiki.",
  },
];

export default function NotFound() {
  return (
    <main id="main-content" tabIndex={-1} className="flex min-h-[calc(100vh-2rem)] items-center justify-center bg-app px-4 py-24 text-fg">
      <section className="w-full max-w-2xl">
        <p className="ic-eyebrow">Error 404 · page not found</p>

        <p className="ic-display mt-6 text-7xl text-fg-muted md:text-8xl" aria-hidden="true">
          404
        </p>

        <div className="mt-6 max-w-xl space-y-4">
          <h1 className="ic-display text-balance text-3xl text-fg md:text-4xl">
            This chapter slipped out of the archive.
          </h1>
          <p className="text-sm leading-relaxed text-fg-secondary md:text-base">
            The link you opened does not exist in our comic universe, but the library,
            reading hub, and homepage are still here. Let&apos;s get you back on track.
          </p>
        </div>

        <div className="mt-8 flex flex-wrap gap-3">
          <Link href="/" className="ic-btn ic-btn--primary ic-btn--md">
            Return home
          </Link>
          <Link href="/library" className="ic-btn ic-btn--secondary ic-btn--md">
            Browse library
          </Link>
        </div>

        <hr className="ic-rule mt-10" />

        <div className="mt-8 grid gap-3 sm:grid-cols-3">
          {quickLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="rounded-card border border-line bg-card p-4 transition-colors duration-150 hover:border-line-strong hover:bg-card-hov"
            >
              <p className="text-sm font-semibold text-fg">{link.label}</p>
              <p className="mt-2 text-xs leading-relaxed text-fg-muted">
                {link.description}
              </p>
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}
