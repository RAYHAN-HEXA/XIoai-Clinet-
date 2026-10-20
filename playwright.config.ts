import { defineConfig, devices } from '@playwright/test';

/**
 * Browser end-to-end tests (Workflows A and B).
 *
 * These run against a fully seeded stack. Start the databases and services the
 * same way you would for a local demo:
 *
 *   npx tsx apps/api/scripts/embedded-pg.ts      # local Postgres on :5433
 *   npm run db:deploy -w apps/api && npm run db:seed -w apps/api
 *   npm run dev -w apps/api                       # API on :4000
 *   npm run dev:web                               # web on :3000
 *
 * Then: npm run test:e2e
 *
 * Servers below are started automatically by Playwright when they are not
 * already running. The HTTP-layer equivalents of these workflows are covered by
 * `npm run test:integration` (supertest + embedded Postgres), which does not
 * need a browser.
 */

const E2E_BASE_URL = process.env.E2E_BASE_URL ?? 'http://localhost:3000';
const API_URL = process.env.API_URL ?? 'http://localhost:4000';
const DATABASE_URL =
  process.env.DATABASE_URL ??
  'postgresql://postgres:postgres@localhost:5433/xiaocai';

export default defineConfig({
  testDir: './e2e',
  timeout: 90_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: E2E_BASE_URL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    locale: 'en',
    timezoneId: 'UTC'
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: [
    {
      command: 'npm run dev -w apps/api',
      port: Number(new URL(API_URL).port) || 4000,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
      env: {
        NODE_ENV: 'development',
        DATABASE_URL,
        JWT_SECRET:
          process.env.JWT_SECRET ??
          'e2e-secret-e2e-secret-e2e-secret-32ch',
        WEB_ORIGIN: 'http://localhost:3000',
        RATE_LIMIT_ENABLED: '0'
      }
    },
    {
      command: 'npm run dev:web',
      port: Number(new URL(E2E_BASE_URL).port) || 3000,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
      env: { NEXT_PUBLIC_API_URL: API_URL }
    }
  ]
});
