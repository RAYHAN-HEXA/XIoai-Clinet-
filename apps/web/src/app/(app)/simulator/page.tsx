'use client';

import { useTranslations } from 'next-intl';
import { PageHeader } from '@/components/page-state';
import { ToastProvider } from '@/components/toast';
import { SimulatorClient } from '@/components/simulator/simulator-client';

export default function SimulatorPage() {
  const t = useTranslations('simulator');

  return (
    <div className="space-y-6">
      <PageHeader title={t('title')} subtitle={t('subtitle')} />
      <ToastProvider>
        <SimulatorClient />
      </ToastProvider>
    </div>
  );
}
