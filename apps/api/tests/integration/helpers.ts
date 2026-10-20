import request from 'supertest';
import type { Express } from 'express';
import { prisma } from '../../src/lib/prisma';
import { hashPassword } from '../../src/lib/password';

export interface Session {
  agent: request.SuperAgentTest;
  csrf: string;
}

let seq = 0;
export function uniqueEmail(prefix = 'user'): string {
  seq += 1;
  return `${prefix}.${Date.now()}.${seq}@integration.xiaocai.test`;
}

/** Register a fresh business + OWNER and return an authenticated agent. */
export async function registerOwner(app: Express): Promise<Session & { businessId: string; userId: string; email: string }> {
  const email = uniqueEmail('owner');
  const agent = request.agent(app);
  const res = await agent.post('/api/auth/register').send({
    name: 'Integration Owner',
    businessName: `Integration Biz ${seq}`,
    email,
    password: 'Passw0rd!'
  });
  if (res.status !== 201) throw new Error(`register failed: ${res.status} ${JSON.stringify(res.body)}`);
  return { agent, csrf: csrfFrom(res), businessId: res.body.business.id, userId: res.body.user.id, email };
}

/** Create an additional user in a business with the given role, then log in. */
export async function loginAs(app: Express, businessId: string, role: 'ACCOUNTANT' | 'VIEWER'): Promise<Session & { userId: string; email: string }> {
  const email = uniqueEmail(role.toLowerCase());
  const user = await prisma.user.create({
    data: { email, passwordHash: await hashPassword('Passw0rd!'), name: `${role} user`, role, businessId }
  });
  const agent = request.agent(app);
  const res = await agent.post('/api/auth/login').send({ email, password: 'Passw0rd!' });
  if (res.status !== 200) throw new Error(`login failed: ${res.status} ${JSON.stringify(res.body)}`);
  return { agent, csrf: csrfFrom(res), userId: user.id, email };
}

export function csrfFrom(res: request.Response): string {
  const raw = res.headers['set-cookie'] as unknown as string[] | undefined;
  const cookie = (raw ?? []).map((c) => c.split(';')[0]).find((c) => c.startsWith('xc_csrf='));
  return cookie ? cookie.slice('xc_csrf='.length) : '';
}

/** A Zod-shaped valid order insert helper for building fixtures directly. */
export async function insertOrder(
  businessId: string,
  overrides: Partial<{
    channel: string;
    externalId: string;
    orderedAt: Date;
    grossAmount: number;
    platformFee: number;
    commission: number;
    deliveryCost: number;
    refundAmount: number;
    status: 'PENDING' | 'COMPLETED' | 'REFUNDED' | 'CANCELLED';
  }> = {}
): Promise<string> {
  const row = await prisma.order.create({
    data: {
      businessId,
      channel: overrides.channel ?? 'douyin',
      externalId: overrides.externalId ?? uniqueEmail('ord'),
      orderedAt: overrides.orderedAt ?? new Date(),
      grossAmount: overrides.grossAmount ?? 0,
      platformFee: overrides.platformFee ?? 0,
      commission: overrides.commission ?? 0,
      deliveryCost: overrides.deliveryCost ?? 0,
      refundAmount: overrides.refundAmount ?? 0,
      status: overrides.status ?? 'COMPLETED'
    }
  });
  return row.id;
}

/** Best-effort cleanup of a business and everything cascading from it. */
export async function cleanupBusiness(businessId: string): Promise<void> {
  await prisma.business.delete({ where: { id: businessId } }).catch(() => undefined);
}
