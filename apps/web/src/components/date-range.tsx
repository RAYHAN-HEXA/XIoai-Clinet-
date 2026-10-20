'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';

export interface DateRange {
  /** YYYY-MM-DD */
  from: string;
  /** YYYY-MM-DD */
  to: string;
}

function isoDay(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function defaultRange(preset: string = 'last30'): DateRange {
  const now = new Date();
  const to = isoDay(now);
  const from = new Date(now.getTime());
  if (preset === 'last7') from.setUTCDate(from.getUTCDate() - 6);
  else if (preset === 'last90') from.setUTCDate(from.getUTCDate() - 89);
  else from.setUTCDate(from.getUTCDate() - 29);
  return { from: isoDay(from), to };
}

/**
 * Date-range control shared by every financial screen.
 * Presets cover the common cases; "custom" reveals two date inputs.
 */
export function DateRangeFilter({ value, onChange }: { value: DateRange; onChange: (r: DateRange) => void }) {
  const t = useTranslations('common');
  const [preset, setPreset] = React.useState<string>('last30');

  function applyPreset(next: string): void {
    setPreset(next);
    if (next === 'custom') return;
    onChange(defaultRange(next));
  }

  return (
    <div className="flex flex-wrap items-end gap-3">
      <div className="min-w-[9rem]">
        <Label htmlFor="range-preset" className="mb-1 block text-xs text-muted-foreground">
          {t('dateRange')}
        </Label>
        <Select
          id="range-preset"
          value={preset}
          onChange={(e) => applyPreset(e.target.value)}
          options={[
            { value: 'last7', label: t('last7') },
            { value: 'last30', label: t('last30') },
            { value: 'last90', label: t('last90') },
            { value: 'custom', label: t('custom') }
          ]}
        />
      </div>
      {preset === 'custom' && (
        <div className="flex items-end gap-2">
          <div>
            <Label htmlFor="range-from" className="mb-1 block text-xs text-muted-foreground">
              {t('from')}
            </Label>
            <Input
              id="range-from"
              type="date"
              value={value.from}
              max={value.to}
              onChange={(e) => onChange({ ...value, from: e.target.value })}
              className="w-[9.5rem]"
            />
          </div>
          <div>
            <Label htmlFor="range-to" className="mb-1 block text-xs text-muted-foreground">
              {t('to')}
            </Label>
            <Input
              id="range-to"
              type="date"
              value={value.to}
              min={value.from}
              onChange={(e) => onChange({ ...value, to: e.target.value })}
              className="w-[9.5rem]"
            />
          </div>
        </div>
      )}
    </div>
  );
}
