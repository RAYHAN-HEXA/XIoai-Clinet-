import jwt from 'jsonwebtoken';
import type { Role } from '@prisma/client';
import { env } from '../config/env';

export const SESSION_TTL_SECONDS = 7 * 24 * 60 * 60; // 7 days

export interface SessionPayload {
  userId: string;
  businessId: string;
  role: Role;
  /** Session row id — enables server-side revocation */
  jti: string;
}

export function signSession(payload: SessionPayload): string {
  return jwt.sign(payload, env.JWT_SECRET, { expiresIn: SESSION_TTL_SECONDS });
}

/** Returns null for any invalid/expired/tampered token — never throws. */
export function verifySession(token: string): SessionPayload | null {
  try {
    const decoded = jwt.verify(token, env.JWT_SECRET);
    if (typeof decoded === 'string') return null;
    const { userId, businessId, role, jti } = decoded as Partial<SessionPayload>;
    if (!userId || !businessId || !role || !jti) return null;
    return { userId, businessId, role, jti };
  } catch {
    return null;
  }
}
