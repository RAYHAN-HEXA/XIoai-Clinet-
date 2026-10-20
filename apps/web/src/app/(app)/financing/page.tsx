'use client';

import { useTranslations } from 'next-intl';
import { PageHeader } from '@/components/page-state';
import { FinancingClient } from '@/components/financing/financing-client';

export default function FinancingPage() {
  const t = useTranslations('financing');

  return (
    <div className="space-y-6">
      <PageHeader title={t('title')} subtitle={t('subtitle')} />
      <FinancingClient />
    </div>
  );
}
