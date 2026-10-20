export type UrgencyKey = 'urgencyOverdue' | 'urgencyDueSoon' | 'urgencyMissingDoc';

export interface UrgencyMeta {
  key: UrgencyKey;
  variant: 'critical' | 'warning' | 'muted';
}

/** Map engine urgency enum → translation key + badge tone. Unknown values → null. */
export function urgencyMeta(urgency: string): UrgencyMeta | null {
  switch (urgency) {
    case 'OVERDUE':
      return { key: 'urgencyOverdue', variant: 'critical' };
    case 'DUE_SOON':
      return { key: 'urgencyDueSoon', variant: 'warning' };
    case 'MISSING_DOC':
      return { key: 'urgencyMissingDoc', variant: 'warning' };
    default:
      return null;
  }
}
