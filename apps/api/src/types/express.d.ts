import type { Business, User } from '@prisma/client';

declare global {
  namespace Express {
    interface Request {
      /** Set by requireAuth after a valid session + DB lookup. */
      user?: User & { business: Business };
    }
  }
}

export {};
