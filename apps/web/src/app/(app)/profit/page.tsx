'use client';

import * as React from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { PageHeader, LoadingBlock, ErrorBlock, EmptyBlock } from '@/components/page-state';
import { KpiCard } from '@/components/kpi-card';
import { EvidenceNumber } from '@/components/evidence-number';
import { DateRangeFilter, defaultRange, type DateRange } from '@/components/date-range';
import { WaterfallChart } from '@/components/charts';
import { Tabs, TabPanel } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useProfitSummary, useGroupRows, type GroupRowDto } from '@/lib/queries';
import { formatFen, formatPct } from '@/lib/format';
import { GroupTable, type ProfitTab, type GroupSortKey } from '@/components/profit/group-table';
import { CostBreakdown } from '@/components/profit/cost-breakdown';

const TAB_KIND: Record<ProfitTab, 'by-product' | 'by-campaign' | 'by-channel'> = {
  product: 'by-product',
  campaign: 'by-campaign',
  channel: 'by-channel'
};

function sortRows(rows: GroupRowDto[], query: string, sort: { key: GroupSortKey; dir: 'asc' | 'desc' }): GroupRowDto[] {
  const q = query.trim().toLowerCase();
  const filtered = q ? rows.filter((r) => r.label.toLowerCase().includes(q)) : rows;
  if (sort.key === 'label') {
    const dir = sort.dir === 'asc' ? 1 : -1;
    return [...filtered].sort((a, b) => a.label.localeCompare(b.label) * dir);
  }
  const pick = (r: GroupRowDto): number | null => {
    const v = sort.key === 'advertising' ? (r.advertising ?? 0) : r[sort.key];
    return typeof v === 'number' ? v : null;
  };
  const dir = sort.dir === 'asc' ? 1 : -1;
  return [...filtered].sort((a, b) => {
    const av = pick(a);
    const bv = pick(b);
    if (av === null && bv === null) return 0;
    if (av === null) return 1;
    if (bv === null) return -1;
    return (av - bv) * dir;
  });
}

