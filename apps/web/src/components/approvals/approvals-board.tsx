'use client';

import * as React from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { AlertTriangle } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { ApiError } from '@/lib/api';
import { formatDate } from '@/lib/format';
import { useApprovals, useDecideApproval, useMe, type ApprovalDto } from '@/lib/queries';
import { useToast } from '@/components/toast';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { TabPanel, Tabs } from '@/components/ui/tabs';
import { EmptyBlock, ErrorBlock, LoadingBlock, PageHeader } from '@/components/page-state';
import { RecommendationBody } from './recommendation-detail';
import { ApproveConfirmDialog, NextStepsDialog, RejectNoteDialog } from './decision-dialogs';

function statusVariant(status: ApprovalDto['status']): 'muted' | 'positive' | 'critical' {
  switch (status) {
    case 'APPROVED':
      return 'positive';
    case 'REJECTED':
      return 'critical';
    default:
      return 'muted';
  }
}

export function ApprovalsBoard() {
  const t = useTranslations('approvals');
  const tc = useTranslations('common');
  const locale = useLocale();
  const { push } = useToast();
  const qc = useQueryClient();
  const { data, isPending, isError, refetch } = useApprovals();
  const me = useMe();
  const decide = useDecideApproval();

  const [tab, setTab] = React.useState('pending');
  const [approveTarget, setApproveTarget] = React.useState<ApprovalDto | null>(null);
  const [rejectTarget, setRejectTarget] = React.useState<ApprovalDto | null>(null);
  const [note, setNote] = React.useState('');
  const [noteError, setNoteError] = React.useState(false);
  const [nextSteps, setNextSteps] = React.useState<string[] | null>(null);

  const role = me.data?.user.role;
  // Role still loading → let the attempt through; the API 403 path reports it.
  const canDecide = role === undefined || role === 'OWNER';

  const approvals = data?.approvals ?? [];
  const pending = approvals.filter((a) => a.status === 'PENDING');
  const history = approvals
    .filter((a) => a.status !== 'PENDING')
    .sort((a, b) => (b.decidedAt ?? '').localeCompare(a.decidedAt ?? ''));

  const closeApprove = (): void => setApproveTarget(null);
  const closeReject = (): void => {
    setRejectTarget(null);
    setNote('');
    setNoteError(false);
  };

  const showError = (err: unknown): void => {
    if (err instanceof ApiError) {
      if (err.status === 403) {
        push(t('ownerOnly'), 'error');
        return;
      }
      if (err.status === 409) {
        const generic = `Request failed (${err.status})`;
        push(err.message && err.message !== generic ? err.message : t('alreadyDecided'), 'error');
        return;
      }
      push(err.message || tc('loadError'), 'error');
      return;
    }
    push(tc('loadError'), 'error');
  };

  const handleSuccess = (res: { nextStepsForOwner: string[] }): void => {
    push(t('saved'), 'success');
    setNextSteps(res.nextStepsForOwner ?? []);
  };

  const handleApprove = (): void => {
    if (!approveTarget) return;
    decide.mutate(
      { id: approveTarget.id, decision: 'APPROVED' },
      {
        onSuccess: (res) => {
          closeApprove();
          handleSuccess(res);
        },
        onError: (err) => {
          closeApprove();
          void qc.invalidateQueries({ queryKey: ['approvals'] });
          showError(err);
        }
      }
    );
  };

  const handleReject = (): void => {
    if (!rejectTarget) return;
    if (!note.trim()) {
      setNoteError(true);
      push(t('rejectInvalid'), 'error');
      return;
    }
    decide.mutate(
      { id: rejectTarget.id, decision: 'REJECTED', note: note.trim() },
      {
        onSuccess: (res) => {
          closeReject();
          handleSuccess(res);
        },
        onError: (err) => {
          closeReject();
          void qc.invalidateQueries({ queryKey: ['approvals'] });
          showError(err);
        }
      }
    );
  };

  const statusLabel = (status: ApprovalDto['status']): string =>
    status === 'APPROVED' ? t('statusApproved') : status === 'REJECTED' ? t('statusRejected') : t('statusPending');

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <PageHeader title={t('title')} subtitle={t('subtitle')} />

      <p className="flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
        {t('principle')}
      </p>

      <Tabs
        tabs={[
          { id: 'pending', label: t('tabPending') },
          { id: 'history', label: t('tabHistory') }
        ]}
        value={tab}
        onChange={setTab}
        label={t('title')}
      />

      {isPending && <LoadingBlock rows={4} />}

      {isError && (
        <div className="space-y-3">
          <ErrorBlock message={tc('loadError')} />
          <Button variant="outline" size="sm" onClick={() => void refetch()}>
            {tc('retry')}
          </Button>
        </div>
      )}

      {data && (
        <>
          <TabPanel id="pending" active={tab === 'pending'}>
            <div className="space-y-4">
              {role !== undefined && !canDecide && (
                <p role="note" className="flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                  {t('ownerOnly')}
                </p>
              )}

              {pending.length === 0 ? (
                <EmptyBlock message={t('pendingEmpty')} />
              ) : (
                pending.map((a) => (
                  <Card key={a.id}>
                    <CardHeader className="flex-row items-center justify-between gap-3 space-y-0 pb-3">
                      <CardTitle className="text-base leading-snug">{a.recommendation.title}</CardTitle>
                      <Badge variant="muted">{t('statusPending')}</Badge>
                    </CardHeader>
                    <CardContent>
                      <RecommendationBody recommendation={a.recommendation} locale={locale} />
                    </CardContent>
                    <CardFooter className="flex flex-wrap justify-end gap-2 pt-4">
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={decide.isPending || !canDecide}
                        onClick={() => {
                          setRejectTarget(a);
                          setNote('');
                          setNoteError(false);
                        }}
                      >
                        {t('reject')}
                      </Button>
                      <Button size="sm" disabled={decide.isPending || !canDecide} onClick={() => setApproveTarget(a)}>
                        {t('approve')}
                      </Button>
                    </CardFooter>
                  </Card>
                ))
              )}
            </div>
          </TabPanel>

          <TabPanel id="history" active={tab === 'history'}>
            <div className="space-y-3">
              {history.length === 0 ? (
                <EmptyBlock message={t('historyEmpty')} />
              ) : (
                history.map((a) => (
                  <Card key={a.id}>
                    <CardHeader className="flex-row items-center justify-between gap-3 space-y-0 pb-2">
                      <CardTitle className="text-sm leading-snug">{a.recommendation.title}</CardTitle>
                      <Badge variant={statusVariant(a.status)}>{statusLabel(a.status)}</Badge>
                    </CardHeader>
                    <CardContent className="space-y-1">
                      <p className="text-xs text-muted-foreground">
                        {t('decidedBy')}: {formatDate(a.decidedAt, locale)}
                      </p>
                      {a.note && <p className="text-sm">{a.note}</p>}
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </TabPanel>
        </>
      )}

      <ApproveConfirmDialog
        open={approveTarget !== null}
        busy={decide.isPending}
        onConfirm={handleApprove}
        onCancel={closeApprove}
      />
      <RejectNoteDialog
        open={rejectTarget !== null}
        busy={decide.isPending}
        note={note}
        noteError={noteError}
        onNoteChange={(value) => {
          setNote(value);
          if (value.trim()) setNoteError(false);
        }}
        onConfirm={handleReject}
        onCancel={closeReject}
      />
      {nextSteps !== null && <NextStepsDialog steps={nextSteps} onClose={() => setNextSteps(null)} />}
    </div>
  );
}
