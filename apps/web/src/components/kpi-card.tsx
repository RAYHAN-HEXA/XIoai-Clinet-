'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

export function KpiCard({
  label,
  value,
  sub,
  loading,
  tone = 'default'
}: {
  label: string;
  value?: React.ReactNode;
  sub?: React.ReactNode;
  loading?: boolean;
  tone?: 'default' | 'negative' | 'positive' | 'warning';
}) {
  const toneClass =
    tone === 'negative' ? 'text-red-600' : tone === 'positive' ? 'text-emerald-600' : tone === 'warning' ? 'text-amber-600' : '';
  return (
    <Card>
      <CardHeader className="pb-1">
        <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <Skeleton className="h-8 w-28" />
        ) : (
          <div className={`text-2xl font-semibold tabular-nums ${toneClass}`}>{value}</div>
        )}
        {sub && <div className="mt-1 text-xs text-muted-foreground">{sub}</div>}
      </CardContent>
    </Card>
  );
}
