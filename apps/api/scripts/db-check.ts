/**
 * Database connection check. Never prints DATABASE_URL or any secret.
 * Usage: npx tsx scripts/db-check.ts
 */
import 'dotenv/config';
import { prisma } from '../src/lib/prisma';

async function main(): Promise<void> {
  const started = Date.now();
  await prisma.$queryRaw`SELECT 1`;
  const ms = Date.now() - started;

  const info = await prisma.$queryRaw<{ db: string; version: string }[]>`
    SELECT current_database()::text AS db, version()::text AS version`;
  const row = info[0];

  const migrations = await prisma.$queryRaw<{ n: bigint }[]>`
    SELECT count(*) AS n FROM "_prisma_migrations"`;
  const applied = Number(migrations[0]?.n ?? 0);

  const [businesses, users, auditLogs] = await Promise.all([
    prisma.business.count(),
    prisma.user.count(),
    prisma.auditLog.count()
  ]);

  console.log('CONNECTED ✓');
  console.log(`  latency      : ${ms}ms`);
  console.log(`  database     : ${row?.db ?? '?'}`);
  console.log(`  server       : ${(row?.version ?? '?').split(',').slice(0, 2).join(',')}`);
  console.log(`  migrations   : ${applied} applied`);
  console.log(`  rows         : businesses=${businesses} users=${users} auditLogs=${auditLogs}`);
}

void main()
  .catch((err: unknown) => {
    console.log('NOT CONNECTED ✗');
    const e = err as { code?: string; message?: string };
    console.log(`  error ${e.code ?? ''}: ${(e.message ?? String(err)).slice(0, 600)}`);

    // Structural look at the URL — reveals config mistakes, never the password.
    try {
      const u = new URL(process.env.DATABASE_URL ?? '');
      const params: Record<string, string> = {};
      u.searchParams.forEach((v, k) => {
        params[k] = k.toLowerCase() === 'password' ? '<hidden>' : v;
      });
      console.log('  url diagnosis (password redacted):');
      console.log(`    scheme    : ${u.protocol}`);
      console.log(`    host      : ${u.hostname}`);
      console.log(`    port      : ${u.port || '5432 (default)'}`);
      console.log(`    database  : ${u.pathname.replace(/^\//, '') || '(EMPTY!)'}`);
      console.log(`    username  : ${u.username ? '(present)' : '(MISSING!)'}`);
      console.log(`    password  : ${u.password ? '(present)' : '(MISSING!)'}`);
      console.log(`    params    : ${JSON.stringify(params)}`);
    } catch {
      console.log('    url       : MALFORMED — does not parse as a URL at all');
    }
    process.exit(1);
  })
  .finally(() => void prisma.$disconnect());
