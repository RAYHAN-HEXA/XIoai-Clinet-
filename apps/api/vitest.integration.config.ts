import { defineConfig } from 'vitest/config';

/**
 * API integration suite: boots an embedded Postgres, applies real migrations,
 * and drives the full Express app through supertest. Run with `npm run
 * test:integration`. Unit tests run separately (vitest.config.ts) so they stay
 * fast and dependency-free.
 */
export default defineConfig({
  test: {
    environment: 'node',
    globalSetup: ['./tests/integration/global-setup.ts'],
    setupFiles: ['./tests/integration/setup-env.ts'],
    include: ['tests/integration/**/*.test.ts'],
    // Serial: the suite shares one database and one rate-limit store.
    fileParallelism: false,
    poolOptions: { forks: { singleFork: true } },
    testTimeout: 30_000,
    hookTimeout: 60_000
  }
});
