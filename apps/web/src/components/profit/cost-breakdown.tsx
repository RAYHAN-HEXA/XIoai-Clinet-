'use client';

import { useLocale, useTranslations } from 'next-intl';
import type { SummaryDto } from '@/lib/queries';
import { formatFen, formatPct } from '@/lib/format';
import { EvidenceNumber } from '@/components/evidence-number';

const COST_LINES = [
  { key: 'productCost', labelKey: 'colProductCost', metric: 'productCost' },
  { key: 'advertising', labelKey: 'colAdvertising', metric: 'advertising' },
  { key: 'influencerCommission', labelKey: 'colCommission', metric: 'influencerCommission' },
  { key: 'delivery', labelKey: 'colDelivery', metric: 'delivery' },
  { key: 'refunds', labelKey: 'colRefunds', metric: 'refunds' },
  { key: 'platformFees', labelKey: 'colPlatformFees', metric: 'platformFees' }
] as const;

/** Every cost counted exactly once, with its share of revenue (costRatiosPct). */
export function CostBreakdown({ summary }: { summary: SummaryDto }) {
  const t = useTranslations('profit');
  const tc = useTranslations('common');
  const locale = useLocale();
  const totalRatio = summary.revenue > 0 ? (summary.totalCosts / summary.revenue) * 100 : null;

  return (
    <ul className="divide-y rounded-md border">
      {COST_LINES.map((line) => (
        <li
          key={line.key}
          className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 px-3 py-2 text-sm"
        >
          <span>{t(line.labelKey)}</span>
          <span className="flex items-center gap-2">
            <EvidenceNumber metric={line.metric} valueFen={summary[line.key]} />
            <span className="min-w-[3.5rem] text-right text-xs tabular-nums text-muted-foreground">
              {formatPct(summary.costRatiosPct[line.key], locale)}
            </span>
          </span>
        </li>
      ))}
      <li className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 bg-muted/40 px-3 py-2 text-sm font-medium">
        <span>{tc('total')}</span>
        <span className="flex items-center gap-2">
          <span className="tabular-nums">{formatFen(summary.totalCosts, locale)}</span>
          <span className="min-w-[3.5rem] text-right text-xs tabular-nums text-muted-foreground">
            {formatPct(totalRatio, locale)}
          </span>
        </span>
      </li>
    </ul>
  );
}
