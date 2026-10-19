'use client';

import { useLocale } from 'next-intl';
import { useRouter } from 'next/navigation';
import { LOCALES, LOCALE_COOKIE, type Locale } from '@/i18n/config';

const LABELS: Record<Locale, string> = { en: 'EN', zh: '中文' };

export function LanguageSwitcher() {
  const locale = useLocale();
  const router = useRouter();

  function switchTo(next: Locale) {
    if (next === locale) return;
    document.cookie = `${LOCALE_COOKIE}=${next}; path=/; max-age=31536000; samesite=lax`;
    router.refresh(); // re-renders server components with the new locale
  }

  return (
    <div
      className="flex items-center rounded-md border border-input bg-card p-0.5"
      role="group"
      aria-label="Language / 语言"
    >
      {LOCALES.map((l) => (
        <button
          key={l}
          type="button"
          onClick={() => switchTo(l)}
          aria-pressed={l === locale}
          className={`rounded px-2 py-0.5 text-xs font-medium transition-colors ${
            l === locale ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          {LABELS[l]}
        </button>
      ))}
    </div>
  );
}
