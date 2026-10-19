/**
 * One-off E2E helper: dumps the audit trail of the test business, then deletes it
 * (cascades to users + audit rows). Runs against DATABASE_URL from the environment.
 */
import { prisma } from '../src/lib/prisma';

async function main(): Promise<void> {
  const business = await prisma.business.findFirst({
    where: { name: 'Phase 1 Check Business' },
    select: { id: true }
  });

  if (!business) {
    console.log('AUDIT_ROWS [] (test business not found)');
    return;
  }

  const rows = await prisma.auditLog.findMany({
    where: { businessId: business.id },
    orderBy: { createdAt: 'asc' },
    select: { action: true, entityType: true, entityId: true, ip: true, createdAt: true }
  });
  console.log('AUDIT_ROWS', JSON.stringify(rows, null, 2));

  const deleted = await prisma.business.delete({ where: { id: business.id } });
  console.log('CLEANED_UP business:', deleted.name);
}

void main()
  .catch((err: unknown) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => void prisma.$disconnect());
