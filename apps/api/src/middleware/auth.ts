import type { NextFunction, Request, Response } from 'express';
import type { Role } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { verifySession } from '../lib/jwt';
import { SESSION_COOKIE } from '../lib/cookies';

/**
 * Session auth: JWT (userId, businessId, role) in an httpOnly cookie.
 * The user is re-fetched from the DB so role/permission changes take effect
 * immediately instead of living in a stale token.
 */
export async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  const token = req.cookies?.[SESSION_COOKIE];
  const session = token ? verifySession(token) : null;
  if (!session) {
    res.status(401).json({ error: 'UNAUTHENTICATED' });
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
