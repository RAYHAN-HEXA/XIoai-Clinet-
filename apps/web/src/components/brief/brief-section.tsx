'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { EmptyBlock } from '@/components/page-state';

/** One section of the Daily Brief: a card with its own empty state. */
export function BriefSection({
  title,
  hasData,
  empty,
  children
}: {
  title: string;
  hasData: boolean;
  empty?: string;
  children: React.ReactNode;
}) {
  return (
    <Card className="print:break-inside-avoid">
      <CardHeader className="pb-3">
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent>{hasData || !empty ? children : <EmptyBlock message={empty} />}</CardContent>
    </Card>
  );
}
