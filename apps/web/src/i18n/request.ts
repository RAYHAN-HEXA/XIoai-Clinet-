import { cookies } from 'next/headers';
import { getRequestConfig } from 'next-intl/server';
import { DEFAULT_LOCALE, LOCALES, LOCALE_COOKIE, type Locale } from './config';

// next-intl without i18n routing: the active locale lives in a cookie,
// so routes stay clean (no /en or /zh prefix).

export default getRequestConfig(async () => {
  const store = cookies();
  const cookieValue: string | undefined = store.get(LOCALE_COOKIE)?.value;
  const locale: Locale = LOCALES.find((l) => l === cookieValue) ?? DEFAULT_LOCALE;

  const messages = (await import(`../messages/${locale}.json`)).default;
  return { locale, messages };
});
