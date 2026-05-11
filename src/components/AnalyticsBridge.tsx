'use client';

import { useEffect } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { shouldSendAnalyticsEvents, trackPageView } from '@/lib/analytics';
import { subscribeAnalyticsConsentChange } from '@/lib/analytics-consent';

export default function AnalyticsBridge() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const searchKey = searchParams.toString();

  useEffect(() => {
    const flush = () => {
      if (!shouldSendAnalyticsEvents()) return;
      const search = searchKey || null;
      trackPageView({
        pathname,
        search,
      });
    };

    flush();
    return subscribeAnalyticsConsentChange(flush);
  }, [pathname, searchKey]);

  return null;
}
