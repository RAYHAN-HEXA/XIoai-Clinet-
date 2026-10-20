'use client';

import { useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { X, AlertTriangle, FileText } from 'lucide-react';
import { useEvidence, type EvidenceTreeDto } from '@/lib/queries';
import { formatFen, loc } from '@/lib/format';
import { Skeleton } from '@/components/ui/skeleton';

/**
 * <EvidenceNumber metric="realProfit">¥29,969</EvidenceNumber>
 * Every ¥ figure on screen is clickable: opens the 3-level drill-down drawer
 * (Level 1 headline → Level 2 breakdown → Level 3 raw records) with disclosed
 * gaps (unmapped products, MISSING_DOC) shown, never hidden.
 */
export function EvidenceNumber({
  metric,
  valueFen,
  children,
  className = ''
}: {
  metric: string;
  valueFen: number;
  children?: React.ReactNode;
  className?: string;
}) {
  const t = useTranslations('evidence');
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title={t('tapToSee')}
        className={`underline decoration-dotted decoration-muted-foreground/50 underline-offset-4 hover:text-primary transition-colors ${className}`}
      >
        {children ?? formatFen(valueFen)}
      </button>
      {open && <EvidenceDrawer metric={metric} onClose={() => setOpen(false)} />}
    </>
  );
}

function EvidenceDrawer({ metric, onClose }: { metric: string; onClose: () => void }) {
  const t = useTranslations('evidence');
  const locale = useLocale();
  const { data, isLoading } = useEvidence(metric);

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/40" onClick={onClose} role="dialog" aria-modal>
      <div
        className="h-full w-full max-w-lg overflow-y-auto bg-card p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">{t('title')}</p>
            {data ? (
              <>
                <h2 className="text-lg font-semibold">{loc(data.level1.label, locale)}</h2>
                <p className="text-2xl font-bold">{formatFen(data.level1.valueFen, locale)}</p>
                <p className="mt-1 text-xs text-muted-foreground">{loc(data.level1.formula, locale)}</p>
              </>
            ) : (
              <Skeleton className="mt-2 h-8 w-40" />
            )}
          </div>
          <button onClick={onClose} aria-label={t('close')} className="rounded p-1 hover:bg-muted">
            <X className="h-5 w-5" />
          </button>
        </div>

        {isLoading && <Skeleton className="h-40 w-full" />}

        {data && (
          <div className="space-y-6">
            {data.warnings.length > 0 && (
              <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900">
                {data.warnings.map((w, i) => (
                  <p key={i} className="flex items-start gap-2">
                    <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {loc(w, locale)}
                  </p>
                ))}
              </div>
            )}

            <section>
              <h3 className="mb-2 text-sm font-semibold text-muted-foreground">{t('level2')}</h3>
              <ul className="divide-y rounded-md border">
                {data.level2.map((c) => (
                  <li key={c.key} className="flex items-center justify-between px-3 py-2 text-sm">
                    <span>{loc(c.label, locale)}</span>
                    <span className="tabular-nums">
                      {formatFen(c.valueFen, locale)}
                      {c.sharePct !== null && <span className="ml-2 text-xs text-muted-foreground">{c.sharePct}%</span>}
                    </span>
                  </li>
                ))}
              </ul>
            </section>

            <section>
              <h3 className="mb-2 text-sm font-semibold text-muted-foreground">{t('level3')}</h3>
              <ul className="space-y-1.5">
                {data.level3.map((r) => (
                  <li key={r.id} className="flex items-center justify-between rounded border px-3 py-1.5 text-xs">
                    <span className="flex items-center gap-2">
                      <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                      {r.label}
                    </span>
                    <span className="tabular-nums text-muted-foreground">
                      {formatFen(r.amountFen, locale)} · {r.dateISO.slice(0, 10)}
                    </span>
                  </li>
                ))}
              </ul>
            </section>

            <p className="text-[11px] text-muted-foreground">{t('footer')}</p>
          </div>
        )}
      </div>
    </div>
  );
}

export type { EvidenceTreeDto };
