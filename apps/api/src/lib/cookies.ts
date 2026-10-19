import type { CookieOptions } from 'express-serve-static-core';
import { SESSION_TTL_SECONDS } from './jwt';
import { COOKIE_OPTIONS } from '../middleware/csrf-options';

export const SESSION_COOKIE = 'xc_session';

export function sessionCookieOptions(): CookieOptions {
  return {
    ...COOKIE_OPTIONS,
    maxAge: SESSION_TTL_SECONDS * 1000
  };
}
