'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { API_URL } from '@/lib/api';
import { cn } from '@/lib/utils';

type ApiState = 'checking' | 'online' | 'offline';

export function ApiStatus() {
  const t = useTranslations('dashboard');
  const [state, setState] = useState<ApiState>('checking');

  useEffect(() => {
    let active = true;
    fetch(`${API_URL}/health`)
      .then((res) => {
        if (active) setState(res.ok ? 'online' : 'offline');
      })
      .catch(() => {
        if (active) setState('offline');
      });
    return () => {
      active = false;
    };
  }, []);

  const label =
    state === 'online' ? t('apiOnline') : state === 'offline' ? t('apiOffline') : t('apiChecking');

  return (
    <span
      className={cn(
        'inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium',
        state === 'online' && 'bg-emerald-100 text-emerald-800',
        state === 'offline' && 'bg-red-100 text-red-700',
        state === 'checking' && 'bg-muted text-muted-foreground'
      )}
    >
      <span
        className={cn(
          'h-2 w-2 rounded-full',
          state === 'online' && 'bg-emerald-500',
          state === 'offline' && 'bg-red-500',
          state === 'checking' && 'bg-muted-foreground/50'
        )}
      />
      {label}
    </span>
  );
}
