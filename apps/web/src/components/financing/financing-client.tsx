'use client';

import { useLocale, useTranslations } from 'next-intl';
import { AlertTriangle } from 'lucide-react';
import { EmptyBlock, ErrorBlock } from '@/components/page-state';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { formatFen, loc } from '@/lib/format';
import { useFinancing } from '@/lib/queries';
import { OptionCard } from './option-card';
import { reasonLabel } from './reason-map';

export function FinancingClient() {
  const t = useTranslations('financing');
  const tc = useTranslations('common');
  const locale = useLocale();
  const { data, isLoading, isError, refetch } = useFinancing();

  if (isLoading) {
    return (
      <div className="space-y-4" aria-busy="true">
        <Skeleton className="h-28 w-full" />
        <div className="grid gap-4 md:grid-cols-2">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-72 w-full" />
          ))}
        </div>
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="space-y-3">
        <ErrorBlock message={tc('loadError')} />
        <Button type="button" variant="outline" size="sm" onClick={() => refetch()}>
          {tc('retry')}
        </Button>
      </div>
    );
  }

  const ranked = data.ranked.slice(0, 4);

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
        <p>{t('qualitativeBadge')}</p>
      </div>

      <section className="rounded-lg border bg-card p-4 shadow-sm">
        <h2 className="mb-2 text-sm font-semibold">{t('gapSummary')}</h2>
        <p className="text-sm">{loc(data.gapSummary, locale)}</p>
        <p className="mt-1 text-sm text-muted-foreground">{reasonLabel(data.reason, locale)}</p>
        {data.gap.firstShortageDay !== null ? (
          <div className="mt-3 flex flex-wrap items-baseline gap-x-4 gap-y-1">
            <span className="text-2xl font-semibold tabular-nums text-red-600">
              {data.gap.gapAmountFen !== null ? formatFen(data.gap.gapAmountFen, locale) : '—'}
            </span>
            <span className="tabular-nums text-sm text-muted-foreground">D{data.gap.firstShortageDay}</span>
          </div>
        ) : (
          <p className="mt-3 rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
            {t('noGap')}
          </p>
        )}
      </section>

      {ranked.length === 0 ? (
        <EmptyBlock message={t('empty')} />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {ranked.map((option) => (
            <OptionCard key={option.id} option={option} />
          ))}
        </div>
      )}

      <div className="flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
        <div>
          <p className="font-semibold">{t('missingInfo')}</p>
          <p className="mt-1">{t('missingInfoBody')}</p>
        </div>
      </div>

      <section className="rounded-lg border bg-card p-4 shadow-sm">
        <h2 className="mb-1 text-sm font-semibold">{t('disclaimer')}</h2>
        <p className="text-sm text-muted-foreground">{loc(data.disclaimer, locale)}</p>
      </section>

      <p className="border-t pt-4 text-sm font-medium text-muted-foreground">{t('noApply')}</p>
    </div>
  );
}
