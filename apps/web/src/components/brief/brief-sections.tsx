'use client';

import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { Badge, alertBadgeVariant } from '@/components/ui/badge';
import { Table, TBody, TD, TR, TableScroll } from '@/components/ui/table';
import { formatFen, formatDate, formatPct, loc } from '@/lib/format';
import type { BriefDto } from '@/lib/queries';
import { urgencyMeta } from './brief-urgency';

function RowHead({ children }: { children: React.ReactNode }) {
  return (
    <th scope="row" className="px-3 py-2.5 text-left align-middle font-medium">
      {children}
    </th>
  );
}

/** Shared scroll wrapper so tables collapse into a horizontal scroll at 360px. */
function PlainTableScroll({ children }: { children: React.ReactNode }) {
  return (
    <TableScroll className="border-0 bg-transparent shadow-none">{children}</TableScroll>
  );
}

export function UrgentPayments({ items }: { items: BriefDto['urgentPayments'] }) {
  const t = useTranslations('brief');
  const locale = useLocale();
  return (
    <PlainTableScroll>
      <Table>
        <TBody>
          {items.map((p) => {
            const meta = urgencyMeta(p.urgency);
            return (
              <TR key={p.id}>
                <RowHead>{p.label}</RowHead>
                <TD className="whitespace-nowrap text-right tabular-nums">{formatFen(p.amountFen, locale)}</TD>
                <TD className="whitespace-nowrap text-muted-foreground">{formatDate(p.dueDate, locale)}</TD>
                <TD>
                  {meta ? (
                    <Badge variant={meta.variant}>{t(meta.key)}</Badge>
                  ) : (
                    <Badge variant="muted">{p.urgency}</Badge>
                  )}
                </TD>
              </TR>
            );
          })}
        </TBody>
      </Table>
    </PlainTableScroll>
  );
}

export function OverdueInvoices({ items }: { items: BriefDto['overdueInvoices'] }) {
  const locale = useLocale();
  return (
    <PlainTableScroll>
      <Table>
        <TBody>
          {items.map((inv) => (
            <TR key={inv.id}>
              <RowHead>{inv.label}</RowHead>
              <TD className="whitespace-nowrap text-right tabular-nums">{formatFen(inv.amountFen, locale)}</TD>
              <TD className="whitespace-nowrap text-muted-foreground">{formatDate(inv.dueDate, locale)}</TD>
            </TR>
          ))}
        </TBody>
      </Table>
    </PlainTableScroll>
  );
}

export function MissingDocs({ items }: { items: BriefDto['missingDocs'] }) {
  const locale = useLocale();
  return (
    <PlainTableScroll>
      <Table>
        <TBody>
          {items.map((inv) => (
            <TR key={inv.id}>
              <RowHead>{inv.label}</RowHead>
              <TD className="whitespace-nowrap text-right tabular-nums">{formatFen(inv.amountFen, locale)}</TD>
              <TD className="whitespace-nowrap text-muted-foreground">{formatDate(inv.dueDate, locale)}</TD>
            </TR>
          ))}
        </TBody>
      </Table>
    </PlainTableScroll>
  );
}

export function RisingCosts({ items }: { items: BriefDto['risingCosts'] }) {
  const locale = useLocale();
  return (
    <ul className="divide-y rounded-md border">
      {items.map((c, i) => (
        <li key={`${c.category.en}-${i}`} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 px-3 py-2.5 text-sm">
          <div className="min-w-0">
            <p className="font-medium">{loc(c.category, locale)}</p>
            <p className="text-xs tabular-nums text-muted-foreground">
              {formatFen(c.previousFen, locale)} → {formatFen(c.currentFen, locale)}
            </p>
          </div>
          <div className="flex items-center gap-2 tabular-nums">
            <span className={c.changeFen >= 0 ? 'text-red-600' : 'text-emerald-600'}>
              {c.changeFen >= 0 ? '+' : ''}
              {formatFen(c.changeFen, locale)}
            </span>
            <Badge variant={c.changeFen >= 0 ? 'warning' : 'positive'}>{formatPct(c.changePct, locale)}</Badge>
          </div>
        </li>
      ))}
    </ul>
  );
}

export function ApprovalsNeeded({ items }: { items: BriefDto['approvalsNeeded'] }) {
  return (
    <ul className="space-y-1.5">
      {items.map((a) => (
        <li key={a.id}>
          <Link
            href="/approvals"
            className="flex items-center justify-between gap-3 rounded-md border px-3 py-2 text-sm transition-colors hover:bg-muted/60"
          >
            <span className="min-w-0 truncate">{a.title}</span>
            <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
          </Link>
        </li>
      ))}
    </ul>
  );
}

export function CashRiskCard({ risk }: { risk: BriefDto['cashRisk'] }) {
  const t = useTranslations('brief');
  const locale = useLocale();
  const firstShortageDay = risk?.firstShortageDay ?? null;
  const minBalanceFen = risk?.minBalanceFen ?? 0;
  return (
    <div className="flex flex-wrap items-center gap-3">
      {risk && <Badge variant={alertBadgeVariant(risk.alertLevel)}>{risk.alertLevel}</Badge>}
      {firstShortageDay === null ? (
        <p className="text-sm font-medium text-emerald-600">{t('cashOk')}</p>
      ) : (
        <p className="text-sm">
          {t('cashShort', {
            day: firstShortageDay,
            min: formatFen(minBalanceFen, locale)
          })}
        </p>
      )}
    </div>
  );
}

export function RevenueTrendCard({ trend }: { trend: BriefDto['revenueTrend'] }) {
  const tc = useTranslations('common');
  const locale = useLocale();
  return (
    <div className="flex flex-wrap items-end gap-x-8 gap-y-3">
      <div>
        <p className="text-xs text-muted-foreground">{tc('last7')}</p>
        <p className="text-2xl font-semibold tabular-nums">{formatFen(trend.last7Fen, locale)}</p>
      </div>
      <div>
        <p className="text-xs text-muted-foreground">{tc('prev')}</p>
        <p className="text-xl tabular-nums text-muted-foreground">{formatFen(trend.prior7Fen, locale)}</p>
      </div>
      <Badge variant={trend.changePct === null ? 'muted' : trend.changePct >= 0 ? 'positive' : 'critical'}>
        {formatPct(trend.changePct, locale)}
      </Badge>
    </div>
  );
}
