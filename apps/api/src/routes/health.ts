import { Router } from 'express';
import { prisma } from '../lib/prisma';

export const healthRouter = Router();

healthRouter.get('/health', async (_req, res) => {
  const time = new Date().toISOString();
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.status(200).json({ status: 'ok', db: true, service: 'xiaocai-api', time });
  } catch {
    // API is up but the DB is not reachable (e.g. DATABASE_URL still a placeholder).
    res.status(503).json({ status: 'degraded', db: false, service: 'xiaocai-api', time });
  }
});
