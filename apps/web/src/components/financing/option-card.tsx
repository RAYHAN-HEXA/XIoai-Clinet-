'use client';

import { useLocale, useTranslations } from 'next-intl';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { loc } from '@/lib/format';
import type { FinancingOptionDto } from '@/lib/queries';

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h4 className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</h4>
      {children}
    </div>
  );
}

export function OptionCard({ option }: { option: FinancingOptionDto }) {
  const t = useTranslations('financing');
  const locale = useLocale();

  return (
    <Card className="flex h-full flex-col">
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <CardTitle className="text-base leading-snug">{loc(option.name, locale)}</CardTitle>
          <Badge variant="muted">{`${t('rank')} ${option.rank}`}</Badge>
        </div>
        <div className="flex flex-wrap gap-1.5 pt-1">
          <Badge variant="default">{loc(option.costLabel, locale)}</Badge>
          <Badge variant="default">{loc(option.speedLabel, locale)}</Badge>
        </div>
      </CardHeader>
      <CardContent className="flex-1 space-y-3 text-sm">
        <Section title={t('bestWhen')}>
          <p>{loc(option.bestWhen, locale)}</p>
        </Section>
        <Section title={t('documents')}>
          <ul className="list-disc space-y-0.5 pl-5">
            {option.documents.map((d, i) => (
              <li key={i}>{loc(d, locale)}</li>
            ))}
          </ul>
        </Section>
        <Section title={t('risks')}>
          <ul className="list-disc space-y-0.5 pl-5">
            {option.risks.map((r, i) => (
              <li key={i}>{loc(r, locale)}</li>
            ))}
          </ul>
        </Section>
        <Section title={t('matchedOn')}>
          <p className="text-muted-foreground">{loc(option.matchedOn, locale)}</p>
        </Section>
      </CardContent>
    </Card>
  );
}
