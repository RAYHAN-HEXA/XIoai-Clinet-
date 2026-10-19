import { Router } from 'express';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { SESSION_TTL_SECONDS, signSession, verifySession } from '../lib/jwt';
import { SESSION_COOKIE, sessionCookieOptions } from '../lib/cookies';
import { hashPassword, verifyPassword } from '../lib/password';
import { requireAuth } from '../middleware/auth';
import { loginLimiter } from '../middleware/rate-limit';
import { issueCsrfToken } from '../middleware/csrf';
import { writeAudit } from '../audit/audit';
import { asyncHandler } from '../lib/async';

export const authRouter = Router();

const registerSchema = z.object({
  email: z.string().email().max(254).toLowerCase(),
  // policy: ≥8 chars, at least one letter and one digit (Phase-7 hardening)
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .max(128)
    .regex(/^(?=.*[A-Za-z])(?=.*\d).+$/, 'Password must contain at least one letter and one number'),
  name: z.string().trim().min(1).max(80),
  businessName: z.string().trim().min(1).max(120),
  businessNameZh: z.string().trim().max(120).optional()
});

const loginSchema = z.object({
  email: z.string().email().toLowerCase(),
  password: z.string().min(1)
});

function toSafeUser<T extends { passwordHash: string }>(user: T): Omit<T, 'passwordHash'> {
  const { passwordHash: _passwordHash, ...safe } = user;
  return safe;
}

/** Create a Session row and sign a JWT bound to it (jti = Session.id). */
async function signSessionWithNewJti(
  userId: string,
  businessId: string,
  role: 'OWNER' | 'ACCOUNTANT' | 'VIEWER'
): Promise<string> {
  const jti = randomUUID();
  await prisma.session.create({
    data: { id: jti, userId, expiresAt: new Date(Date.now() + SESSION_TTL_SECONDS * 1000) }
  });
  return signSession({ userId, businessId, role, jti });
}

/** In-memory per-account lockout (5 fails → 15 min). Instance-local; Redis store
 *  needed for multi-instance deployments (residual risk R5). */
const FAILS_TO_LOCK = 5;
const LOCK_MS = 15 * 60 * 1000;
const failCounts = new Map<string, { count: number; lockedUntil: number }>();

function isLocked(email: string): boolean {
  const rec = failCounts.get(email);
  return !!rec && rec.lockedUntil > Date.now();
}
function recordFail(email: string): void {
  const rec = failCounts.get(email) ?? { count: 0, lockedUntil: 0 };
  rec.count += 1;
  if (rec.count >= FAILS_TO_LOCK) {
    rec.lockedUntil = Date.now() + LOCK_MS;
    rec.count = 0;
  }
  failCounts.set(email, rec);
}
function clearFails(email: string): void {
  failCounts.delete(email);
}

authRouter.get(
  '/csrf',
  asyncHandler(async (req, res) => {
    const token = issueCsrfToken(req, res);
    res.json({ token });
  })
);

authRouter.post(
  '/register',
  asyncHandler(async (req, res) => {
    const body = registerSchema.parse(req.body);

    const existing = await prisma.user.findUnique({ where: { email: body.email } });
    if (existing) {
      res.status(409).json({ error: 'CONFLICT', message: 'Email already registered' });
      return;
    }

    const passwordHash = await hashPassword(body.password);
    const { user, business } = await prisma.$transaction(async (tx) => {
      const business = await tx.business.create({
        data: { name: body.businessName, nameZh: body.businessNameZh || null }
      });
      const user = await tx.user.create({
        data: {
          email: body.email,
          passwordHash,
          name: body.name,
          role: 'OWNER',
          businessId: business.id
        }
      });
      return { user, business };
    });

    const token = await signSessionWithNewJti(user.id, business.id, user.role);
    res.cookie(SESSION_COOKIE, token, sessionCookieOptions());
    issueCsrfToken(req, res);

    writeAudit({
      businessId: business.id,
      userId: user.id,
      action: 'REGISTER',
      entityType: 'USER',
      entityId: user.id,
      ip: req.ip
    });

    res.status(201).json({ user: toSafeUser(user), business });
  })
);

/** Sign a session token bound to a freshly created Session row. */
authRouter.post(
  '/login',
  loginLimiter,
  asyncHandler(async (req, res) => {
    const body = loginSchema.parse(req.body);

    if (isLocked(body.email)) {
      res.status(429).json({ error: 'RATE_LIMITED', message: 'Account temporarily locked. Try again later.' });
      return;
    }

    const user = await prisma.user.findUnique({
      where: { email: body.email },
      include: { business: true }
    });
    const passwordOk = user ? await verifyPassword(body.password, user.passwordHash) : false;

    if (!user || !passwordOk) {
      if (user) {
        recordFail(body.email);
        writeAudit({
          businessId: user.businessId,
          userId: user.id,
          action: 'LOGIN_FAILED',
          entityType: 'USER',
          entityId: user.id,
          ip: req.ip
        });
      }
      res.status(401).json({ error: 'UNAUTHENTICATED', message: 'Invalid email or password' });
      return;
    }

    clearFails(body.email);
    const token = await signSessionWithNewJti(user.id, user.businessId, user.role);
    res.cookie(SESSION_COOKIE, token, sessionCookieOptions());
    issueCsrfToken(req, res);

    writeAudit({
      businessId: user.businessId,
      userId: user.id,
      action: 'LOGIN',
      entityType: 'USER',
      entityId: user.id,
      ip: req.ip
    });

    const { business, ...userOnly } = user;
    res.json({ user: toSafeUser(userOnly), business });
  })
);

authRouter.post(
  '/logout',
  requireAuth,
  asyncHandler(async (req, res) => {
    const token = req.cookies?.[SESSION_COOKIE];
    const session = token ? verifySession(token) : null;

    // server-side revocation — the JWT alone would still verify until expiry
    if (session) {
      await prisma.session.updateMany({
        where: { id: session.jti, userId: session.userId, revokedAt: null },
        data: { revokedAt: new Date() }
      });
      writeAudit({
        businessId: session.businessId,
        userId: session.userId,
        action: 'LOGOUT',
        entityType: 'USER',
        entityId: session.userId,
        ip: req.ip
      });
    }

    const { maxAge: _maxAge, ...clearOptions } = sessionCookieOptions();
    res.clearCookie(SESSION_COOKIE, clearOptions);
    res.status(204).send();
  })
);

authRouter.get('/me', requireAuth, (req, res) => {
  const user = req.user;
  if (!user) {
    res.status(401).json({ error: 'UNAUTHENTICATED' });
    return;
  }
  const { business, ...userOnly } = user;
  res.json({ user: toSafeUser(userOnly), business });
});
