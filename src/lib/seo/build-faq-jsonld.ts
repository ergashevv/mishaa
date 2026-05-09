import { translations } from '@/lib/translations';

/**
 * FAQPage structured data (English copy matches visible FAQ defaults).
 * Single URL /faq — aligns with primary indexing language.
 */
export function buildFaqPageJsonLd() {
  const faq = translations.en.faq;
  const pairs = [
    { q: faq.q1, a: faq.a1 },
    { q: faq.q2, a: faq.a2 },
    { q: faq.q3, a: faq.a3 },
    { q: faq.q4, a: faq.a4 },
    { q: faq.q5, a: faq.a5 },
    { q: faq.q6, a: faq.a6 },
    { q: faq.q7, a: faq.a7 },
    { q: faq.q8, a: faq.a8 },
    { q: faq.q10, a: faq.a10 },
    { q: faq.q11, a: faq.a11 },
  ];

  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: pairs.map(({ q, a }) => ({
      '@type': 'Question',
      name: q,
      acceptedAnswer: {
        '@type': 'Answer',
        text: a,
      },
    })),
  };
}
