import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import ComicLibraryClient from '@/components/ComicLibraryClient';
import JsonLd from '@/components/JsonLd';
import { Suspense } from 'react';

export async function generateMetadata({ searchParams }: { searchParams: Promise<{ tab?: string, q?: string }> }): Promise<Metadata> {
  const { tab, q } = await searchParams;
  const category = tab || 'Comics';
  const query = q ? ` search results for "${q}"` : '';
  
  const title = `${category}${query}`;
  const description = `Browse our extensive collection of ${category}. Find your favorite Manga, Manhwa, and Marvel comics in our digital vault.`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      url: 'https://icomics.wiki/library',
    },
    alternates: {
      canonical: `https://icomics.wiki/library${tab ? `?tab=${encodeURIComponent(tab)}` : ''}`,
    }
  };
}

export default async function Page({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const { tab } = await searchParams;
  const cookieStore = await cookies();
  const initialAgeVerified = cookieStore.get('age_verified')?.value === 'true';
  
  const collectionSchema = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    "name": `${tab || 'Comic'} Collection | iComics.wiki`,
    "description": "A curated collection of digital comics, manga, and graphic novels.",
    "url": "https://icomics.wiki/library",
    "breadcrumb": {
      "@type": "BreadcrumbList",
      "itemListElement": [
        {
          "@type": "ListItem",
          "position": 1,
          "name": "Home",
          "item": "https://icomics.wiki"
        },
        {
          "@type": "ListItem",
          "position": 2,
          "name": "Library",
          "item": "https://icomics.wiki/library"
        }
      ]
    }
  };

  return (
    <Suspense fallback={<div className="min-h-screen bg-black flex items-center justify-center text-white/20 font-black uppercase tracking-[0.5em]">Loading_Vault...</div>}>
      <JsonLd data={collectionSchema} />
      <ComicLibraryClient initialAgeVerified={initialAgeVerified} />
    </Suspense>
  );
}
