'use client';

import * as React from 'react';
import { useLocale, useTranslations } from 'next-intl';
import type { GroupRowDto } from '@/lib/queries';
import { formatFen, formatPct } from '@/lib/format';
import { TableScroll, Table, THead, TBody, TR, TH, TD } from '@/components/ui/table';

export type ProfitTab = 'product' | 'campaign' | 'channel';

export type GroupSortKey =
  | 'label'
  | 'revenue'
  | 'productCost'
  | 'advertising'
  | 'influencerCommission'
  | 'delivery'
  | 'refunds'
  | 'platformFees'
  | 'profit'
  | 'marginPct'
  | 'orders'
  | 'roas';

interface ColumnDef {
  key: GroupSortKey;
  header: string;
  numeric?: boolean;
  cell: (row: GroupRowDto, locale: string) => React.ReactNode;
}

function Num({ children }: { children: React.ReactNode }) {
  return <span className="whitespace-nowrap tabular-nums">{children}</span>;
}

function moneyCell(pick: (row: GroupRowDto) => number): (row: GroupRowDto, locale: string) => React.ReactNode {
  return function cell(row: GroupRowDto, locale: string): React.ReactNode {
    return <Num>{formatFen(pick(row), locale)}</Num>;
  };
}

export function GroupTable({
  tab,
  rows,
  sortKey,
  sortDir,
  onSort
}: {
  tab: ProfitTab;
  rows: GroupRowDto[];
  sortKey: GroupSortKey;
  sortDir: 'asc' | 'desc';
  onSort: (key: GroupSortKey) => void;
}) {
  const t = useTranslations('profit');
  const locale = useLocale();

  const columns: ColumnDef[] = React.useMemo(() => {
    const name: ColumnDef = {
      key: 'label',
      header: t('colName'),
      cell: (r) => <span className="font-medium">{r.label}</span>
    };
    const revenue: ColumnDef = { key: 'revenue', header: t('colRevenue'), numeric: true, cell: moneyCell((r) => r.revenue) };
    const productCost: ColumnDef = { key: 'productCost', header: t('colProductCost'), numeric: true, cell: moneyCell((r) => r.productCost) };
    const advertising: ColumnDef = { key: 'advertising', header: t('colAdvertising'), numeric: true, cell: moneyCell((r) => r.advertising ?? 0) };
    const commission: ColumnDef = {
      key: 'influencerCommission',
      header: t('colCommission'),
      numeric: true,
      cell: moneyCell((r) => r.influencerCommission)
    };
    const delivery: ColumnDef = { key: 'delivery', header: t('colDelivery'), numeric: true, cell: moneyCell((r) => r.delivery) };
    const refunds: ColumnDef = { key: 'refunds', header: t('colRefunds'), numeric: true, cell: moneyCell((r) => r.refunds) };
    const platformFees: ColumnDef = { key: 'platformFees', header: t('colPlatformFees'), numeric: true, cell: moneyCell((r) => r.platformFees) };
    const profit: ColumnDef = { key: 'profit', header: t('colProfit'), numeric: true, cell: moneyCell((r) => r.profit) };
    const margin: ColumnDef = {
      key: 'marginPct',
      header: t('colMargin'),
      numeric: true,
      cell: (r, l) => (
        <Num>{formatPct(r.marginPct, l)}</Num>
      )
    };
    const orders: ColumnDef = {
      key: 'orders',
      header: t('colOrders'),
      numeric: true,
      cell: (r) => (
        <Num>{r.orders}</Num>
      )
    };
    const roas: ColumnDef = {
      key: 'roas',
      header: t('colRoas'),
      numeric: true,
      cell: (r) => <Num>{r.roas === null ? '—' : `${r.roas.toFixed(2)}×`}</Num>
    };

    if (tab === 'campaign') return [name, revenue, advertising, profit, margin, roas];
    if (tab === 'channel')
      return [name, revenue, productCost, advertising, commission, delivery, refunds, platformFees, profit, margin, orders];
    return [name, revenue, productCost, commission, delivery, refunds, platformFees, profit, margin, orders];
  }, [tab, t]);

  return (
    <TableScroll>
      <Table>
        <THead>
          {columns.map((c) => (
            <TH
              key={c.key}
              sortable
              active={sortKey === c.key}
              direction={sortDir}
              onSort={() => onSort(c.key)}
              className={c.numeric ? 'text-right' : undefined}
            >
              {c.header}
            </TH>
          ))}
        </THead>
        <TBody>
          {rows.map((r) => (
            <TR key={r.key}>
              {columns.map((c) => (
                <TD key={c.key} className={c.numeric ? 'text-right' : undefined}>
                  {c.cell(r, locale)}
                </TD>
              ))}
            </TR>
          ))}
        </TBody>
      </Table>
    </TableScroll>
  );
}
