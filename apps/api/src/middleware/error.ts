import type { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';
import { logger } from '../lib/logger';

export function notFoundHandler(req: Request, res: Response): void {
  res.status(404).json({ error: 'NOT_FOUND', path: req.path });
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction): void {
  if (err instanceof ZodError) {
    res.status(400).json({ error: 'VALIDATION', issues: err.flatten().fieldErrors });
    return;
  }

  // Prisma unique-constraint violation → treat as conflict (e.g. duplicate email).
  if (
    typeof err === 'object' &&
    err !== null &&
    'code' in err &&
    (err as { code?: string }).code === 'P2002'
  ) {
    res.status(409).json({ error: 'CONFLICT', message: 'Resource already exists' });
    return;
  }

  logger.error({ err, path: req.path }, 'Unhandled error');
  res.status(500).json({ error: 'INTERNAL' });
}
