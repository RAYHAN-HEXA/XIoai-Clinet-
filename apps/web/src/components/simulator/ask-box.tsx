'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ErrorBlock } from '@/components/page-state';
import { loc } from '@/lib/format';
import { useAsk, type AskResponse } from '@/lib/queries';
import type { ScenarioParams } from './types';

export function AskBox({ onApplyParams }: { onApplyParams: (p: ScenarioParams) => void }) {
  const t = useTranslations('simulator');
  const tn = useTranslations('nav');
  const tc = useTranslations('common');
  const locale = useLocale();
  const [question, setQuestion] = useState('');
  const ask = useAsk();

  function send(): void {
    const q = question.trim();
    if (!q || ask.isPending) return;
    ask.mutate(
      { question: q, lang: locale === 'zh' ? 'zh' : 'en' },
      {
        onSuccess: (res) => {
          if (res.params) onApplyParams(res.params);
        }
      }
    );
  }

  function submit(e: React.FormEvent): void {
    e.preventDefault();
    send();
  }

  const response: AskResponse | undefined = ask.data;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium text-muted-foreground">{t('askTitle')}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <form onSubmit={submit} className="space-y-2">
          <label htmlFor="ask-input" className="sr-only">
            {t('askTitle')}
          </label>
          <textarea
            id="ask-input"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder={t('askPlaceholder')}
            rows={3}
            maxLength={500}
            className="flex w-full rounded-md border border-input bg-card px-3 py-2 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          />
          <div className="flex flex-wrap items-center gap-3">
            <Button type="submit" size="sm" disabled={ask.isPending || question.trim().length === 0}>
              {ask.isPending ? t('askThinking') : t('askSend')}
            </Button>
          </div>
        </form>

        {ask.isError && (
          <div className="space-y-2">
            <ErrorBlock message={ask.error instanceof Error ? ask.error.message : tc('loadError')} />
            <Button type="button" variant="outline" size="sm" onClick={send}>
              {tc('retry')}
            </Button>
          </div>
        )}

        {response && (
          <div className="space-y-2 rounded-md border bg-muted/40 p-3 text-sm">
            {response.status === 'LLM_UNAVAILABLE' && <p>{t('askUnavailable')}</p>}
            {response.status === 'NEEDS_CLARIFICATION' && <p>{t('askClarify')}</p>}
            {response.status === 'OK' && response.answer && <p className="whitespace-pre-wrap">{response.answer}</p>}
            {response.options && response.options.length > 0 && (
              <div className="flex flex-wrap items-center gap-2">
                {response.options.slice(0, 3).map((o) => (
                  <span key={o.id} className="rounded-full border bg-card px-2.5 py-0.5 text-xs font-medium">
                    {loc(o.name, locale)}
                  </span>
                ))}
                <Link href="/financing" className="text-xs font-medium text-primary underline-offset-4 hover:underline">
                  {tn('financing')}
                </Link>
              </div>
            )}
            {response.disclaimer && <p className="text-xs text-muted-foreground">{loc(response.disclaimer, locale)}</p>}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
