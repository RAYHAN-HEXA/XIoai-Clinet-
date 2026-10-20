'use client';

import * as React from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { ChevronDown, ChevronRight } from 'lucide-react';
import type { DriverDto } from '@/lib/queries';
import { formatDate, formatFen, formatPct, loc } from '@/lib/format';
import { Badge } from '@/components/ui/badge';
import { TableScroll, Table, THead, TBody, TR, TH, TD } from '@/components/ui/table';

function impactBadge(impact: DriverDto['impactOnProfit']): {
  variant: 'positive' | 'critical' | 'muted';
  key: 'positive' | 'negative' | 'none';
} {
  if (impact === 'POSITIVE') return { variant: 'positive', key: 'positive' };
  if (impact === 'NEGATIVE') return { variant: 'critical', key: 'negative' };
  return { variant: 'muted', key: 'none' };
}

/** Period-over-period driver table with a per-row evidence expander. */
export function DriverTable({ drivers }: { drivers: DriverDto[] }) {
  const t = useTranslations('drivers');
  const tc = useTranslations('common');
  const locale = useLocale();
  const [openId, setOpenId] = React.useState<string | null>(null);

  return (
    <TableScroll>
      <Table>
        <THead>
          <TH>{t('colDriver')}</TH>
          <TH className="text-right">{t('colPrevious')}</TH>
          <TH className="text-right">{t('colCurrent')}</TH>
          <TH className="text-right">{t('colChange')}</TH>
          <TH className="text-right">{t('colPct')}</TH>
          <TH className="text-right">{t('colContribution')}</TH>
          <TH className="text-right">{tc('actions')}</TH>
        </THead>
        <TBody>
          {drivers.map((d) => {
            const open = openId === d.id;
            const badge = impactBadge(d.impactOnProfit);
            return (
              <React.Fragment key={d.id}>
                <TR className={open ? 'bg-muted/40' : undefined}>
                  <TD className="font-medium">{loc(d.label, locale)}</TD>
                  <TD className="whitespace-nowrap text-right tabular-nums">{formatFen(d.previousValue, locale)}</TD>
                  <TD className="whitespace-nowrap text-right tabular-nums">{formatFen(d.currentValue, locale)}</TD>
                  <TD className="whitespace-nowrap text-right tabular-nums">{formatFen(d.absDiff, locale)}</TD>
                  <TD className="whitespace-nowrap text-right tabular-nums">
                    {d.pctDiff === null ? t('pctUnavailable') : formatPct(d.pctDiff, locale)}
                  </TD>
                  <TD className="text-right">
                    <span className="flex flex-wrap items-center justify-end gap-1.5">
                      <span className="whitespace-nowrap tabular-nums">
                        {formatFen(d.contributionToFenProfitChange, locale)}
                      </span>
                      <Badge variant={badge.variant}>{t(badge.key)}</Badge>
                    </span>
                  </TD>
                  <TD className="text-right">
                    <button
                      type="button"
                      onClick={() => setOpenId(open ? null : d.id)}
                      aria-expanded={open}
                      className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
                    >
                      {open ? <ChevronDown className="h-3.5 w-3.5" aria-hidden /> : <ChevronRight className="h-3.5 w-3.5" aria-hidden />}
                      {t('details')}
                    </button>
                  </TD>
                </TR>
                {open && (
                  <TR className="hover:bg-transparent">
                    <TD colSpan={7} className="bg-muted/30">
                      <div className="space-y-3 py-1">
                        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                          {t('evidenceCount', { count: d.evidenceRefs.length })}
                        </p>
                        {d.evidenceRefs.length === 0 ? (
                          <p className="text-sm text-muted-foreground">{tc('empty')}</p>
                        ) : (
                          <ul className="space-y-1.5">
                            {d.evidenceRefs.map((ref) => (
                              <li
                                key={`${ref.type}-${ref.id}`}
                                className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 rounded border bg-card px-3 py-1.5 text-xs"
                              >
                                <span className="min-w-0 flex-1 break-words">{ref.label}</span>
                                <span className="flex items-center gap-3 whitespace-nowrap tabular-nums text-muted-foreground">
                                  <span>{formatFen(ref.amountFen, locale)}</span>
                                  <span>{formatDate(ref.dateISO, locale)}</span>
                                </span>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    </TD>
                  </TR>
                )}
              </React.Fragment>
            );
          })}
        </TBody>
      </Table>
    </TableScroll>
  );
}
