'use client';

import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { AlertTriangle, ArrowRight, CheckCircle2, FileWarning, Info } from 'lucide-react';
import { DemoBanner } from '@/components/demo-banner';
import { KpiCard } from '@/components/kpi-card';
import { PageHeader, LoadingBlock, ErrorBlock, EmptyBlock } from '@/components/page-state';
import { ApiStatus } from '@/components/api-status';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { TableScroll, Table, THead, TBody, TR, TH, TD } from '@/components/ui/table';
import { useDashboardSummary } from '@/lib/queries';
import { formatFen, formatDate, formatPct, loc } from '@/lib/format';
import { cn } from '@/lib/utils';

const SEVERITY = {
  positive: { tone: 'positive' as const, Icon: CheckCircle2, cls: 'text-emerald-600' },
  info: { tone: 'default' as const, Icon: Info, cls: 'text-sky-600' },
  warning: { tone: 'warning' as const, Icon: AlertTriangle, cls: 'text-amber-600' },
  critical: { tone: 'negative' as const, Icon: AlertTriangle, cls: 'text-red-600' }
};

export default function DashboardPage() {
  const t = useTranslations('dashboard');
  const tCommon = useTranslations('common');
  const locale = useLocale();
  const { data, isLoading, error } = useDashboardSummary();

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('title')}
        subtitle={t('subtitle')}
        right={
          <div className="flex flex-wrap items-center gap-2">
            <ApiStatus />
            {data && (
              <Badge variant={data.cash.alertLevel === 'NONE' ? 'positive' : data.cash.alertLevel === 'CRITICAL' ? 'critical' : 'warning'}>
                {data.cash.alertLevel}
              </Badge>
            )}
          </div>
        }
      />

      {data?.business.isDemo && <DemoBanner />}

      {isLoading && <LoadingBlock rows={4} />}
      {error && <ErrorBlock message={tCommon('loadError')} />}

      {data && (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <KpiCard label={t('kpiRevenue')} value={formatFen(data.revenue, locale)} sub={t('marginNote', { margin: formatPct(data.marginPct, locale) })} />
            <KpiCard label={t('kpiRealProfit')} value={formatFen(data.realProfit, locale)} tone={data.realProfit < 0 ? 'negative' : 'positive'} sub={`${data.counts.ordersIncluded} ${t('freshnessOrders').toLowerCase()}`} />
            <KpiCard label={t('kpiCashToday')} value={formatFen(data.cash.openingCashFen, locale)} />
            <KpiCard
              label={t('kpiShortage')}
              value={data.cash.firstShortageDay === null ? t('noShortage') : t('shortageOn', { day: data.cash.firstShortageDay })}
              tone={data.cash.firstShortageDay === null ? 'positive' : 'negative'}
              sub={`min ${formatFen(data.cash.minBalanceFen, locale)} · d${data.cash.minBalanceDay}`}
            />
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle as="h2">{t('cashFlowTitle')}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid gap-3 sm:grid-cols-3">
                  <FlowStat label={t('gmv')} value={formatFen(data.gmv30Fen, locale)} />
                  <FlowStat label={t('settled')} value={formatFen(data.settledFen, locale)} tone="positive" />
                  <FlowStat label={t('obligations')} value={formatFen(data.obligationsFen, locale)} tone="warning" />
                </div>
                <p className="text-xs text-muted-foreground">{t('cashFlowNote')}</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle as="h2">{t('alertsTitle')}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <Row label={t('pendingApprovals')} value={data.counts.pendingApprovals} href="/approvals" />
                <Row label={t('missingDocs')} value={data.counts.missingDocs} href="/sources" />
                <Row label={t('sourcesStatus')} value={t('sourcesGranted', { count: data.counts.sourcesGranted })} href="/sources" />
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle as="h2">{t('insightsTitle')}</CardTitle>
            </CardHeader>
            <CardContent>
              {data.insights.length === 0 ? (
                <EmptyBlock message={tCommon('empty')} />
              ) : (
                <ul className="space-y-3">
                  {data.insights.map((ins) => {
                    const sev = SEVERITY[ins.severity];
                    return (
                      <li key={ins.id} className="flex items-start gap-3">
                        <sev.Icon className={cn('mt-0.5 h-4 w-4 shrink-0', sev.cls)} aria-hidden />
                        <div>
                          <p className="text-sm font-medium">{loc(ins.title, locale)}</p>
                          <p className="text-xs text-muted-foreground">{loc(ins.detail, locale)}</p>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </CardContent>
          </Card>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle as="h2">{t('recentImports')}</CardTitle>
              </CardHeader>
              <CardContent>
                {data.recentImports.length === 0 ? (
                  <EmptyBlock message={t('noImports')} />
                ) : (
                  <TableScroll>
                    <Table>
                      <THead>
                        <TH>{tCommon('date')}</TH>
                        <TH>{tCommon('status')}</TH>
                        <TH>rows</TH>
                      </THead>
                      <TBody>
                        {data.recentImports.map((job) => (
                          <TR key={job.id}>
                            <TD>{formatDate(job.createdAt, locale)}</TD>
                            <TD>
                              <Badge>{job.status}</Badge>
                            </TD>
                            <TD>
                              {job.rowsOk}/{job.rowsTotal}
                            </TD>
                          </TR>
                        ))}
                      </TBody>
                    </Table>
                  </TableScroll>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle as="h2">{t('freshness')}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <Row label={t('freshnessOrders')} value={data.freshness.lastOrderAt ? formatDate(data.freshness.lastOrderAt, locale) : '—'} />
                <Row label={t('freshnessImports')} value={data.freshness.lastImportAt ? formatDate(data.freshness.lastImportAt, locale) : '—'} />
                <Row label={t('freshnessComputed')} value={formatDate(data.freshness.computedAt, locale)} />
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}

function FlowStat({ label, value, tone }: { label: string; value: string; tone?: 'positive' | 'warning' }) {
  return (
    <div className="rounded-md border p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={cn('mt-1 text-lg font-semibold tabular-nums', tone === 'positive' && 'text-emerald-600', tone === 'warning' && 'text-amber-600')}>
        {value}
      </p>
    </div>
  );
}

function Row({ label, value, href }: { label: string; value: string | number; href?: string }) {
  const body = (
    <div className="flex items-center justify-between gap-2 rounded-md px-2 py-1.5 hover:bg-muted/50">
      <span className="text-muted-foreground">{label}</span>
      <span className="flex items-center gap-1 font-medium tabular-nums">
        {value}
        {href && <ArrowRight className="h-3 w-3" aria-hidden />}
      </span>
    </div>
  );
  return href ? <Link href={href}>{body}</Link> : body;
}
