'use client';

import { useEffect, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { ErrorBlock, LoadingBlock } from '@/components/page-state';
import { usePreviewScenario } from '@/lib/queries';
import { AskBox } from './ask-box';
import { ForecastPanel } from './forecast-panel';
import { RecommendDialog } from './recommend-dialog';
import { SavedScenarios } from './saved-scenarios';
import { ScenarioControls } from './scenario-controls';
import { ZERO_PARAMS, clampParams, isZeroParams, useForecastWithSpec, type ScenarioParams } from './types';

const DEBOUNCE_MS = 400;

export function SimulatorClient() {
  const t = useTranslations('simulator');
  const tc = useTranslations('common');
  const locale = useLocale();

  const forecast = useForecastWithSpec();
  const [params, setParams] = useState<ScenarioParams>(ZERO_PARAMS);
  const [debounced, setDebounced] = useState<ScenarioParams | null>(null);
  const [recOpen, setRecOpen] = useState(false);

  useEffect(() => {
    if (isZeroParams(params)) {
      setDebounced(null);
      return;
    }
    const timer = window.setTimeout(() => setDebounced(params), DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [params]);

  const preview = usePreviewScenario(debounced);

  if (forecast.isLoading) return <LoadingBlock rows={6} />;

  if (forecast.isError || !forecast.data) {
    return (
      <div className="space-y-3">
        <ErrorBlock message={tc('loadError')} />
        <Button type="button" variant="outline" size="sm" onClick={() => forecast.refetch()}>
          {tc('retry')}
        </Button>
      </div>
    );
  }

  const { spec, base } = forecast.data;
  const scenario = preview.data?.result;
  const hypothetical = !isZeroParams(params);
  const firstShortageDay = scenario?.firstShortageDay ?? base.firstShortageDay;

  const obligations = [...spec.supplierObligations].sort((a, b) => a.dueInDays - b.dueInDays || a.label.localeCompare(b.label));

  const option = locale === 'zh' ? '回款提前' : 'Settlement advance';
  const gapPart =
    firstShortageDay !== null
      ? locale === 'zh'
        ? `第 ${firstShortageDay} 天缺口`
        : `day ${firstShortageDay} gap`
      : locale === 'zh'
        ? '30 天内无短缺'
        : 'no shortage in 30 days';
  const recPrefill = `${option} — ${gapPart}`;

  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-5">
        <div className="space-y-4 lg:col-span-2">
          <ScenarioControls params={params} onChange={setParams} onReset={() => setParams(ZERO_PARAMS)} />
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => setRecOpen(true)}>
              {t('submitRecommendation')}
            </Button>
          </div>
        </div>
        <div className="min-w-0 lg:col-span-3">
          <ForecastPanel
            base={base}
            scenario={scenario}
            hypothetical={hypothetical}
            obligations={obligations}
            loading={preview.isFetching}
          />
        </div>
      </div>

      {preview.isError && (
        <div className="space-y-2">
          <ErrorBlock message={tc('loadError')} />
          <Button type="button" variant="outline" size="sm" onClick={() => preview.refetch()}>
            {tc('retry')}
          </Button>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <SavedScenarios
          currentParams={params}
          onLoad={(p) => setParams(clampParams(p))}
        />
        <AskBox
          onApplyParams={(p) => {
            setParams(clampParams(p));
          }}
        />
      </div>

      <RecommendDialog
        base={base}
        scenario={scenario}
        prefill={recPrefill}
        open={recOpen}
        onOpenChange={setRecOpen}
      />
    </div>
  );
}
