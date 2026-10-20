'use client';

import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { ConfirmDialog, Dialog } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';

export function ApproveConfirmDialog({
  open,
  busy,
  onConfirm,
  onCancel
}: {
  open: boolean;
  busy: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const t = useTranslations('approvals');
  const tc = useTranslations('common');
  return (
    <ConfirmDialog
      open={open}
      title={t('approve')}
      description={t('confirmApprove')}
      confirmLabel={t('approve')}
      cancelLabel={tc('cancel')}
      busy={busy}
      onConfirm={onConfirm}
      onCancel={onCancel}
    />
  );
}

export function RejectNoteDialog({
  open,
  busy,
  note,
  noteError,
  onNoteChange,
  onConfirm,
  onCancel
}: {
  open: boolean;
  busy: boolean;
  note: string;
  noteError: boolean;
  onNoteChange: (value: string) => void;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const t = useTranslations('approvals');
  const tc = useTranslations('common');
  return (
    <Dialog
      open={open}
      onClose={onCancel}
      title={t('reject')}
      description={t('confirmReject')}
      footer={
        <>
          <Button variant="outline" onClick={onCancel} disabled={busy}>
            {tc('cancel')}
          </Button>
          <Button variant="destructive" onClick={onConfirm} disabled={busy}>
            {t('reject')}
          </Button>
        </>
      }
    >
      <div className="space-y-2">
        <Label htmlFor="decision-note">{t('decisionNote')}</Label>
        <textarea
          id="decision-note"
          rows={4}
          value={note}
          onChange={(e) => onNoteChange(e.target.value)}
          placeholder={t('notePlaceholder')}
          aria-invalid={noteError || undefined}
          aria-describedby={noteError ? 'decision-note-error' : undefined}
          className="flex w-full rounded-md border border-input bg-card px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        />
        {noteError && (
          <p id="decision-note-error" role="alert" className="text-xs text-red-600">
            {t('noteRequired')}
          </p>
        )}
      </div>
    </Dialog>
  );
}

export function NextStepsDialog({ steps, onClose }: { steps: string[]; onClose: () => void }) {
  const t = useTranslations('approvals');
  const tc = useTranslations('common');
  return (
    <Dialog open onClose={onClose} title={t('nextSteps')} footer={<Button onClick={onClose}>{tc('close')}</Button>}>
      {steps.length === 0 ? (
        <p className="text-muted-foreground">—</p>
      ) : (
        <ol className="list-decimal space-y-2 pl-5">
          {steps.map((s, i) => (
            <li key={i} className="text-sm">
              {s}
            </li>
          ))}
        </ol>
      )}
    </Dialog>
  );
}
