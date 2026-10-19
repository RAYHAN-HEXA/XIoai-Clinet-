/**
 * Migration runner for networks where port 5432 is blocked.
 *
 * The `prisma migrate` CLI always connects over raw TCP, so it cannot reach
 * Neon from such networks. This script applies the same SQL files through the
 * Neon WebSocket driver (HTTPS 443) and records them in _prisma_migrations
 * with proper checksums, so `prisma migrate deploy` later (e.g. on a network
 * that allows 5432) stays consistent.
 *
 * Usage: npx tsx scripts/db-migrate-443.ts
 */
import 'dotenv/config';
import { createHash, randomUUID } from 'node:crypto';
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { Pool } from '@neondatabase/serverless';

const MIGRATIONS_DIR = path.join(__dirname, '..', 'prisma', 'migrations');
const LOCK_TABLE_SQL = `
CREATE TABLE IF NOT EXISTS "_prisma_migrations" (
  "id" VARCHAR(36) NOT NULL,
  "checksum" VARCHAR(64) NOT NULL,
  "finished_at" TIMESTAMPTZ(3),
  "migration_name" VARCHAR(255) NOT NULL,
  "logs" TEXT,
  "rolled_back_at" TIMESTAMPTZ(3),
  "started_at" TIMESTAMPTZ(3) NOT NULL DEFAULT now(),
  "applied_steps_count" INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT "_prisma_migrations_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "_prisma_migrations_migration_name_key"
  ON "_prisma_migrations"("migration_name");
`;

async function main(): Promise<void> {
  const url = process.env.DATABASE_URL;
  if (!url || !new URL(url).hostname.endsWith('neon.tech')) {
    console.log('DATABASE_URL is not a neon.tech host — use `npm run db:migrate` instead.');
    process.exit(1);
  }

  const pool = new Pool({ connectionString: url });

  try {
    await pool.query(LOCK_TABLE_SQL);
    console.log('migration lock table ready');

    const dirs = readdirSync(MIGRATIONS_DIR)
      .filter((d) => /^\d+_/.test(d) && existsSync(path.join(MIGRATIONS_DIR, d, 'migration.sql')))
      .sort();

    for (const dir of dirs) {
      const applied = await pool.query(
        'SELECT 1 FROM "_prisma_migrations" WHERE migration_name = $1 LIMIT 1',
        [dir]
      );
      if (applied.rowCount && applied.rowCount > 0) {
        console.log(`= ${dir} (already applied)`);
        continue;
      }

      const sql = readFileSync(path.join(MIGRATIONS_DIR, dir, 'migration.sql'), 'utf8');
      const checksum = createHash('sha256').update(sql).digest('hex');
      console.log(`→ applying ${dir} …`);
      await pool.query(sql); // simple query protocol: multi-statement OK
      await pool.query(
        `INSERT INTO "_prisma_migrations"
           (id, checksum, finished_at, migration_name, applied_steps_count)
         VALUES ($1, $2, now(), $3, 1)`,
        [randomUUID(), checksum, dir]
      );
      console.log(`✓ ${dir} applied`);
    }

    console.log('all migrations consistent with prisma migrate');
  } finally {
    await pool.end();
  }
}

void main().catch((err: unknown) => {
  console.error('migration failed:', err instanceof Error ? err.message : err);
  process.exit(1);
});
