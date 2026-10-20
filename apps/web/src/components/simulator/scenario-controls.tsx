'use client';

import { useTranslations } from 'next-intl';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { formatPct } from '@/lib/format';
import { CLAMPS, isZeroParams, type ScenarioParams } from './types';

function PercentSlider({
  id,
  label,
  hint,
  value,
  min,
  max,
  onChange
}: {
  id: string;
  label: string;
  hint?: string;
  value: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
}) {
  return (
    <div>
      <div className="flex items-baseline justify-between gap-2">
        <label htmlFor={id} className="text-sm font-medium">
          {label}
        </label>
        <span id={`${id}-value`} className="text-sm font-semibold tabular-nums">
          {formatPct(value)}
        </span>
      </div>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={1}
        value={value}
        aria-valuetext={formatPct(value)}
        onChange={(e) => onChange(Number(e.target.value))}
        className="mt-1.5 h-2 w-full cursor-pointer appearance-none rounded-full bg-muted accent-primary"
      />
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

function DelaySlider({
  value,
  onChange
}: {
  value: number;
  onChange: (v: number) => void;
}) {
  const t = useTranslations('simulator');
  return (
    <div>
      <div className="flex items-baseline justify-between gap-2">
        <label htmlFor="sc-delay" className="text-sm font-medium">
          {t('settlementDelay')}
        </label>
        <span className="text-sm font-semibold tabular-nums">{value}</span>
      </div>
      <input
        id="sc-delay"
        type="range"
        min={CLAMPS.delayMin}
        max={CLAMPS.delayMax}
        step={1}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="mt-1.5 h-2 w-full cursor-pointer appearance-none rounded-full bg-muted accent-primary"
      />
      <p className="mt-1 text-xs text-muted-foreground">{t('delayHint')}</p>
    </div>
  );
}

export function ScenarioControls({
  params,
  onChange,
  onReset
}: {
  params: ScenarioParams;
  onChange: (p: ScenarioParams) => void;
  onReset: () => void;
}) {
  const t = useTranslations('simulator');
  const hypothetical = !isZeroParams(params);

  return (
    <section className="rounded-lg border bg-card p-4 shadow-sm">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold">{t('controls')}</h2>
        {hypothetical && (
          <Badge variant="warning" data-testid="scenario-badge">
            {t('scenarioBadge')}
          </Badge>
        )}
      </div>
      <div className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
        <PercentSlider
          id="sc-sales"
          label={t('salesChange')}
          hint={t('sliderHint')}
          value={params.salesChangePct}
          min={CLAMPS.percentMin}
          max={CLAMPS.percentMax}
          onChange={(v) => onChange({ ...params, salesChangePct: v })}
        />
        <PercentSlider
          id="sc-supplier"
          label={t('supplierChange')}
          hint={t('sliderHint')}
          value={params.supplierCostChangePct}
          min={CLAMPS.percentMin}
          max={CLAMPS.percentMax}
          onChange={(v) => onChange({ ...params, supplierCostChangePct: v })}
        />
        <DelaySlider value={params.settlementDelayDays} onChange={(v) => onChange({ ...params, settlementDelayDays: v })} />
        <PercentSlider
          id="sc-ads"
          label={t('adChange')}
          hint={t('sliderHint')}
          value={params.adSpendChangePct}
          min={CLAMPS.percentMin}
          max={CLAMPS.percentMax}
          onChange={(v) => onChange({ ...params, adSpendChangePct: v })}
        />
      </div>
      <div className="mt-4">
        <Button type="button" variant="outline" size="sm" onClick={onReset} disabled={hypothetical === false}>
          {t('resetToBase')}
        </Button>
      </div>
    </section>
  );
}
