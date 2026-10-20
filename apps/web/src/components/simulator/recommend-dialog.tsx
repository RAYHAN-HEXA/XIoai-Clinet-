'use client';

import { useEffect, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/toast';
import { formatFen } from '@/lib/format';
import { useCreateRecommendation, type ForecastDto } from '@/lib/queries';

const OPTION_TITLE: Record<string, { en: string; zh: string }> = {
  SETTLEMENT_ADVANCE: { en: 'Settlement / receivables advance', zh: '回款提前 / 应收账款融资' }
};

function shortageText(forecast: ForecastDto, locale: string): string {
  if (forecast.firstShortageDay === null) return locale === 'zh' ? '30 天内无短缺' : 'No shortage within 30 days';
  return locale === 'zh' ? `第 ${forecast.firstShortageDay} 天` : `Day ${forecast.firstShortageDay}`;
}

export function RecommendDialog({
  base,
  scenario,
  prefill,
  open,
  onOpenChange
}: {
  base: ForecastDto | undefined;
  scenario: ForecastDto | undefined;
  prefill: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useTranslations('simulator');
  const tc = useTranslations('common');
  const locale = useLocale();
  const { push } = useToast();
  const [title, setTitle] = useState(prefill);
  const create = useCreateRecommendation();

  useEffect(() => {
    if (open) setTitle(prefill);
  }, [open, prefill]);

  if (!base) return null;

  const actual = scenario ?? base;

  function submit(): void {
    const trimmed = title.trim();
    if (!trimmed || create.isPending || !base || !actual) return;

    const evidence = [
      {
        label: { en: 'Base forecast — first shortage', zh: '基准预测——首次现金短缺' },
        value: { en: shortageText(base, 'en'), zh: shortageText(base, 'zh') }
      },
      {
        label: { en: 'Base forecast — minimum balance', zh: '基准预测——最低余额' },
        value: { en: formatFen(base.minBalanceFen, 'en'), zh: formatFen(base.minBalanceFen, 'zh') }
      },
      ...(scenario
        ? [
            {
              label: { en: 'Scenario forecast — first shortage', zh: '情景预测——首次现金短缺' },
              value: { en: shortageText(scenario, 'en'), zh: shortageText(scenario, 'zh') }
            },
            {
              label: { en: 'Scenario forecast — minimum balance', zh: '情景预测——最低余额' },
              value: { en: formatFen(scenario.minBalanceFen, 'en'), zh: formatFen(scenario.minBalanceFen, 'zh') }
            },
            {
              label: { en: 'Scenario forecast — day-30 balance', zh: '情景预测——第 30 天余额' },
              value: { en: formatFen(scenario.closingBalanceFen, 'en'), zh: formatFen(scenario.closingBalanceFen, 'zh') }
            }
          ]
        : [])
    ];
    const impact = {
      baseFirstShortageDay: base.firstShortageDay,
      baseMinBalanceFen: base.minBalanceFen,
      scenarioActive: scenario !== undefined,
      scenarioFirstShortageDay: actual.firstShortageDay,
      scenarioMinBalanceFen: actual.minBalanceFen,
      scenarioClosingBalanceFen: actual.closingBalanceFen
    };
    const action = {
      optionId: 'SETTLEMENT_ADVANCE',
      optionTitle: OPTION_TITLE['SETTLEMENT_ADVANCE'],
      requiresOwnerDecision: true,
      executesNothing: true
    };

    create.mutate(
      { type: 'SETTLEMENT_ADVANCE', title: trimmed, evidence, impact, action },
      {
        onSuccess: () => {
          push(t('recSubmitted'), 'success');
          onOpenChange(false);
        },
        onError: (err) => push(err instanceof Error ? err.message : tc('loadError'), 'error')
      }
    );
  }

  return (
    <Dialog
      open={open}
      onClose={() => onOpenChange(false)}
      title={t('submitRecommendation')}
      footer={
        <>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={create.isPending}>
            {tc('cancel')}
          </Button>
          <Button type="button" onClick={submit} disabled={create.isPending || title.trim().length === 0}>
            {create.isPending ? tc('loading') : tc('confirm')}
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <div>
          <Label htmlFor="rec-title" className="mb-1 block text-xs text-muted-foreground">
            {t('recTitle')}
          </Label>
          <Input id="rec-title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={160} />
        </div>
        <dl className="space-y-1 rounded-md border p-3 text-xs">
          <div className="flex justify-between gap-3">
            <dt className="text-muted-foreground">{t('shortageDay')}</dt>
            <dd className="tabular-nums">{actual.firstShortageDay ?? t('noShortage')}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-muted-foreground">{t('minBalance')}</dt>
            <dd className="tabular-nums">{formatFen(actual.minBalanceFen, locale)}</dd>
          </div>
        </dl>
        <p className="text-xs text-muted-foreground">{t('assumptionNote')}</p>
      </div>
    </Dialog>
  );
}
