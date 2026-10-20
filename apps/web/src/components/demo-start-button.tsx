'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { BriefcaseBusiness, Calculator, Eye, type LucideIcon } from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { Button } from '@/components/ui/button';

type DemoRole = 'OWNER' | 'ACCOUNTANT' | 'VIEWER';

const ROLES: Array<{
  role: DemoRole;
  icon: LucideIcon;
  labelKey: 'demoAsOwner' | 'demoAsAccountant' | 'demoAsViewer';
  descKey: 'demoAsOwnerDesc' | 'demoAsAccountantDesc' | 'demoAsViewerDesc';
}> = [
  { role: 'OWNER', icon: BriefcaseBusiness, labelKey: 'demoAsOwner', descKey: 'demoAsOwnerDesc' },
  { role: 'ACCOUNTANT', icon: Calculator, labelKey: 'demoAsAccountant', descKey: 'demoAsAccountantDesc' },
  { role: 'VIEWER', icon: Eye, labelKey: 'demoAsViewer', descKey: 'demoAsViewerDesc' }
];

/**
 * "Try the Ms. Li demo" — creates an isolated clone of the seeded demo
 * business and signs the visitor into it as the chosen role. No credentials are
 * stored in the client: the API issues the session cookie directly, and the
 * clone's user carries the selected role so server-side `requireRole` behaves
 * exactly as in production.
 */
export function DemoStartButton() {
  const t = useTranslations('landing');
  const router = useRouter();
  const [pending, setPending] = useState<DemoRole | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function start(role: DemoRole) {
    setPending(role);
    setError(null);
    try {
      await api('/api/auth/demo', { method: 'POST', body: JSON.stringify({ role }) });
      router.push('/dashboard');
      router.refresh();
    } catch (err) {
      setError(
        err instanceof ApiError && err.status === 503
          ? t('demoUnavailable')
          : t('demoError')
      );
      setPending(null);
    }
  }

  return (
    <div className="flex w-full flex-col items-center gap-3">
      <span className="text-xs font-medium uppercase tracking-wide text-white/50">
        {t('demoPickRole')}
      </span>
      <div className="grid w-full max-w-3xl gap-3 sm:grid-cols-3">
        {ROLES.map(({ role, icon: Icon, labelKey, descKey }) => {
          const label = t(labelKey);
          return (
            <div
              key={role}
              className="flex flex-col items-start gap-2 rounded-xl border border-white/15 bg-white/5 p-4 text-left"
            >
              <div className="flex items-center gap-2 text-white">
                <Icon className="h-4 w-4" aria-hidden />
                <span className="text-sm font-semibold">{label}</span>
              </div>
              <p className="min-h-10 text-xs text-white/60">{t(descKey)}</p>
              <Button
                size="sm"
                onClick={() => start(role)}
                disabled={pending !== null}
                className="mt-1 w-full"
                data-testid={`demo-${role.toLowerCase()}`}
              >
                {pending === role ? t('demoStarting') : t('demoEnter', { role: label })}
              </Button>
            </div>
          );
        })}
      </div>
      <span className="text-xs text-white/40">{t('demoNote')}</span>
      {error && (
        <span role="alert" className="text-xs text-amber-300">
          {error}
        </span>
      )}
    </div>
  );
}
