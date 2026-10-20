import * as React from 'react';
import { cn } from '@/lib/utils';

/** Responsive table wrapper — horizontal scroll below the natural width. */
export function TableScroll({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn('w-full overflow-x-auto rounded-md border bg-card', className)}>{children}</div>;
}

export function Table({ children, className }: { children: React.ReactNode; className?: string }) {
  return <table className={cn('w-full caption-bottom text-sm', className)}>{children}</table>;
}

export function THead({ children }: { children: React.ReactNode }) {
  return (
    <thead className="border-b bg-muted/50">
      <tr>{children}</tr>
    </thead>
  );
}

export function TBody({ children }: { children: React.ReactNode }) {
  return <tbody className="divide-y">{children}</tbody>;
}

export function TR({ children, className, ...props }: React.HTMLAttributes<HTMLTableRowElement>) {
  return (
    <tr className={cn('transition-colors hover:bg-muted/40', className)} {...props}>
      {children}
    </tr>
  );
}

interface THProps extends React.ThHTMLAttributes<HTMLTableCellElement> {
  sortable?: boolean;
  active?: boolean;
  direction?: 'asc' | 'desc';
  onSort?: () => void;
}

export function TH({ children, sortable, active, direction, onSort, className, ...props }: THProps) {
  const content = sortable ? (
    <button
      type="button"
      onClick={onSort}
      className={cn(
        'inline-flex items-center gap-1 rounded-sm text-left text-xs font-semibold uppercase tracking-wide hover:text-foreground',
        active ? 'text-foreground' : 'text-muted-foreground'
      )}
    >
      {children}
      <span aria-hidden className={cn('text-[10px]', active ? 'opacity-100' : 'opacity-40')}>
        {active && direction === 'asc' ? '▲' : '▼'}
      </span>
    </button>
  ) : (
    children
  );
  return (
    <th scope="col" className={cn('px-3 py-2.5 text-left align-bottom text-xs font-semibold text-muted-foreground', className)} {...props}>
      {content}
    </th>
  );
}

export function TD({ children, className, ...props }: React.TdHTMLAttributes<HTMLTableCellElement>) {
  return (
    <td className={cn('px-3 py-2.5 align-middle', className)} {...props}>
      {children}
    </td>
  );
}
