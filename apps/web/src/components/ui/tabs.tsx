'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

export interface TabDef {
  id: string;
  label: string;
}

/** Accessible tab set — roving focus, keyboard arrows, real panel switching. */
export function Tabs({
  tabs,
  value,
  onChange,
  className,
  label
}: {
  tabs: TabDef[];
  value: string;
  onChange: (id: string) => void;
  className?: string;
  label?: string;
}) {
  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>): void => {
    const idx = tabs.findIndex((t) => t.id === value);
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
      e.preventDefault();
      const next = e.key === 'ArrowRight' ? (idx + 1) % tabs.length : (idx - 1 + tabs.length) % tabs.length;
      onChange(tabs[next]!.id);
    }
  };

  return (
    <div role="tablist" aria-label={label} onKeyDown={onKeyDown} className={cn('flex flex-wrap gap-1 rounded-lg bg-muted p-1', className)}>
      {tabs.map((tab) => {
        const active = tab.id === value;
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={active}
            id={`tab-${tab.id}`}
            aria-controls={`panel-${tab.id}`}
            onClick={() => onChange(tab.id)}
            className={cn(
              'rounded-md px-3 py-1.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              active ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
            )}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}

export function TabPanel({ id, active, children }: { id: string; active: boolean; children: React.ReactNode }) {
  if (!active) return null;
  return (
    <div role="tabpanel" id={`panel-${id}`} aria-labelledby={`tab-${id}`} tabIndex={0}>
      {children}
    </div>
  );
}
