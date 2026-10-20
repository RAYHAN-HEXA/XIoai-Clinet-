import { rateLimit } from 'express-rate-limit';

/**
 * Limiter store is in-process memory: fine for a single API instance, but a
 * shared Redis-backed store is required once the API runs on multiple instances
 * (documented residual risk R5 in docs/SECURITY_SELF_ASSESSMENT.md).
 *
 * `RATE_LIMIT_ENABLED=0` disables limiting — used ONLY by the integration test
 * suite so it can exercise other behaviour without tripping the login limiter;
 * the rate-limit integration test sets it back to '1' for its own case.
 */
const rateLimitsDisabled = (): boolean => process.env['RATE_LIMIT_ENABLED'] === '0';

export const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 300,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  skip: rateLimitsDisabled,
  message: { error: 'RATE_LIMITED', message: 'Too many requests, slow down.' }
});

// Stricter limiter for login — only failed attempts count against it.
export const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  skipSuccessfulRequests: true,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  skip: rateLimitsDisabled,
  message: { error: 'RATE_LIMITED', message: 'Too many login attempts. Try again later.' }
});
