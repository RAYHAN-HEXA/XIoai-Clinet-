// Test environment — set BEFORE any module imports (vitest setupFiles guarantee).
// dotenv never overrides already-set variables, so these win over apps/api/.env.
process.env.NODE_ENV = process.env.NODE_ENV ?? 'test';
process.env.JWT_SECRET = process.env.JWT_SECRET ?? 'test-secret-test-secret-test-secret-32ch';
process.env.DATABASE_URL = process.env.DATABASE_URL ?? 'postgresql://test:test@localhost:5432/test';
process.env.WEB_ORIGIN = process.env.WEB_ORIGIN ?? 'http://localhost:3000';
