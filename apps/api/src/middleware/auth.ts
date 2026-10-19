import type { NextFunction, Request, Response } from 'express';
import type { Role } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { verifySession } from '../lib/jwt';
import { SESSION_COOKIE } from '../lib/cookies';

/**
 * Session auth: JWT (userId, businessId, role, jti) in an httpOnly cookie.
 * The token is checked against the Session table — revoked or expired sessions
 * are rejected even if the JWT itself is still cryptographically valid.
 * The user is re-fetched so role changes take effect immediately.
 */
export async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  const token = req.cookies?.[SESSION_COOKIE];
  const session = token ? verifySession(token) : null;
  if (!session) {
    res.status(401).json({ error: 'UNAUTHENTICATED' });
    return;
  }

  const row = await prisma.session.findUnique({ where: { id: session.jti } });
  if (!row || row.revokedAt !== null || row.expiresAt < new Date()) {
    res.status(401).json({ error: 'UNAUTHENTICATED', reason: 'SESSION_REVOKED_OR_EXPIRED' });
    return;
  }

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    include: { business: true }
  });
  if (!user) {
    res.status(401).json({ error: 'UNAUTHENTICATED' });
    return;
  }

  req.user = user;
  next();
}

export function requireRole(...roles: Role[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: 'UNAUTHENTICATED' });
      return;
    }
    if (!roles.includes(req.user.role)) {
      res.status(403).json({ error: 'FORBIDDEN', required: roles });
      return;
    }
    next();
  };
}
