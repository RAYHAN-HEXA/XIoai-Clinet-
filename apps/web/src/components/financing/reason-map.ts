import type { Localized } from '@/lib/queries';

export const REASON_LABELS: Record<string, Localized> = {
  SHORT_GAP: {
    en: 'A short projected cash gap is driving this ranking.',
    zh: '较短的预计现金缺口驱动了本次排序。'
  },
  PAYOUT_DELAYED: {
    en: 'Delayed platform payouts are driving this ranking.',
    zh: '平台回款延迟驱动了本次排序。'
  },
  SEASONAL_STOCKUP: {
    en: 'Seasonal stock-up timing is driving this ranking.',
    zh: '季节性备货时点驱动了本次排序。'
  },
  PLANNED_EXPANSION: {
    en: 'A planned expansion is driving this ranking.',
    zh: '计划中的扩张支出驱动了本次排序。'
  }
};

export function reasonLabel(reason: string, locale: string): string {
  const label = REASON_LABELS[reason];
  if (!label) return reason;
  return locale === 'zh' ? label.zh : label.en;
}
