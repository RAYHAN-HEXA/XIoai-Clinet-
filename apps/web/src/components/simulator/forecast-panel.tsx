'use client';

import { useLocale, useTranslations } from 'next-intl';
import { AlertTriangle } from 'lucide-react';
import { ForecastChart } from '@/components/charts';
import { KpiCard } from '@/components/kpi-card';
import { EmptyBlock } from '@/components/page-state';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { formatFen, loc } from '@/lib/format';
import type { ForecastDto } from '@/lib/queries';
import type { SupplierObligationDto } from './types';

export function ForecastPanel({
  base,
  scenario,
  hypothetical,
  obligations,
  loading
}: {
  base: ForecastDto | undefined;
  scenario: ForecastDto | undefined;
  hypothetical: boolean;
  obligations: SupplierObligationDto[];
  loading: boolean;
}) {
  const t = useTranslations('simulator');
  const tc = useTranslations('common');
  const locale = useLocale();

  const source = scenario ?? base;
  const shortageDay = (scenario ? scenario.firstShortageDay ?? base?.firstShortageDay : base?.firstShortageDay) ?? null;
  const minBalanceFen = source?.minBalanceFen;
  const closingBalanceFen = source?.closingBalanceFen;

  if (!base && loading) {
    return (
      <div className="space-y-4">
        <div className="rounded-lg border bg-card p-4 shadow-sm">
          <Skeleton className="mb-3 h-4 w-40" />
          <Skeleton className="h-72 w-full" />
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-28 w-full" />
          ))}
        </div>
      </div>
    );
  }

  if (!base) return <EmptyBlock message={tc('empty')} />;

  return (
    <div className="space-y-4">
      {source && source.firstShortageDay !== null && source.alertExplanation && (
        <div
          role="status"
          className="flex items-start gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800"
        >
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <span>{loc(source.alertExplanation, locale)}</span>
        </div>
      )}
      <section className="rounded-lg border bg-card p-4 shadow-sm">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <span aria-hidden className="h-0.5 w-5 rounded bg-[hsl(217_62%_30%)]" />
              {t('baseCurve')}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span aria-hidden className="h-0.5 w-5 border-t-2 border-dashed border-[hsl(38_92%_50%)]" />
              {t('stressedCurve')}
            </span>
          </div>
          {hypothetical && <Badge variant="warning">{t('scenarioBadge')}</Badge>}
        </div>
        <ForecastChart days={base.days} stressed={scenario?.days} shortageDay={shortageDay} />
        <p className="mt-2 text-xs text-muted-foreground">{t('assumptionNote')}</p>
        <p className="mt-1 text-xs text-muted-foreground">{t('equityNote')}</p>
      </section>

      <div className="grid gap-4 sm:grid-cols-3">
        <KpiCard
          label={t('shortageDay')}
          loading={loading && !source}
          value={shortageDay !== null ? String(shortageDay) : '—'}
          sub={shortageDay !== null ? undefined : t('noShortage')}
          tone={shortageDay !== null ? 'negative' : 'positive'}
        />
        <KpiCard
          label={t('minBalance')}
          loading={loading && !source}
          value={minBalanceFen !== undefined ? formatFen(minBalanceFen, locale) : undefined}
          tone={minBalanceFen !== undefined && minBalanceFen < 0 ? 'negative' : 'default'}
        />
        <KpiCard
          label={t('closingBalance')}
          loading={loading && !source}
          value={closingBalanceFen !== undefined ? formatFen(closingBalanceFen, locale) : undefined}
          tone={closingBalanceFen !== undefined && closingBalanceFen < 0 ? 'negative' : 'default'}
        />
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">{t('upcoming')}</CardTitle>
        </CardHeader>
        <CardContent>
          {obligations.length === 0 ? (
            <EmptyBlock message={t('noObligations')} />
          ) : (
            <ul className="divide-y">
              {obligations.map((ob) => (
                <li key={ob.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
                  <span className="min-w-0 truncate">{ob.label}</span>
                  <span className="flex shrink-0 items-center gap-3 tabular-nums">
                    <span className="text-muted-foreground">{tc('amount')}: {formatFen(ob.amountFen, locale)}</span>
                    <Badge variant={ob.dueInDays <= 0 ? 'critical' : 'muted'}>D{Math.max(1, ob.dueInDays)}</Badge>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
