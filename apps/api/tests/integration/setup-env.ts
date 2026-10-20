/**
 * Per-worker environment for integration tests. Runs (setupFiles) BEFORE the
 * test files import any app module, so env.ts / prisma.ts see the test DB.
 */
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

const urlFile = path.join(__dirname, '.db-url');
const dbUrl = existsSync(urlFile)
  ? readFileSync(urlFile, 'utf8').trim()
  : 'postgres://postgres:postgres@localhost:5455/xiaocai_int';

process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = dbUrl;
process.env.JWT_SECRET = 'integration-test-secret-integration-test-32ch';
process.env.WEB_ORIGIN = 'http://localhost:3000';
// Disabled by default so non-rate-limit tests are never throttled; the
// rate-limit test flips this back on for its own requests.
process.env.RATE_LIMIT_ENABLED = '0';
