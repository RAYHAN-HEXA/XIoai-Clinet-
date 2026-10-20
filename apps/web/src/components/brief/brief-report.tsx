'use client';

import { useLocale, useTranslations } from 'next-intl';
import { Copy, Printer } from 'lucide-react';
import { useToast } from '@/components/toast';
import { DemoBanner } from '@/components/demo-banner';
import { Button } from '@/components/ui/button';
import { ErrorBlock, LoadingBlock, PageHeader } from '@/components/page-state';
import { formatDate, formatFen, formatPct } from '@/lib/format';
import { useBrief, type BriefDto } from '@/lib/queries';
import { BriefSection } from './brief-section';
import {
  ApprovalsNeeded,
  CashRiskCard,
  MissingDocs,
  OverdueInvoices,
  RisingCosts,
  RevenueTrendCard,
  UrgentPayments
} from './brief-sections';
import { urgencyMeta } from './brief-urgency';

/** The API returns asOfISO on the brief payload; queries.ts DTO predates it. */
type BriefWithAsOf = BriefDto & { asOfISO?: string };

/** Print stylesheet — the app chrome lives in the (app) layout, so it is
 *  suppressed here rather than by editing layout files. */
const PRINT_CSS = '@media print { aside, header, nav { display: none !important; } main { padding: 0 !important; } }';

async function copyToClipboard(text: string): Promise<void> {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.setAttribute('readonly', '');
  ta.style.position = 'fixed';
  ta.style.opacity = '0';
  document.body.appendChild(ta);
  ta.select();
  document.execCommand('copy');
  ta.remove();
}

