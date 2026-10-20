/** Money formatting — fen in, display string out. CNY only for now. */
export function formatFen(fen: number, locale = 'en', opts: { compact?: boolean } = {}): string {
  const yuan = fen / 100;
  const nf = new Intl.NumberFormat(locale === 'zh' ? 'zh-CN' : 'en-US', {
    style: 'currency',
    currency: 'CNY',
    notation: opts.compact && Math.abs(yuan) >= 100_000 ? 'compact' : 'standard',
    maximumFractionDigits: Math.abs(yuan) >= 10_000 || opts.compact ? 0 : 2
  });
  return nf.format(yuan);
}

export function formatPct(pct: number | null | undefined, locale = 'en'): string {
  if (pct === null || pct === undefined) return '—';
  return new Intl.NumberFormat(locale === 'zh' ? 'zh-CN' : 'en-US', {
    style: 'percent',
    maximumFractionDigits: 1
  }).format(pct / 100);
}

export function formatDate(iso: string | null | undefined, locale = 'en'): string {
  if (!iso) return '—';
  return new Intl.DateTimeFormat(locale === 'zh' ? 'zh-CN' : 'en-US', { dateStyle: 'medium' }).format(new Date(iso));
}

/** Pick the right locale variant of engine LocalizedText. */
export function loc<T extends { en: string; zh: string }>(text: T | undefined, locale: string): string {
  if (!text) return '—';
  return locale === 'zh' ? text.zh : text.en;
}
