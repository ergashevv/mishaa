import type { ReactNode } from 'react';

/** Guides inherit default SEO from each page; layout only groups routes. */
export default function GuidesLayout({ children }: { children: ReactNode }) {
  return children;
}
