import type { NextFunction, Request, Response } from 'express';
import { randomUUID } from 'node:crypto';
import { COOKIE_OPTIONS } from './csrf-options';

/**
 * CSRF defense: double-submit token.
 *  - GET /api/auth/csrf issues a random token in a JS-readable cookie (xc_csrf).
 *  - Every state-changing authenticated request must echo it in the
 *    X-CSRF-Token header; mismatch ⇒ 403. Login/register are exempt: they are
 *    pre-auth, and requiring a token there would need a bootstrap fetch for no
 *    meaningful gain (documented in SECURITY_SELF_ASSESSMENT).
 * SameSite=Lax cookies are the first line; this header check is the second.
 */
export const CSRF_COOKIE = 'xc_csrf';

export function issueCsrfToken(_req: Request, res: Response): string {
  const token = randomUUID();
  res.cookie(CSRF_COOKIE, token, { ...COOKIE_OPTIONS, httpOnly: false, maxAge: 7 * 24 * 60 * 60 * 1000 });
  return token;
}

const MUTATING = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
const EXEMPT_PATHS = new Set(['/api/auth/login', '/api/auth/register']);

export function csrfProtection(req: Request, res: Response, next: NextFunction): void {
  if (!MUTATING.has(req.method) || EXEMPT_PATHS.has(req.path)) {
    next();
    return;
  }
  const cookieToken = req.cookies?.[CSRF_COOKIE];
  const headerToken = req.header('x-csrf-token');
  if (!cookieToken || !headerToken || cookieToken !== headerToken) {
    res.status(403).json({ error: 'CSRF', message: 'Missing or invalid CSRF token' });
    return;
  }
  next();
}
