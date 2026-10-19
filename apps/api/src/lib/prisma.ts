import { PrismaClient, Prisma } from '@prisma/client';
import { Pool } from '@neondatabase/serverless';
import { PrismaNeon } from '@prisma/adapter-neon';
import { env } from '../config/env';
import { logger } from './logger';

/**
 * Two transport paths, chosen automatically:
 *
 *  - DATABASE_URL host contains "neon.tech" → Neon WebSocket driver over
 *    HTTPS port 443. Some networks (ISPs, hotel/venue WiFi) silently drop
 *    Postgres traffic on port 5432; 443 is never blocked. Interactive
 *    transactions work because we back the adapter with a WebSocket Pool.
 *
 *  - anything else (localhost embedded pg, plain Postgres) → standard TCP.
 */
function createPrismaClient(): PrismaClient {
  const log: Prisma.LogLevel[] = env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'];
  const host = new URL(env.DATABASE_URL).hostname;

  if (host.endsWith('neon.tech')) {
    logger.info({ dbDriver: 'neon-websocket-443', host }, 'Connecting to Postgres');
    const pool = new Pool({ connectionString: env.DATABASE_URL });
    return new PrismaClient({ adapter: new PrismaNeon(pool), log });
  }

  logger.info({ dbDriver: 'tcp', host }, 'Connecting to Postgres');
  return new PrismaClient({ log });
}

export const prisma = createPrismaClient();
