import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { signSession, verifySession } from '../lib/jwt';
import { SESSION_COOKIE, sessionCookieOptions } from '../lib/cookies';
import { hashPassword, verifyPassword } from '../lib/password';
import { requireAuth } from '../middleware/auth';
import { loginLimiter } from '../middleware/rate-limit';
import { writeAudit } from '../audit/audit';
import { asyncHandler } from '../lib/async';

export const authRouter = Router();

const registerSchema = z.object({
  email: z.string().email().max(254).toLowerCase(),
  password: z.string().min(8, 'Password must be at least 8 characters').max(128),
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

    res.cookie(
      SESSION_COOKIE,
      signSession({ userId: user.id, businessId: business.id, role: user.role }),
      sessionCookieOptions()
    );

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

authRouter.post(
  '/login',
  loginLimiter,
  asyncHandler(async (req, res) => {
    const body = loginSchema.parse(req.body);

    const user = await prisma.user.findUnique({
      where: { email: body.email },
      include: { business: true }
    });
    const passwordOk = user ? await verifyPassword(body.password, user.passwordHash) : false;

    if (!user || !passwordOk) {
      // Audit only when the account exists (no businessId for unknown emails);
      // never log the attempted email — PII.
      if (user) {
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

    res.cookie(
      SESSION_COOKIE,
      signSession({ userId: user.id, businessId: user.businessId, role: user.role }),
      sessionCookieOptions()
    );

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

authRouter.post('/logout', (req, res) => {
  const token = req.cookies?.[SESSION_COOKIE];
  const session = token ? verifySession(token) : null;

  res.clearCookie(SESSION_COOKIE, sessionCookieOptions());

  if (session) {
    writeAudit({
      businessId: session.businessId,
      userId: session.userId,
      action: 'LOGOUT',
      entityType: 'USER',
      entityId: session.userId,
      ip: req.ip
    });
  }

  res.status(204).send();
});

authRouter.get('/me', requireAuth, (req, res) => {
  const user = req.user;
  if (!user) {
    res.status(401).json({ error: 'UNAUTHENTICATED' });
    return;
  }
  const { business, ...userOnly } = user;
  res.json({ user: toSafeUser(userOnly), business });
});
