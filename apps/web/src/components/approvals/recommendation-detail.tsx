'use client';

import { useTranslations } from 'next-intl';
import { EmptyBlock } from '@/components/page-state';
import { loc } from '@/lib/format';
import type { ApprovalDto } from '@/lib/queries';

type Localized = { en: string; zh: string };

function isLocalized(value: unknown): value is Localized {
  return (
    !!value &&
    typeof value === 'object' &&
    typeof (value as Localized).en === 'string' &&
    typeof (value as Localized).zh === 'string'
  );
}

function isImpact(value: unknown): value is { headline: Localized; detail: Localized } {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const o = value as { headline?: unknown; detail?: unknown };
  return isLocalized(o.headline) && isLocalized(o.detail);
}

function isAction(value: unknown): value is { headline: Localized; steps: Localized[] } {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const o = value as { headline?: unknown; steps?: unknown };
  return isLocalized(o.headline) && Array.isArray(o.steps) && o.steps.every(isLocalized);
}

/** Unknown payload shape → show the raw JSON rather than crash or invent a reading. */
function JsonFallback({ value }: { value: unknown }) {
  return (
    <pre className="max-h-64 overflow-auto whitespace-pre-wrap break-words rounded-md bg-muted p-3 text-xs leading-relaxed">
      {JSON.stringify(value, null, 2)}
    </pre>
  );
}

function EvidenceList({ value, locale, emptyLabel }: { value: unknown; locale: string; emptyLabel: string }) {
  if (!Array.isArray(value)) return <JsonFallback value={value} />;
  if (value.length === 0) return <EmptyBlock message={emptyLabel} />;
  return (
    <ul className="divide-y rounded-md border">
      {value.map((item, i) => {
        const row = item as { label?: unknown; value?: unknown } | null;
        if (row && typeof row === 'object' && isLocalized(row.label) && isLocalized(row.value)) {
          return (
            <li key={i} className="flex items-start justify-between gap-3 px-3 py-2 text-sm">
              <span className="min-w-0">{loc(row.label, locale)}</span>
              <span className="shrink-0 text-right font-medium tabular-nums">{loc(row.value, locale)}</span>
            </li>
          );
        }
        return (
          <li key={i} className="px-3 py-2">
            <JsonFallback value={item} />
          </li>
        );
      })}
    </ul>
  );
}

function ImpactBlock({ value, locale }: { value: unknown; locale: string }) {
  if (!isImpact(value)) return <JsonFallback value={value} />;
  return (
    <div className="rounded-md border p-3">
      <p className="font-medium">{loc(value.headline, locale)}</p>
      <p className="mt-1 text-sm text-muted-foreground">{loc(value.detail, locale)}</p>
    </div>
  );
}

function ActionBlock({ value, locale }: { value: unknown; locale: string }) {
  if (!isAction(value)) return <JsonFallback value={value} />;
  return (
    <div className="rounded-md border p-3">
      <p className="font-medium">{loc(value.headline, locale)}</p>
      {value.steps.length > 0 && (
        <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-muted-foreground">
          {value.steps.map((s, i) => (
            <li key={i}>{loc(s, locale)}</li>
          ))}
        </ol>
      )}
    </div>
  );
}

/** Evidence · Impact · Action — the fixed shape of every recommendation. */
export function RecommendationBody({
  recommendation,
  locale
}: {
  recommendation: ApprovalDto['recommendation'];
  locale: string;
}) {
  const t = useTranslations('approvals');
  const tc = useTranslations('common');
  return (
    <div className="space-y-4">
      <section>
        <h4 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t('evidence')}</h4>
        <EvidenceList value={recommendation.evidence} locale={locale} emptyLabel={tc('empty')} />
      </section>
      <section>
        <h4 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t('impact')}</h4>
        <ImpactBlock value={recommendation.impact} locale={locale} />
      </section>
      <section>
        <h4 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t('action')}</h4>
        <ActionBlock value={recommendation.action} locale={locale} />
      </section>
    </div>
  );
}
