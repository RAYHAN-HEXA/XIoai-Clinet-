'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { PageHeader, LoadingBlock, ErrorBlock, EmptyBlock } from '@/components/page-state';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TableScroll, Table, THead, TBody, TR, TH, TD } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Dialog } from '@/components/ui/dialog';
import { formatDate } from '@/lib/format';
import { API_URL } from '@/lib/api';
import { useAudit, useAuditIntegrity, useMe } from '@/lib/queries';

const ACTION_OPTIONS = [
  { value: '', labelKey: 'common.all' },
  { value: 'LOGIN', label: 'LOGIN' },
  { value: 'LOGIN_FAILED', label: 'LOGIN_FAILED' },
  { value: 'LOGOUT', label: 'LOGOUT' },
  { value: 'REGISTER', label: 'REGISTER' },
  { value: 'DATA_ACCESS', label: 'DATA_ACCESS' },
  { value: 'IMPORT', label: 'IMPORT' },
  { value: 'SOURCE_REVOKE', label: 'SOURCE_REVOKE' },
  { value: 'SOURCE_GRANT', label: 'SOURCE_GRANT' },
  { value: 'SOURCE_PERMISSION', label: 'SOURCE_PERMISSION' },
  { value: 'APPROVAL_DECISION', label: 'APPROVAL_DECISION' },
  { value: 'RECOMMENDATION_CREATED', label: 'RECOMMENDATION_CREATED' },
  { value: 'SCENARIO_SAVED', label: 'SCENARIO_SAVED' },
  { value: 'AUDIT_EXPORT', label: 'AUDIT_EXPORT' },
  { value: 'DEMO_SESSION', label: 'DEMO_SESSION' },
  { value: 'ASSISTANT_ASK', label: 'ASSISTANT_ASK' }
];

export default function AuditPage() {
  const t = useTranslations('audit');
  const tCommon = useTranslations('common');
  const [page, setPage] = useState(1);
  const [action, setAction] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [selected, setSelected] = useState<any>(null);

  const { data: meData } = useMe();
  const role = meData?.user.role;
  const isViewer = role === 'VIEWER';

  const {
    data: auditData,
    isLoading: auditLoading,
    error: auditError
  } = useAudit({ page, action: action || undefined, from: from || undefined, to: to || undefined });

  const {
    data: integrityData,
    isLoading: integrityLoading,
    error: integrityError
  } = useAuditIntegrity();

  if (isViewer) {
    return (
      <div className="space-y-6">
        <PageHeader title={t('title')} subtitle={t('subtitle')} />
        <EmptyBlock message={t('ownerAccountantOnly')} />
      </div>
    );
  }

  const total = auditData?.total ?? 0;
  const pageSize = 20;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="space-y-6">
      <PageHeader title={t('title')} subtitle={t('subtitle')} />

      <Card>
        <CardHeader>
          <CardTitle>Integrity</CardTitle>
        </CardHeader>
        <CardContent>
          {integrityLoading && <LoadingBlock rows={1} />}
          {integrityError && <ErrorBlock message={tCommon('loadError')} />}
          {!integrityLoading && !integrityError && integrityData && (
            <Badge variant={integrityData.valid ? 'positive' : 'critical'}>
              {integrityData.valid
                ? t('integrityOk', { count: integrityData.rows })
                : t('integrityBroken')}
            </Badge>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-end gap-3">
            <div className="min-w-[10rem]">
              <Label htmlFor="audit-action" className="mb-1 block text-xs">
                {t('filterAction')}
              </Label>
              <Select
                id="audit-action"
                value={action}
                onChange={(e) => {
                  setAction(e.target.value);
                  setPage(1);
                }}
                options={ACTION_OPTIONS.map((o) => ({
                  value: o.value,
                  label: 'labelKey' in o ? tCommon('all') : (o.label || o.value)
                }))}
              />
            </div>
            <div>
              <Label htmlFor="audit-from" className="mb-1 block text-xs">
                {t('filterFrom')}
              </Label>
              <Input
                id="audit-from"
                type="date"
                value={from}
                onChange={(e) => {
                  setFrom(e.target.value);
                  setPage(1);
                }}
                className="w-[9.5rem]"
              />
            </div>
            <div>
              <Label htmlFor="audit-to" className="mb-1 block text-xs">
                {t('filterTo')}
              </Label>
              <Input
                id="audit-to"
                type="date"
                value={to}
                onChange={(e) => {
                  setTo(e.target.value);
                  setPage(1);
                }}
                className="w-[9.5rem]"
              />
            </div>
            <div className="ml-auto">
              <a
                href={`${API_URL}/api/audit/export.csv`}
                className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium border border-input bg-card hover:bg-muted/60 h-9 px-4 py-2"
              >
                {t('exportCsv')}
              </a>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6">
          {auditLoading && <LoadingBlock />}
          {auditError && <ErrorBlock message={tCommon('loadError')} />}
          {!auditLoading && !auditError && auditData?.rows.length === 0 && (
            <EmptyBlock message={t('empty')} />
          )}
          {!auditLoading && !auditError && auditData && auditData.rows.length > 0 && (
            <>
              <TableScroll>
                <Table>
                  <THead>
                    <TH>{t('colTime')}</TH>
                    <TH>{t('colAction')}</TH>
                    <TH>{t('colEntity')}</TH>
                    <TH>{t('colIp')}</TH>
                    <TH>{t('colHash')}</TH>
                  </THead>
                  <TBody>
                    {auditData.rows.map((row) => (
                      <TR
                        key={row.id}
                        onClick={() => setSelected(row)}
                        className="cursor-pointer"
                      >
                        <TD>{formatDate(row.createdAt)}</TD>
                        <TD>{row.action}</TD>
                        <TD>
                          {row.entityType}
                          {row.entityId ? `:${row.entityId.substring(0, 8)}` : ''}
                        </TD>
                        <TD>{row.ip || '—'}</TD>
                        <TD title={row.hash || ''}>
                          {row.hash ? row.hash.substring(0, 12) : '—'}
                        </TD>
                      </TR>
                    ))}
                  </TBody>
                </Table>
              </TableScroll>
              <div className="mt-3 flex items-center justify-between">
                <div className="text-xs text-muted-foreground">
                  {t('total', { count: total })}
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page <= 1}
                  >
                    {tCommon('prev')}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setPage((p) => p + 1)}
                    disabled={page >= totalPages}
                  >
                    {tCommon('next')}
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Dialog
        open={!!selected}
        onClose={() => setSelected(null)}
        title={t('details')}
        wide
      >
        {selected && (
          <div className="space-y-3 text-xs">
            <div>ID: {selected.id}</div>
            <div>Action: {selected.action}</div>
            <div>Entity: {selected.entityType} {selected.entityId || ''}</div>
            <div>IP: {selected.ip || '—'}</div>
            <div>Created: {selected.createdAt}</div>
            <div>Hash: {selected.hash || '—'}</div>
            <div>
              <p className="mb-1 font-medium">{t('metadata')}</p>
              <pre className="max-h-60 overflow-auto rounded border bg-muted/30 p-2">
                {JSON.stringify((selected as any).metadata || {}, null, 2)}
              </pre>
            </div>
          </div>
        )}
      </Dialog>
    </div>
  );
}
