'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { Sparkles } from 'lucide-react';

/**
 * Shown on every screen of an ILLUSTRATIVE demo business (isDemo=true).
 * Demo figures are never presented as the visitor's real performance.
 */
export function DemoBanner() {
  const t = useTranslations('demo');
  return (
    <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900">
      <span className="flex items-start gap-2">
        <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
        {t('banner')}
      </span>
      <Link href="/register" className="font-semibold underline underline-offset-2">
        {t('registerCta')}
      </Link>
    </div>
  );
}
