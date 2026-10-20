'use client';

import { useTranslations } from 'next-intl';
import { PageHeader, LoadingBlock, ErrorBlock, EmptyBlock } from '@/components/page-state';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TableScroll, Table, THead, TBody, TR, TH, TD } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { formatDate } from '@/lib/format';
import { api } from '@/lib/api';
import { useMe, useSources, useSecurityEvents } from '@/lib/queries';

const SECURITY_ACTION_LABELS: Record<string, string> = {
  LOGIN: 'LOGIN',
  LOGIN_FAILED: 'LOGIN_FAILED',
  LOGOUT: 'LOGOUT',
  REGISTER: 'REGISTER',
  DEMO_SESSION: 'DEMO_SESSION',
  SESSION_REVOKE: 'SESSION_REVOKE'
};

export default function SecurityPage() {
  const t = useTranslations('security');
  const tCommon = useTranslations('common');
  const tNav = useTranslations('nav');

  const { data: meData, isLoading: meLoading, error: meError } = useMe();
  const { data: sourcesData, isLoading: sourcesLoading, error: sourcesError } = useSources();
  const { data: eventsData, isLoading: eventsLoading, error: eventsError } = useSecurityEvents();

  const handleLogout = async () => {
    try {
      await api('/api/auth/logout', { method: 'POST' });
    } catch (e) {
      // ignore
    }
    // Hard navigation so the middleware re-evaluates with the cleared cookie.
    window.location.assign('/');
  };

  const user = meData?.user;
  const business = meData?.business;

  return (
    <div className="space-y-6">
      <PageHeader title={t('title')} subtitle={t('subtitle')} />

      <Card>
        <CardHeader>
          <CardTitle>{t('sessionTitle')}</CardTitle>
        </CardHeader>
        <CardContent>
          {meLoading && <LoadingBlock rows={2} />}
          {meError && <ErrorBlock message={tCommon('loadError')} />}
          {meData && (
            <div className="space-y-2 text-sm">
              <div>
                <Badge variant="positive">{t('sessionActive')}</Badge>
              </div>
              <div>
                {t('sessionRole')}: {user?.role}
              </div>
              <div>
                {t('sessionBusiness')}: {business?.name}
              </div>
              <div>{t('sessionSince')}</div>
              <div>{t('yourRole', { role: user?.role ?? '' })}</div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('roleTitle')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div className={user?.role === 'OWNER' ? 'font-medium' : ''}>
            {t('roleOwner')}
          </div>
          <div className={user?.role === 'ACCOUNTANT' ? 'font-medium' : ''}>
            {t('roleAccountant')}
          </div>
          <div className={user?.role === 'VIEWER' ? 'font-medium' : ''}>
            {t('roleViewer')}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('sourcesTitle')}</CardTitle>
        </CardHeader>
        <CardContent>
          {sourcesLoading && <LoadingBlock rows={2} />}
          {sourcesError && <ErrorBlock message={tCommon('loadError')} />}
          {sourcesData && (
            <div className="space-y-2 text-sm">
              <div>
                Granted: {sourcesData.sources.filter((s) => s.status === 'GRANTED').length} | Revoked:{' '}
                {sourcesData.sources.filter((s) => s.status === 'REVOKED').length}
              </div>
              {sourcesData.sources.slice(0, 3).map((s) => (
                <div key={s.id} className="flex items-center gap-2">
                  <span>{s.name}</span>
                  <Badge variant={s.status === 'GRANTED' ? 'positive' : 'muted'}>
                    {s.status}
                  </Badge>
                </div>
              ))}
              <a href="/sources" className="text-xs text-primary underline">
                View all
              </a>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('eventsTitle')}</CardTitle>
        </CardHeader>
        <CardContent>
          {eventsLoading && <LoadingBlock />}
          {eventsError && <ErrorBlock message={tCommon('loadError')} />}
          {!eventsLoading && !eventsError && eventsData?.events.length === 0 && (
            <EmptyBlock message={t('eventsEmpty')} />
          )}
          {!eventsLoading && !eventsError && eventsData && eventsData.events.length > 0 && (
            <TableScroll>
              <Table>
                <THead>
                  <TH>Action</TH>
                  <TH>Date</TH>
                  <TH>IP</TH>
                </THead>
                <TBody>
                  {eventsData.events.map((ev) => (
                    <TR key={ev.id}>
                      <TD>{SECURITY_ACTION_LABELS[ev.action] || ev.action}</TD>
                      <TD>{formatDate(ev.createdAt)}</TD>
                      <TD>{ev.ip || '—'}</TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
            </TableScroll>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('controlsTitle')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="text-sm">{t('controlLogout')}</div>
          <Button onClick={handleLogout}>{tNav('logout')}</Button>
          <div className="text-sm text-muted-foreground">{t('controlPassword')}</div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('limitationsTitle')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div>{t('limitCsrf')}</div>
          <div>{t('limitEmail')}</div>
          <div>{t('limitRateLimit')}</div>
          <div>{t('limitAudit')}</div>
          <div>{t('neverClaim')}</div>
        </CardContent>
      </Card>
    </div>
  );
}
