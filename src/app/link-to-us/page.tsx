import type { Metadata } from 'next';
import Link from 'next/link';
import ZineNav from '@/components/zine/ZineNav';
import ZineFooter from '@/components/zine/ZineFooter';
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
    <div className="zine min-h-dvh">
      <ZineNav />
      <main id="main-content" tabIndex={-1} className="z-wrap max-w-4xl py-14">
        <span className="z-tag z-tag--red">Press · partnerships · directories</span>
        <h1 className="z-display mt-4 text-[clamp(2.4rem,6vw,4.5rem)] leading-[0.82]">Official linking kit</h1>
        <p className="mt-5 max-w-2xl text-[15px] font-semibold leading-relaxed text-[var(--z-ink-2)]">
          Use these assets when you cite or recommend <strong className="font-black text-[var(--z-ink)]">iComics.wiki</strong>. The site is an independent browser library for manga, manhwa, and vertical webtoons — it is not MangaDex.org, not the discontinued iOS &ldquo;iComics&rdquo; comic file manager, and not unrelated fan wikis.
        </p>
        <p className="mt-3 text-[13px] font-semibold text-[var(--z-ink-2)]">
          Partnerships or corrections: <a href="mailto:info@icomics.wiki?subject=iComics.wiki%20—%20link%20%2F%20press" className="font-black text-[var(--z-red)] underline underline-offset-4">info@icomics.wiki</a>. For branding context see <Link href="/icomics-wiki" className="font-black text-[var(--z-blue)] underline underline-offset-4">/icomics-wiki</Link>.
        </p>

        <div className="mt-12 space-y-6">
          <LinkToUsCopyBlock id="snippet-canonical" title="Canonical URL" description="Best default when a plain link is enough (no tracking parameters on our side)." code={canonicalUrl} copyLabel="Copy URL" copiedLabel="Copied" />
          <LinkToUsCopyBlock id="snippet-html-desc" title="HTML — descriptive anchor" description="Clear for readers; adjust wording if your style guide prefers shorter labels." code={htmlDescriptive} copyLabel="Copy HTML" copiedLabel="Copied" />
          <LinkToUsCopyBlock id="snippet-html-a11y" title="HTML — accessible short anchor" description="Keeps visible text short while exposing a fuller label to assistive tech." code={htmlAccessible} copyLabel="Copy HTML" copiedLabel="Copied" />
          <LinkToUsCopyBlock id="snippet-html-min" title="HTML — minimal + security attrs" description="Typical for blog sidebars. Change rel if your policy requires nofollow or sponsored." code={htmlMinimal} copyLabel="Copy HTML" copiedLabel="Copied" />
          <LinkToUsCopyBlock id="snippet-md" title="Markdown" description="For README files, wikis, or static generators." code={markdownInline} copyLabel="Copy Markdown" copiedLabel="Copied" />
        </div>

        <section className="z-box mt-14 p-6 sm:p-8" aria-labelledby="localized-v1">
          <h2 id="localized-v1" className="z-kicker text-[var(--z-ink-2)]">Localized interface (SEO hreflang)</h2>
          <p className="mt-3 max-w-2xl text-[14px] font-semibold leading-relaxed text-[var(--z-ink-2)]">
            Appending <code className="rounded bg-[var(--z-paper-2)] px-1.5 py-0.5 text-[11px]" style={{ fontFamily: 'var(--font-zine-mono)' }}>?ui=</code> to any path sets the UI language for that visit and matches our hreflang alternates. Example library entry in Korean:
          </p>
          <p className="mt-4 text-[12px] font-bold text-[var(--z-ink)]" style={{ fontFamily: 'var(--font-zine-mono)' }}>{`${site}/library?ui=ko`}</p>
          <div className="mt-6 overflow-x-auto rounded-[7px] border-[2.5px] border-[var(--z-ink)]">
            <table className="w-full min-w-[280px] border-collapse text-left text-[12px]">
              <thead><tr className="border-b-[2.5px] border-[var(--z-ink)] bg-[var(--z-yellow)]"><th className="px-4 py-2.5 text-[11px] font-black uppercase">ui=</th><th className="px-4 py-2.5 text-[11px] font-black uppercase">Interface</th></tr></thead>
              <tbody>
                {[['en', 'English'], ['ja', 'Japanese'], ['ko', 'Korean'], ['zh', 'Chinese (Simplified)'], ['ru', 'Russian']].map(([code, label], i, arr) => (
                  <tr key={code} className={i < arr.length - 1 ? 'border-b-2 border-[var(--z-ink)]' : ''}>
                    <td className="px-4 py-2.5 font-black text-[var(--z-ink)]" style={{ fontFamily: 'var(--font-zine-mono)' }}>{code}</td>
                    <td className="px-4 py-2.5 font-semibold text-[var(--z-ink-2)]">{label}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="mt-10 border-t-[2.5px] border-[var(--z-ink)] pt-10">
          <h2 className="z-kicker text-[var(--z-ink-2)]">Optional logo</h2>
          <p className="mt-3 text-[14px] font-semibold leading-relaxed text-[var(--z-ink-2)]">
            Square mark: <a href={`${site}/logo.png`} className="font-black text-[var(--z-red)] underline underline-offset-4">{site}/logo.png</a> (512×512). Do not crop into misleading badges or imply endorsement by third-party catalogs.
          </p>
        </section>
      </main>
      <ZineFooter />
    </div>
  );
}
