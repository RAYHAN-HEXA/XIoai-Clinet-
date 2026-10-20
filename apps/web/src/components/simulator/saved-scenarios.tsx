'use client';

import { useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { EmptyBlock, ErrorBlock, LoadingBlock } from '@/components/page-state';
import { useToast } from '@/components/toast';
import { formatDate, formatFen } from '@/lib/format';
import { useSaveScenario, useScenarios, type ScenarioDto } from '@/lib/queries';
import type { ScenarioParams } from './types';

function paramChips(p: ScenarioDto['params']): Array<{ key: string; text: string }> {
  const chips: Array<{ key: string; text: string }> = [];
  if (p.salesChangePct !== 0) chips.push({ key: 'sales', text: `${p.salesChangePct > 0 ? '+' : ''}${p.salesChangePct}%` });
  if (p.supplierCostChangePct !== 0)
    chips.push({ key: 'supplier', text: `${p.supplierCostChangePct > 0 ? '+' : ''}${p.supplierCostChangePct}%` });
  if (p.settlementDelayDays !== 0) chips.push({ key: 'delay', text: `+${p.settlementDelayDays}d` });
  if (p.adSpendChangePct !== 0) chips.push({ key: 'ads', text: `${p.adSpendChangePct > 0 ? '+' : ''}${p.adSpendChangePct}%` });
  return chips;
}

export function SavedScenarios({
  currentParams,
  onLoad
}: {
  currentParams: ScenarioParams;
  onLoad: (p: ScenarioParams) => void;
}) {
  const t = useTranslations('simulator');
  const tc = useTranslations('common');
  const locale = useLocale();
  const { push } = useToast();
  const [name, setName] = useState('');
  const save = useSaveScenario();
  const { data, isLoading, isError, refetch } = useScenarios();

  function handleSave(e: React.FormEvent): void {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed || save.isPending) return;
    save.mutate(
      { name: trimmed, params: currentParams },
      {
        onSuccess: () => {
          push(t('saved'), 'success');
          setName('');
        },
        onError: (err) => push(err instanceof Error ? err.message : tc('loadError'), 'error')
      }
    );
  }

  const scenarios = data?.scenarios ?? [];

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium text-muted-foreground">{t('saveScenario')}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <form onSubmit={handleSave} className="flex flex-wrap items-end gap-2">
          <div className="min-w-0 flex-1 basis-56">
            <Label htmlFor="scenario-name" className="mb-1 block text-xs text-muted-foreground">
              {t('scenarioName')}
            </Label>
            <Input
              id="scenario-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={80}
              placeholder={t('scenarioName')}
            />
          </div>
          <Button type="submit" size="sm" disabled={save.isPending || name.trim().length === 0}>
            {tc('save')}
          </Button>
        </form>

        <div>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {t('savedScenarios')}
          </h3>
          {isLoading ? (
            <LoadingBlock rows={3} />
          ) : isError ? (
            <div className="space-y-2">
              <ErrorBlock message={tc('loadError')} />
              <Button type="button" variant="outline" size="sm" onClick={() => refetch()}>
                {tc('retry')}
              </Button>
            </div>
          ) : scenarios.length === 0 ? (
            <EmptyBlock message={tc('empty')} />
          ) : (
            <ul className="space-y-2">
              {scenarios.map((s) => {
                const chips = paramChips(s.params);
                return (
                  <li
                    key={s.id}
                    className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 rounded-md border p-3"
                  >
                    <div className="min-w-0 flex-1 basis-52">
                      <p className="truncate text-sm font-medium">{s.name}</p>
                      <div className="mt-1 flex flex-wrap gap-1">
                        {chips.length === 0 ? (
                          <Badge variant="muted">—</Badge>
                        ) : (
                          chips.map((c) => (
                            <Badge key={c.key} variant="muted">
                              {c.text}
                            </Badge>
                          ))
                        )}
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs tabular-nums text-muted-foreground">
                      <span>
                        {t('shortageDay')}: {s.result.firstShortageDay ?? '—'}
                      </span>
                      <span>{formatFen(s.result.minBalanceFen, locale)}</span>
                      <span>{formatDate(s.createdAt, locale)}</span>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        onLoad(s.params);
                        push(t('loaded'), 'success');
                      }}
                    >
                      {t('load')}
                    </Button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
