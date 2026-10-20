import * as React from 'react';
import { cn } from '@/lib/utils';

type BadgeVariant = 'default' | 'positive' | 'warning' | 'critical' | 'muted';

const styles: Record<BadgeVariant, string> = {
  default: 'bg-primary/15 text-primary',
  positive: 'bg-emerald-100 text-emerald-800',
  warning: 'bg-amber-100 text-amber-800',
  critical: 'bg-red-100 text-red-700',
  muted: 'bg-muted text-muted-foreground'
};

export function Badge({
  variant = 'default',
  className,
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & { variant?: BadgeVariant }) {
  return (
    <span
      className={cn('inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium', styles[variant], className)}
      {...props}
    />
  );
}

export function alertBadgeVariant(level: string | null | undefined): BadgeVariant {
  switch (level) {
    case 'CRITICAL':
      return 'critical';
    case 'WARNING':
      return 'critical';
    case 'WATCH':
      return 'warning';
    case 'NONE':
      return 'positive';
    default:
      return 'muted';
  }
}
