import type { Metadata } from 'next';
import Link from 'next/link';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { getPublicSiteUrl } from '@/lib/og-metadata';
import { staticPageMetadata } from '@/lib/seo/page-metadata';
import { LinkToUsCopyBlock } from '@/app/link-to-us/LinkToUsCopyBlock';

export const metadata: Metadata = staticPageMetadata({
  title: 'Press & partners — official linking kit for iComics.wiki',
  description:
    'Official URL, HTML snippets, and localized deep links (ui=) for citing iComics.wiki. Independent manga & manhwa browser library—not MangaDex.org, not the legacy iOS iComics file app.',
  path: '/link-to-us',
  localeAlternates: true,
});

export default function LinkToUsPage() {
  const site = getPublicSiteUrl().replace(/\/$/, '');

  const canonicalUrl = `${site}/`;
  const htmlDescriptive = `<a href="${canonicalUrl}">iComics.wiki — manga &amp; manhwa browser library</a>`;
  const htmlAccessible = `<a href="${canonicalUrl}" title="iComics.wiki — read manga &amp; manhwa in your browser">iComics.wiki</a>`;
  const htmlMinimal = `<a href="${canonicalUrl}" rel="noopener noreferrer">iComics.wiki</a>`;
  const markdownInline = `[iComics.wiki](${canonicalUrl})`;

  return (
    <>
      <Navbar />
      <main className="min-h-dvh bg-app pt-nav-catalog text-fg">
        <div className="wrap max-w-3xl py-14 sm:py-16 lg:max-w-4xl lg:py-20">
          <div className="flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-accent" />
            <span className="ic-eyebrow">Press · partnerships · directories</span>
          </div>

          <h1 className="ic-display mt-5 text-3xl text-fg sm:text-4xl md:text-5xl">
            Official linking kit
          </h1>
          <p className="mt-5 max-w-2xl text-sm leading-relaxed text-fg-secondary md:text-base">
            Use these assets when you cite or recommend <strong className="font-semibold text-fg">iComics.wiki</strong>.
            The site is an independent browser library for manga, manhwa, and vertical webtoons—it is{' '}
            <span className="whitespace-nowrap">not MangaDex.org</span>, not the discontinued DRM iOS “iComics” comic file
            manager, and not unrelated Fan wikis.
          </p>
          <p className="mt-3 text-xs leading-relaxed text-fg-muted">
            Partnerships or corrections:{' '}
            <a
              href="mailto:info@icomics.wiki?subject=iComics.wiki%20—%20link%20%2F%20press"
              className="font-medium text-accent-text underline decoration-line underline-offset-4 hover:decoration-accent"
            >
              info@icomics.wiki
            </a>
            . For branding context see{' '}
            <Link href="/icomics-wiki" className="font-medium text-accent-text underline decoration-line underline-offset-4 hover:decoration-accent">
              /icomics-wiki
            </Link>
            .
          </p>

          <div className="mt-12 space-y-6">
            <LinkToUsCopyBlock
              id="snippet-canonical"
              title="Canonical URL"
              description="Best default when a plain link is enough (no tracking parameters on our side)."
              code={canonicalUrl}
              copyLabel="Copy URL"
              copiedLabel="Copied"
            />
            <LinkToUsCopyBlock
              id="snippet-html-desc"
              title="HTML — descriptive anchor"
              description="Clear for readers; adjust wording if your style guide prefers shorter labels."
              code={htmlDescriptive}
              copyLabel="Copy HTML"
              copiedLabel="Copied"
            />
            <LinkToUsCopyBlock
              id="snippet-html-a11y"
              title="HTML — accessible short anchor"
              description="Keeps visible text short while exposing a fuller label to assistive tech."
              code={htmlAccessible}
              copyLabel="Copy HTML"
              copiedLabel="Copied"
            />
            <LinkToUsCopyBlock
              id="snippet-html-min"
              title="HTML — minimal + security attrs"
              description="Typical for blog sidebars. Change rel if your policy requires nofollow or sponsored."
              code={htmlMinimal}
              copyLabel="Copy HTML"
              copiedLabel="Copied"
            />
            <LinkToUsCopyBlock
              id="snippet-md"
              title="Markdown"
              description="For README files, wikis, or static generators."
              code={markdownInline}
              copyLabel="Copy Markdown"
              copiedLabel="Copied"
            />
          </div>

          <section
            className="mt-14 rounded-card border border-line bg-card p-6 sm:p-8"
            aria-labelledby="localized-v1"
          >
            <h2 id="localized-v1" className="ic-eyebrow">
              Localized interface (SEO hreflang)
            </h2>
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-fg-secondary">
              Appending <code className="rounded-md bg-inset px-1.5 py-0.5 font-mono text-[11px]">?ui=</code> to
              any path sets the UI language for that visit and matches our{' '}
              <code className="rounded-md bg-inset px-1.5 py-0.5 font-mono text-[11px]">hreflang</code> alternates.
              Example library entry in Korean:
            </p>
            <p className="mt-4 font-mono text-[11px] text-fg sm:text-xs">
              {`${site}/library?ui=ko`}
            </p>
            <div className="mt-6 overflow-x-auto rounded-card border border-line">
              <table className="w-full min-w-[280px] border-collapse text-left text-[11px] sm:text-xs">
                <caption className="sr-only">Supported ui parameter values</caption>
                <thead>
                  <tr className="border-b border-line bg-sunken">
                    <th scope="col" className="ic-eyebrow px-4 py-3">
                      ui=
                    </th>
                    <th scope="col" className="ic-eyebrow px-4 py-3">
                      Interface
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line-subtle">
                  {[
                    ['en', 'English'],
                    ['ja', 'Japanese'],
                    ['ko', 'Korean'],
                    ['zh', 'Chinese (Simplified)'],
                    ['ru', 'Russian'],
                  ].map(([code, label]) => (
                    <tr key={code}>
                      <td className="px-4 py-3 font-mono font-medium text-fg">{code}</td>
                      <td className="px-4 py-3 text-fg-secondary">{label}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="mt-10 border-t border-line pt-10">
            <h2 className="ic-eyebrow">
              Optional logo
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-fg-secondary">
              Square mark:{' '}
              <a
                href={`${site}/logo.png`}
                className="font-medium text-accent-text underline decoration-line underline-offset-4 hover:decoration-accent"
              >
                {site}/logo.png
              </a>{' '}
              (512×512). Do not crop into misleading badges or imply endorsement by third-party catalogs.
            </p>
          </section>
        </div>
      </main>
      <Footer />
    </>
  );
}