export function BriefReport() {
  const t = useTranslations('brief');
  const tc = useTranslations('common');
  const locale = useLocale();
  const { push } = useToast();
  const { data, isPending, isError, refetch } = useBrief(locale);

  const brief = data?.brief as BriefWithAsOf | undefined;
  const isDemo = data?.isDemo === true;

  const buildBriefText = (): string => {
    if (!brief) return '';
    const L: string[] = [];
    L.push(t('title'));
    L.push(`${t('reportDate')}: ${formatDate(brief.asOfISO, locale)}`);
    L.push('');

    L.push(t('urgentPayments'));
    if (brief.urgentPayments.length === 0) {
      L.push(t('noUrgent'));
    } else {
      for (const p of brief.urgentPayments) {
        const meta = urgencyMeta(p.urgency);
        const urgencyLabel = meta ? t(meta.key) : p.urgency;
        L.push(`- ${p.label}: ${formatFen(p.amountFen, locale)} · ${formatDate(p.dueDate, locale)} · ${urgencyLabel}`);
      }
    }
    L.push('');

    L.push(t('overdue'));
    if (brief.overdueInvoices.length === 0) {
      L.push(t('noOverdue'));
    } else {
      for (const inv of brief.overdueInvoices) {
        L.push(`- ${inv.label}: ${formatFen(inv.amountFen, locale)} · ${formatDate(inv.dueDate, locale)}`);
      }
    }
    L.push('');

    L.push(t('risingCosts'));
    if (brief.risingCosts.length === 0) {
      L.push(t('noRising'));
    } else {
      for (const c of brief.risingCosts) {
        L.push(
          `- ${locale === 'zh' ? c.category.zh : c.category.en}: ${formatFen(c.previousFen, locale)} -> ${formatFen(
            c.currentFen,
            locale
          )} (${formatPct(c.changePct, locale)})`
        );
      }
    }
    L.push('');

    L.push(t('approvals'));
    if (brief.approvalsNeeded.length === 0) {
      L.push(t('noApprovals'));
    } else {
      for (const a of brief.approvalsNeeded) L.push(`- ${a.title}`);
    }
    L.push('');

    L.push(t('missingDocs'));
    if (brief.missingDocs.length === 0) {
      L.push(t('noMissingDocs'));
    } else {
      for (const inv of brief.missingDocs) {
        L.push(`- ${inv.label}: ${formatFen(inv.amountFen, locale)} · ${formatDate(inv.dueDate, locale)}`);
      }
    }
    L.push('');

    L.push(t('cashRisk'));
    if (!brief.cashRisk || brief.cashRisk.firstShortageDay === null) {
      L.push(t('cashOk'));
    } else {
      L.push(
        t('cashShort', {
          day: brief.cashRisk.firstShortageDay,
          min: formatFen(brief.cashRisk.minBalanceFen, locale)
        })
      );
    }
    L.push('');

    L.push(t('revenueTrend'));
    L.push(
      `${tc('last7')}: ${formatFen(brief.revenueTrend.last7Fen, locale)} · ${tc('prev')}: ${formatFen(
        brief.revenueTrend.prior7Fen,
        locale
      )} (${formatPct(brief.revenueTrend.changePct, locale)})`
    );
    L.push('');
    L.push(t('footer'));
    return L.join('\n');
  };

  const onCopy = async (): Promise<void> => {
    if (!brief) return;
    try {
      await copyToClipboard(buildBriefText());
      push(tc('copied'), 'success');
    } catch {
      push(tc('loadError'), 'error');
    }
  };

  const onPrint = (): void => {
    window.print();
  };

  return (
    <div className="mx-auto max-w-5xl space-y-4 print:max-w-none">
      <style dangerouslySetInnerHTML={{ __html: PRINT_CSS }} />
      <PageHeader
        title={t('title')}
        subtitle={t('subtitle')}
        right={
          <div className="flex flex-wrap gap-2 print:hidden">
            <Button variant="outline" size="sm" onClick={() => void onCopy()} disabled={!brief}>
              <Copy className="h-4 w-4" aria-hidden />
              {t('copy')}
            </Button>
            <Button variant="outline" size="sm" onClick={onPrint}>
              <Printer className="h-4 w-4" aria-hidden />
              {t('print')}
            </Button>
          </div>
        }
      />

      {isDemo && <DemoBanner />}

      {isPending && <LoadingBlock rows={6} />}

      {isError && (
        <div className="space-y-3">
          <ErrorBlock message={tc('loadError')} />
          <Button variant="outline" size="sm" onClick={() => void refetch()}>
            {tc('retry')}
          </Button>
        </div>
      )}

      {brief && (
        <>
          <p className="text-sm text-muted-foreground">
            {t('reportDate')}: {formatDate(brief.asOfISO, locale)}
          </p>

          <div className="space-y-4">
            <BriefSection title={t('urgentPayments')} hasData={brief.urgentPayments.length > 0} empty={t('noUrgent')}>
              <UrgentPayments items={brief.urgentPayments} />
            </BriefSection>

            <BriefSection title={t('overdue')} hasData={brief.overdueInvoices.length > 0} empty={t('noOverdue')}>
              <OverdueInvoices items={brief.overdueInvoices} />
            </BriefSection>

            <BriefSection title={t('risingCosts')} hasData={brief.risingCosts.length > 0} empty={t('noRising')}>
              <RisingCosts items={brief.risingCosts} />
            </BriefSection>

            <BriefSection title={t('approvals')} hasData={brief.approvalsNeeded.length > 0} empty={t('noApprovals')}>
              <ApprovalsNeeded items={brief.approvalsNeeded} />
            </BriefSection>

            <BriefSection title={t('missingDocs')} hasData={brief.missingDocs.length > 0} empty={t('noMissingDocs')}>
              <MissingDocs items={brief.missingDocs} />
            </BriefSection>

            <BriefSection title={t('cashRisk')} hasData>
              <CashRiskCard risk={brief.cashRisk} />
            </BriefSection>

            <BriefSection title={t('revenueTrend')} hasData>
              <RevenueTrendCard trend={brief.revenueTrend} />
            </BriefSection>
          </div>

          <p className="pt-2 text-xs text-muted-foreground">{t('footer')}</p>
        </>
      )}
    </div>
  );
}
