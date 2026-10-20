'use client';

import { useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';

export interface PasswordScore {
  score: 0 | 1 | 2 | 3 | 4;
  label: string;
  checks: { id: string; met: boolean; label: string }[];
}

/** Client-side strength meter. The server is the authority; this is guidance. */
export function scorePassword(pw: string): { score: PasswordScore['score']; checks: PasswordScore['checks'] } {
  const checks = [
    { id: 'len', met: pw.length >= 8, label: 'At least 8 characters' },
    { id: 'upper', met: /[A-Z]/.test(pw), label: 'An uppercase letter' },
    { id: 'lower', met: /[a-z]/.test(pw), label: 'A lowercase letter' },
    { id: 'digit', met: /\d/.test(pw), label: 'A number' }
  ];
  const met = checks.filter((c) => c.met).length;
  const score = (pw.length === 0 ? 0 : Math.max(1, met)) as PasswordScore['score'];
  return { score, checks };
}

export function PasswordStrength({ value }: { value: string }) {
  const t = useTranslations('auth');
  const { score, checks } = useMemo(() => scorePassword(value), [value]);

  const bar = ['bg-muted', 'bg-red-500', 'bg-amber-500', 'bg-lime-500', 'bg-emerald-500'][score];
  const label = [t('strengthEmpty'), t('strengthWeak'), t('strengthFair'), t('strengthGood'), t('strengthStrong')][score];

  return (
    <div className="space-y-1.5" aria-live="polite">
      <div className="flex items-center gap-2">
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
          <div className={cn('h-full transition-all', bar)} style={{ width: `${score * 25}%` }} />
        </div>
        <span className="text-xs text-muted-foreground">{label}</span>
      </div>
      {value.length > 0 && (
        <ul className="flex flex-wrap gap-x-3 gap-y-1 text-xs">
          {checks.map((c) => (
            <li key={c.id} className={cn('flex items-center gap-1', c.met ? 'text-emerald-600' : 'text-muted-foreground')}>
              <span aria-hidden>{c.met ? '✓' : '○'}</span>
              {c.label}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