export default function ProfitPage() {
  const t = useTranslations('profit');
  const tc = useTranslations('common');
  const locale = useLocale();

  const [range, setRange] = React.useState<DateRange>(() => defaultRange());
  const [tab, setTab] = React.useState<ProfitTab>('product');
  const [query, setQuery] = React.useState('');
  const [sort, setSort] = React.useState<{ key: GroupSortKey; dir: 'asc' | 'desc' }>({ key: 'profit', dir: 'desc' });

  const summaryQ = useProfitSummary(range.from, range.to);
  const groupsQ = useGroupRows(TAB_KIND[tab], range.from, range.to);

  const data = summaryQ.data;
  const s = data?.summary;
  const meta = data?.meta;
  const groupRows = React.useMemo(() => groupsQ.data?.groups ?? [], [groupsQ.data]);

  const isEmpty =
    !summaryQ.isLoading &&
    !groupsQ.isLoading &&
    !!data &&
    !!meta &&
    meta.ordersIncluded === 0 &&
    data.summary.revenue === 0 &&
    groupRows.length === 0;

  const visibleRows = React.useMemo(() => sortRows(groupRows, query, sort), [groupRows, query, sort]);

  const waterfallSteps = React.useMemo(() => {
    if (!s) return [];
    return [
      { label: t('colRevenue'), delta: s.revenue, kind: 'total' as const },
      { label: t('colProductCost'), delta: -s.productCost, kind: 'cost' as const },
      { label: t('colAdvertising'), delta: -s.advertising, kind: 'cost' as const },
      { label: t('colCommission'), delta: -s.influencerCommission, kind: 'cost' as const },
      { label: t('colDelivery'), delta: -s.delivery, kind: 'cost' as const },
      { label: t('colRefunds'), delta: -s.refunds, kind: 'cost' as const },
      { label: t('colPlatformFees'), delta: -s.platformFees, kind: 'cost' as const },
      // realProfit ≡ revenue − totalCosts: the profit bar picks up exactly
      // where the cost steps leave off (identity verified against SummaryDto).
      { label: t('colProfit'), delta: s.realProfit, kind: 'profit' as const }
    ];
  }, [s, t]);

  const handleTabChange = React.useCallback((id: string) => {
    setTab(id as ProfitTab);
    setQuery('');
    setSort({ key: 'profit', dir: 'desc' });
  }, []);

  const handleSort = React.useCallback((key: GroupSortKey) => {
    setSort((prev) =>
      prev.key === key
        ? { key, dir: prev.dir === 'asc' ? 'desc' : 'asc' }
        : { key, dir: key === 'label' ? 'asc' : 'desc' }
    );
  }, []);

  const tabNote = tab === 'product' ? t('productNote') : tab === 'campaign' ? t('campaignNote') : null;

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('title')}
        subtitle={t('subtitle')}
        right={<DateRangeFilter value={range} onChange={setRange} />}
      />

      {summaryQ.isError ? (
        <div className="space-y-3">
          <ErrorBlock message={tc('loadError')} />
          <Button variant="outline" size="sm" onClick={() => summaryQ.refetch()}>
            {tc('retry')}
          </Button>
        </div>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <KpiCard
              label={t('colRevenue')}
              loading={summaryQ.isLoading}
              value={s ? <EvidenceNumber metric="revenue" valueFen={s.revenue} /> : undefined}
            />
            <KpiCard
              label={t('costsTitle')}
              loading={summaryQ.isLoading}
              value={s ? formatFen(s.totalCosts, locale) : undefined}
              sub={s ? formatPct(s.revenue > 0 ? (s.totalCosts / s.revenue) * 100 : null, locale) : undefined}
            />
            <KpiCard
              label={t('colProfit')}
              loading={summaryQ.isLoading}
              tone={s && s.realProfit < 0 ? 'negative' : s && s.realProfit > 0 ? 'positive' : 'default'}
              value={s ? <EvidenceNumber metric="realProfit" valueFen={s.realProfit} /> : undefined}
            />
            <KpiCard
              label={t('colMargin')}
              loading={summaryQ.isLoading}
              value={s ? formatPct(s.marginPct, locale) : undefined}
            />
          </div>

          {isEmpty ? (
            <EmptyBlock message={t('empty')} />
          ) : summaryQ.isLoading || !s ? (
            <div className="grid gap-4 lg:grid-cols-2">
              <Skeleton className="h-72 w-full" />
              <Skeleton className="h-72 w-full" />
            </div>
          ) : (
            <>
              <div className="grid gap-4 lg:grid-cols-2">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">{t('waterfallTitle')}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <WaterfallChart steps={waterfallSteps} />
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">{t('costsTitle')}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <CostBreakdown summary={s} />
                  </CardContent>
                </Card>
              </div>

              <section className="space-y-3">
                <h2 className="text-lg font-semibold">{t('tableTitle')}</h2>
                <div className="flex flex-wrap items-end justify-between gap-3">
                  <Tabs
                    tabs={[
                      { id: 'product', label: t('tabProduct') },
                      { id: 'campaign', label: t('tabCampaign') },
                      { id: 'channel', label: t('tabChannel') }
                    ]}
                    value={tab}
                    onChange={handleTabChange}
                    label={t('tableTitle')}
                  />
                  <div className="w-full sm:w-64">
                    <Label htmlFor="profit-search" className="sr-only">
                      {t('search')}
                    </Label>
                    <Input
                      id="profit-search"
                      type="search"
                      placeholder={t('search')}
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                    />
                  </div>
                </div>

                {(['product', 'campaign', 'channel'] as const).map((id) => (
                  <TabPanel key={id} id={id} active={tab === id}>
                    {groupsQ.isError ? (
                      <div className="space-y-3">
                        <ErrorBlock message={tc('loadError')} />
                        <Button variant="outline" size="sm" onClick={() => groupsQ.refetch()}>
                          {tc('retry')}
                        </Button>
                      </div>
                    ) : groupsQ.isLoading ? (
                      <LoadingBlock rows={5} />
                    ) : visibleRows.length === 0 ? (
                      <EmptyBlock message={query.trim() ? tc('empty') : t('empty')} />
                    ) : (
                      <GroupTable
                        tab={tab}
                        rows={visibleRows}
                        sortKey={sort.key}
                        sortDir={sort.dir}
                        onSort={handleSort}
                      />
                    )}

                    <div className="space-y-1 pt-2">
                      {meta && <p className="text-xs text-muted-foreground">{t('metaNote', { orders: meta.ordersIncluded })}</p>}
                      {meta && meta.ordersMissingProduct > 0 && (
                        <p className="text-xs text-amber-700">{t('missingProductNote', { count: meta.ordersMissingProduct })}</p>
                      )}
                      {tabNote && <p className="text-xs text-muted-foreground">{tabNote}</p>}
                    </div>
                  </TabPanel>
                ))}
              </section>
            </>
          )}
        </>
      )}
    </div>
  );
}
