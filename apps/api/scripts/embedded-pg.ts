/**
 * Dev/test helper: runs a throwaway embedded PostgreSQL (no install, no docker).
 * Usage:  npx tsx scripts/embedded-pg.ts   →  postgres://postgres:postgres@localhost:5433/xiaocai
 * Stop with SIGINT/SIGTERM — it shuts the database down cleanly.
 * Data lives in .pgdata-test/ (gitignored) and is disposable.
 */
import EmbeddedPostgres from 'embedded-postgres';

const pg = new EmbeddedPostgres({
  databaseDir: '.pgdata-test',
  user: 'postgres',
  password: 'postgres',
  port: 5433,
  persistent: false
});

async function main(): Promise<void> {
  await pg.initialise();
  await pg.start();
  await pg.createDatabase('xiaocai').catch(() => {
    // already exists from a previous run — fine
  });
  console.log('PG_READY postgres://postgres:postgres@localhost:5433/xiaocai');
}

async function stop(): Promise<void> {
  try {
    await pg.stop();
  } finally {
    process.exit(0);
  }
}

process.on('SIGINT', () => void stop());
process.on('SIGTERM', () => void stop());

void main().catch((err: unknown) => {
  console.error('embedded postgres failed:', err);
  process.exit(1);
});

// keep the process alive while postgres runs
setInterval(() => undefined, 60_000);
