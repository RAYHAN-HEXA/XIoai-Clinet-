'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { PageHeader, LoadingBlock, ErrorBlock, EmptyBlock } from '@/components/page-state';
import { useToast } from '@/components/toast';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TableScroll, Table, THead, TBody, TR, TH, TD } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Dialog, ConfirmDialog } from '@/components/ui/dialog';
import { formatDate } from '@/lib/format';
import { API_URL } from '@/lib/api';
import {
  useSources,
  useMe,
  useToggleSource,
  useSetSourcePermission,
  useImports,
  useImportPreview,
  useImportConfirm,
  type SourceDto,
  type ImportJobDto
} from '@/lib/queries';

const IMPORT_KINDS = [
  { value: 'orders', labelKey: 'kindOrders' },
  { value: 'settlements', labelKey: 'kindSettlements' },
  { value: 'ads', labelKey: 'kindAds' },
  { value: 'invoices', labelKey: 'kindInvoices' }
] as const;

const PERMISSION_OPTIONS = [
  { value: 'READ_ONLY', label: 'READ_ONLY' },
  { value: 'READ_WRITE', label: 'READ_WRITE' }
];

export default function SourcesPage() {
  const t = useTranslations('sources');
  const tCommon = useTranslations('common');
  const { push } = useToast();

  const { data: meData, isLoading: meLoading } = useMe();
  const isOwner = meData?.user.role === 'OWNER';
  const role = meData?.user.role;

  const {
    data: sourcesData,
    isLoading: sourcesLoading,
    error: sourcesError,
    refetch: refetchSources
  } = useSources();

  const {
    data: importsData,
    isLoading: importsLoading,
    error: importsError
  } = useImports();

  // Toggle status state
  const [toggleTarget, setToggleTarget] = useState<SourceDto | null>(null);
  const [toggleToStatus, setToggleToStatus] = useState<'GRANTED' | 'REVOKED' | null>(null);
  const toggleMutation = useToggleSource();

  // Permission change state
  const [permTarget, setPermTarget] = useState<SourceDto | null>(null);
  const [permValue, setPermValue] = useState<'READ_ONLY' | 'READ_WRITE'>('READ_ONLY');
  const permMutation = useSetSourcePermission();

  // Import state
  const [importKind, setImportKind] = useState<'orders' | 'settlements' | 'ads' | 'invoices'>('orders');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const previewMutation = useImportPreview();
  const confirmMutation = useImportConfirm();

  const handleToggle = (source: SourceDto, toStatus: 'GRANTED' | 'REVOKED') => {
    setToggleTarget(source);
    setToggleToStatus(toStatus);
  };

  const confirmToggle = async () => {
    if (!toggleTarget || !toggleToStatus) return;
    try {
      await toggleMutation.mutateAsync({ id: toggleTarget.id, status: toggleToStatus });
      push(toggleToStatus === 'GRANTED' ? t('granted') : t('revoked'), 'success');
    } catch (e) {
      push(t('importFailed'), 'error');
    }
    setToggleTarget(null);
    setToggleToStatus(null);
  };

  const cancelToggle = () => {
    setToggleTarget(null);
    setToggleToStatus(null);
  };

  const handlePermChange = (source: SourceDto) => {
    setPermTarget(source);
    setPermValue(source.permission);
  };

  const confirmPerm = async () => {
    if (!permTarget) return;
    try {
      await permMutation.mutateAsync({ id: permTarget.id, permission: permValue });
    } catch (e) {
      push(t('importFailed'), 'error');
    }
    setPermTarget(null);
  };

  const cancelPerm = () => {
    setPermTarget(null);
  };

  const validateAndPreview = async () => {
    if (!selectedFile) return;
    // Client-side validation
    if (selectedFile.type !== 'text/csv' && !selectedFile.name.endsWith('.csv')) {
      push('CSV file required', 'error');
      return;
    }
    if (selectedFile.size > 5 * 1024 * 1024) {
      push('File too large (max 5MB)', 'error');
      return;
    }
    try {
      await previewMutation.mutateAsync({ kind: importKind, file: selectedFile });
      setPreviewOpen(true);
    } catch (e: any) {
      push(e?.message || t('importFailed'), 'error');
    }
  };

  const handleConfirmImport = async () => {
    if (!selectedFile) return;
    try {
      const res = await confirmMutation.mutateAsync({
        kind: importKind,
        file: selectedFile,
        mapping: previewMutation.data?.suggestedMapping
      });
      push(
        t('imported', {
          ok: res.inserted,
          dup: res.duplicates,
          fail: res.failedRows
        }),
        'success'
      );
      setPreviewOpen(false);
      setSelectedFile(null);
      // refresh sources/imports via invalidation - but also refetch explicitly
    } catch (e: any) {
      push(e?.message || t('importFailed'), 'error');
    }
  };

  const preview = previewMutation.data;

  return (
    <div className="space-y-6">
      <PageHeader title={t('title')} subtitle={t('subtitle')} />

      <Card>
        <CardHeader>
          <CardTitle as="h2">{t('connectedTitle')}</CardTitle>
        </CardHeader>
        <CardContent>
          {sourcesLoading || meLoading && <LoadingBlock />}
          {sourcesError && <ErrorBlock message={tCommon('loadError')} />}
          {!sourcesLoading && !sourcesError && sourcesData?.sources.length === 0 && (
            <EmptyBlock message={t('empty')} />
          )}
          {!sourcesLoading && !sourcesError && sourcesData && sourcesData.sources.length > 0 && (
            <>
              <TableScroll>
                <Table>
                  <THead>
                    <TH>{t('colName')}</TH>
                    <TH>{t('colType')}</TH>
                    <TH>{t('colPermission')}</TH>
                    <TH>{tCommon('status')}</TH>
                    <TH>{t('colFreshness')}</TH>
                    <TH>{t('orders')}</TH>
                    <TH>{t('ads')}</TH>
                    <TH>{tCommon('actions')}</TH>
                  </THead>
                  <TBody>
                    {sourcesData.sources.map((s) => (
                      <TR key={s.id}>
                        <TD className="font-medium">{s.name}</TD>
                        <TD>{s.type}</TD>
                        <TD>{s.permission === 'READ_ONLY' ? t('readOnly') : t('readWrite')}</TD>
                        <TD>
                          <Badge variant={s.status === 'GRANTED' ? 'positive' : 'muted'}>
                            {s.status === 'GRANTED' ? t('granted') : t('revoked')}
                          </Badge>
                        </TD>
                        <TD>{formatDate(s.grantedAt)}</TD>
                        <TD>{s.linkedOrders}</TD>
                        <TD>{s.linkedAds}</TD>
                        <TD>
                          <div className="flex flex-wrap gap-2">
                            <Button
                              size="sm"
                              variant={s.status === 'GRANTED' ? 'outline' : 'default'}
                              disabled={!isOwner}
                              onClick={() => handleToggle(s, s.status === 'GRANTED' ? 'REVOKED' : 'GRANTED')}
                            >
                              {s.status === 'GRANTED' ? t('revoke') : t('grant')}
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={!isOwner}
                              onClick={() => handlePermChange(s)}
                            >
                              {t('permissionChange')}
                            </Button>
                          </div>
                        </TD>
                      </TR>
                    ))}
                  </TBody>
                </Table>
              </TableScroll>
              <p className="mt-3 text-xs text-muted-foreground">{t('notOperationalNote')}</p>
            </>
          )}
          {role && role !== 'OWNER' && (
            <p className="mt-3 text-xs text-muted-foreground">{t('ownerOnly')}</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle as="h2">{t('importTitle')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="import-kind" className="mb-1 block text-xs">
                {t('importKind')}
              </Label>
              <Select
                id="import-kind"
                value={importKind}
                onChange={(e) =>
                  setImportKind(e.target.value as 'orders' | 'settlements' | 'ads' | 'invoices')
                }
                options={IMPORT_KINDS.map((k) => ({ value: k.value, label: t(k.labelKey) }))}
              />
            </div>
            <div>
              <Label htmlFor="import-file" className="mb-1 block text-xs">
                {t('chooseFile')}
              </Label>
              <Input
                id="import-file"
                type="file"
                accept=".csv"
                onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
              />
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button onClick={validateAndPreview} disabled={!selectedFile || previewMutation.isPending}>
              {t('preview')}
            </Button>
            <a
              href={`${API_URL}/api/imports/templates/${importKind}`}
              download
              className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium border border-input bg-card hover:bg-muted/60 h-9 px-4 py-2"
            >
              {t('downloadTemplate')}
            </a>
          </div>

          <div>
            <h2 className="mb-2 text-sm font-medium">{t('importHistory')}</h2>
            {importsLoading && <LoadingBlock rows={2} />}
            {importsError && <ErrorBlock message={tCommon('loadError')} />}
            {!importsLoading && !importsError && importsData?.jobs.length === 0 && (
              <EmptyBlock message={t('noHistory')} />
            )}
            {!importsLoading && !importsError && importsData && importsData.jobs.length > 0 && (
              <TableScroll>
                <Table>
                  <THead>
                    <TH>{t('filename')}</TH>
                    <TH>{t('importKind')}</TH>
                    <TH>{t('rows')}</TH>
                    <TH>{t('ok')}</TH>
                    <TH>{t('failed')}</TH>
                    <TH>{tCommon('status')}</TH>
                    <TH>{tCommon('date')}</TH>
                  </THead>
                  <TBody>
                    {importsData.jobs.map((job: ImportJobDto) => (
                      <TR key={job.id}>
                        <TD className="font-medium">{job.filename}</TD>
                        <TD>{job.kind}</TD>
                        <TD>{job.rowsTotal}</TD>
                        <TD>{job.rowsOk}</TD>
                        <TD>{job.rowsFailed}</TD>
                        <TD>
                          <Badge>{job.status}</Badge>
                        </TD>
                        <TD>{formatDate(job.createdAt)}</TD>
                      </TR>
                    ))}
                  </TBody>
                </Table>
              </TableScroll>
            )}
          </div>
        </CardContent>
      </Card>

      <Dialog
        open={previewOpen}
        onClose={() => setPreviewOpen(false)}
        title={t('previewTitle')}
        wide
        footer={
          <>
            <Button variant="outline" onClick={() => setPreviewOpen(false)}>
              {tCommon('cancel')}
            </Button>
            <Button
              onClick={handleConfirmImport}
              disabled={confirmMutation.isPending || !preview}
            >
              {t('confirmImport')}
            </Button>
          </>
        }
      >
        {preview && (
          <div className="space-y-4">
            <div>
              <p className="mb-1 text-xs font-medium">{t('detectedHeaders')}</p>
              <div className="flex flex-wrap gap-1">
                {preview.detectedHeaders.map((h) => (
                  <Badge key={h} variant="muted">
                    {h}
                  </Badge>
                ))}
              </div>
            </div>
            <div>
              <p className="mb-1 text-xs font-medium">{t('mapping')}</p>
              <div className="max-h-40 overflow-auto rounded border p-2 text-xs">
                {Object.entries(preview.suggestedMapping).map(([k, v]) => (
                  <div key={k} className="flex justify-between gap-2">
                    <span>{k}</span>
                    <span className="text-muted-foreground">{v}</span>
                  </div>
                ))}
              </div>
            </div>
            {preview.missingRequiredColumns.length > 0 && (
              <div className="rounded border border-amber-200 bg-amber-50 p-2 text-xs text-amber-900">
                Missing required columns: {preview.missingRequiredColumns.join(', ')}
              </div>
            )}
            <div className="grid grid-cols-3 gap-2 text-xs">
              <div>
                {t('validRows')}: {preview.validRows}
              </div>
              <div>
                {t('errorRows')}: {preview.errorRows}
              </div>
              <div>
                {t('sampleRows')}: {preview.sample.length}
              </div>
            </div>
            {preview.errors.length > 0 && (
              <div>
                <p className="mb-1 text-xs font-medium">{t('rowErrors')}</p>
                <TableScroll>
                  <Table>
                    <THead>
                      <TH>Row</TH>
                      <TH>Errors</TH>
                    </THead>
                    <TBody>
                      {preview.errors.map((e, i) => (
                        <TR key={i}>
                          <TD>{e.rowNumber}</TD>
                          <TD>{e.errors.join('; ')}</TD>
                        </TR>
                      ))}
                    </TBody>
                  </Table>
                </TableScroll>
              </div>
            )}
            {preview.sample.length > 0 && (
              <div>
                <p className="mb-1 text-xs font-medium">{t('sampleRows')}</p>
                <TableScroll>
                  <Table>
                    <THead>
                      {Object.keys(preview.sample[0] || {}).map((k) => (
                        <TH key={k}>{k}</TH>
                      ))}
                    </THead>
                    <TBody>
                      {preview.sample.map((row, i) => (
                        <TR key={i}>
                          {Object.values(row).map((v, j) => (
                            <TD key={j}>{String(v)}</TD>
                          ))}
                        </TR>
                      ))}
                    </TBody>
                  </Table>
                </TableScroll>
              </div>
            )}
          </div>
        )}
      </Dialog>

      <ConfirmDialog
        open={!!toggleTarget && !!toggleToStatus}
        title={toggleToStatus === 'REVOKED' ? t('revoke') : t('grant')}
        description={
          toggleToStatus === 'REVOKED'
            ? t('revokeConfirm')
            : t('grantConfirm')
        }
        confirmLabel={tCommon('confirm')}
        cancelLabel={tCommon('cancel')}
        danger={toggleToStatus === 'REVOKED'}
        busy={toggleMutation.isPending}
        onConfirm={confirmToggle}
        onCancel={cancelToggle}
      />

      {permTarget && (
        <Dialog open={!!permTarget} onClose={cancelPerm} title={t('permissionChange')} footer={
          <>
            <Button variant="outline" onClick={cancelPerm} disabled={permMutation.isPending}>{tCommon('cancel')}</Button>
            <Button onClick={confirmPerm} disabled={permMutation.isPending}>{tCommon('confirm')}</Button>
          </>
        }>
          <Select
            value={permValue}
            onChange={(e) => setPermValue(e.target.value as 'READ_ONLY' | 'READ_WRITE')}
            options={PERMISSION_OPTIONS}
          />
        </Dialog>
      )}
    </div>
  );
}
