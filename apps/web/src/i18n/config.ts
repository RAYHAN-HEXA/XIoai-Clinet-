// Locale constants — safe to import from client components
// (i18n/request.ts is server-only and imports these).

export const LOCALES = ['en', 'zh'] as const;
export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = 'en';
export const LOCALE_COOKIE = 'xc_locale';
