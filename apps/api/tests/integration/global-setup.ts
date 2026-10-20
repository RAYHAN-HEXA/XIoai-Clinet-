/**
 * Integration-test global setup.
 *
 * Starts a throwaway embedded PostgreSQL on port 5455, applies the real Prisma
 * migrations to it, and publishes the connection string to a temp file that the
 * per-worker setup file (tests/integration/setup-env.ts) reads before any app
 * module is imported. Never touches a developer/production database.
 *
 * Teardown stops and removes the cluster. Uses apps/api/.pgdata-test-int/.
 */
import EmbeddedPostgres from 'embedded-postgres';
import { execFileSync } from 'node:child_process';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const API_DIR = path.join(__dirname, '..', '..');
const DATA_DIR = path.join(API_DIR, '.pgdata-test-int');
const URL_FILE = path.join(__dirname, '.db-url');
const PORT = 5455;
const DATABASE_URL = `postgres://postgres:postgres@localhost:${PORT}/xiaocai_int`;

let pg: EmbeddedPostgres | undefined;

export async function setup(): Promise<void> {
  rmSync(DATA_DIR, { recursive: true, force: true });
  pg = new EmbeddedPostgres({
    databaseDir: DATA_DIR,
    user: 'postgres',
    password: 'postgres',
    port: PORT,
    persistent: false
  });
  await pg.initialise();
  await pg.start();
  await pg.createDatabase('xiaocai_int').catch(() => undefined);

  execFileSync('npx', ['prisma', 'migrate', 'deploy'], {
    cwd: API_DIR,
    env: { ...process.env, DATABASE_URL },
    stdio: 'inherit'
  });

  mkdirSync(path.dirname(URL_FILE), { recursive: true });
  writeFileSync(URL_FILE, DATABASE_URL, 'utf8');
}

export async function teardown(): Promise<void> {
  rmSync(URL_FILE, { force: true });
  if (pg) await pg.stop().catch(() => undefined);
  rmSync(DATA_DIR, { recursive: true, force: true });
}
