import type { CookieOptions } from 'express-serve-static-core';
import { isProd } from '../config/env';

/** Base cookie attributes shared by session + CSRF cookies. */
export const COOKIE_OPTIONS: CookieOptions = {
  httpOnly: true,
  sameSite: 'lax',
  secure: isProd,
  path: '/'
};
