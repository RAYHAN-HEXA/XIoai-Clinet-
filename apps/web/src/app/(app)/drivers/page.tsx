'use client';

import * as React from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { PageHeader, ErrorBlock, EmptyBlock } from '@/components/page-state';
import { KpiCard } from '@/components/kpi-card';
import { DateRangeFilter, defaultRange, type DateRange } from '@/components/date-range';
import { DriverBarChart } from '@/components/charts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useDrivers } from '@/lib/queries';
import { formatDate, formatFen, formatPct, loc } from '@/lib/format';
import { DriverTable } from '@/components/drivers/driver-table';

export default function DriversPage() {
  const t = useTranslations('drivers');
  const tc = useTranslations('common');
  const locale = useLocale();

  const [range, setRange] = React.useState<DateRange>(() => defaultRange());
  // Previous period is derived server-side (same length, immediately before).
  const driversQ = useDrivers({ from: range.from, to: range.to });
  const data = driversQ.data;

  const isEmpty = !!data && data.drivers.every((d) => d.previousValue === 0 && d.currentValue === 0);

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('title')}
        subtitle={t('subtitle')}
        right={<DateRangeFilter value={range} onChange={setRange} />}
      />

      {data && (
        <div className="flex flex-wrap gap-x-10 gap-y-3">
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">{t('periodPrevious')}</p>
            <p className="text-sm font-medium tabular-nums">
              {formatDate(data.previous.from, locale)} – {formatDate(data.previous.to, locale)}
            </p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">{t('periodCurrent')}</p>
            <p className="text-sm font-medium tabular-nums">
              {formatDate(data.current.from, locale)} – {formatDate(data.current.to, locale)}
            </p>
          </div>
        </div>
      )}

      {driversQ.isError ? (
        <div className="space-y-3">
          <ErrorBlock message={tc('loadError')} />
          <Button variant="outline" size="sm" onClick={() => driversQ.refetch()}>
            {tc('retry')}
          </Button>
        </div>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <KpiCard
              label={t('previousProfit')}
              loading={driversQ.isLoading}
              value={data ? formatFen(data.previousProfitFen, locale) : undefined}
            />
            <KpiCard
              label={t('currentProfit')}
              loading={driversQ.isLoading}
              value={data ? formatFen(data.currentProfitFen, locale) : undefined}
            />
            <KpiCard
              label={t('profitChange')}
              loading={driversQ.isLoading}
              tone={
                data
                  ? data.profitChangeFen > 0
                    ? 'positive'
                    : data.profitChangeFen < 0
                      ? 'negative'
                      : 'default'
                  : 'default'
              }
              value={data ? formatFen(data.profitChangeFen, locale) : undefined}
              sub={
                data
                  ? data.profitChangePct === null
                    ? t('pctUnavailable')
                    : formatPct(data.profitChangePct, locale)
                  : undefined
              }
            />
          </div>

          {driversQ.isLoading || !data ? (
            <Skeleton className="h-72 w-full" />
          ) : isEmpty ? (
            <EmptyBlock message={t('empty')} />
          ) : (
            <>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">{t('contributionChart')}</CardTitle>
                </CardHeader>
                <CardContent>
                  <DriverBarChart
                    data={data.drivers.map((d) => ({
                      id: d.id,
                      label: loc(d.label, locale),
                      contributionFen: d.contributionToFenProfitChange
                    }))}
                  />
                </CardContent>
              </Card>

              <p className="text-sm text-muted-foreground">
                <span className="font-medium text-foreground">{t('method')}: </span>
                {loc(data.method, locale)}
              </p>

              <DriverTable drivers={data.drivers} />

              <p className="text-xs text-muted-foreground">{t('sameMethod')}</p>
            </>
          )}
        </>
      )}
    </div>
  );
}
