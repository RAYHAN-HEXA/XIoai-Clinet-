import type { CookieOptions } from 'express-serve-static-core';
import { isProd } from '../config/env';
import { SESSION_TTL_SECONDS } from './jwt';

export const SESSION_COOKIE = 'xc_session';

export function sessionCookieOptions(): CookieOptions {
  return {
    httpOnly: true,
    sameSite: 'lax',
    secure: isProd,
    path: '/',
    maxAge: SESSION_TTL_SECONDS * 1000
  };
}
