import { afterAll, describe, expect, it } from 'vitest';
import { createApp } from '../../src/app';
import { prisma } from '../../src/lib/prisma';
import { cleanupBusiness, loginAs, registerOwner } from './helpers';

const app = createApp();
const created: string[] = [];

afterAll(async () => {
  for (const id of created) await cleanupBusiness(id);
  await prisma.$disconnect();
});

async function seedRecommendation(csrf: string, agent: Awaited<ReturnType<typeof registerOwner>>['agent']): Promise<string> {
  const res = await agent
    .post('/api/recommendations')
    .set('x-csrf-token', csrf)
    .send({ type: 'EXTEND_SUPPLIER_TERMS', title: 'Move invoice', evidence: [{ a: 1 }], impact: {}, action: {} });
  expect(res.status).toBe(201);
  return res.body.approval.id as string;
}

describe('role-based authorization', () => {
  it('VIEWER can read financials but not mutate, import, or view audit', async () => {
    const owner = await registerOwner(app);
    created.push(owner.businessId);
    const approvalId = await seedRecommendation(owner.csrf, owner.agent);

    const viewer = await loginAs(app, owner.businessId, 'VIEWER');

    expect((await viewer.agent.get('/api/profit/summary')).status).toBe(200);
    expect((await viewer.agent.get('/api/audit')).status).toBe(403);
    expect((await viewer.agent.get(`/api/audit/export.csv`)).status).toBe(403);
    expect(
      (await viewer.agent.post(`/api/approvals/${approvalId}/decision`).set('x-csrf-token', viewer.csrf).send({ decision: 'APPROVED' })).status
    ).toBe(403);
    expect((await viewer.agent.post('/api/imports/orders/preview').set('x-csrf-token', viewer.csrf)).status).toBe(403);
    expect((await viewer.agent.get('/api/sources')).status).toBe(200);
  });

  it('ACCOUNTANT can import and view audit but cannot decide an approval', async () => {
    const owner = await registerOwner(app);
    created.push(owner.businessId);
    const approvalId = await seedRecommendation(owner.csrf, owner.agent);
    const accountant = await loginAs(app, owner.businessId, 'ACCOUNTANT');

    expect((await accountant.agent.get('/api/audit')).status).toBe(200);
    const decide = await accountant.agent
      .post(`/api/approvals/${approvalId}/decision`)
      .set('x-csrf-token', accountant.csrf)
      .send({ decision: 'APPROVED' });
    expect(decide.status).toBe(403);
  });

  it('OWNER can decide an approval; the decision is persisted once', async () => {
    const owner = await registerOwner(app);
    created.push(owner.businessId);
    const approvalId = await seedRecommendation(owner.csrf, owner.agent);

    const approve = await owner.agent
      .post(`/api/approvals/${approvalId}/decision`)
      .set('x-csrf-token', owner.csrf)
      .send({ decision: 'APPROVED', note: 'ok' });
    expect(approve.status).toBe(200);
    expect(approve.body.approval.status).toBe('APPROVED');
    expect(approve.body.executesNothing).toBe(true);

    const again = await owner.agent
      .post(`/api/approvals/${approvalId}/decision`)
      .set('x-csrf-token', owner.csrf)
      .send({ decision: 'REJECTED' });
    expect(again.status).toBe(409);
  });
});

describe('business isolation (tenant isolation)', () => {
  it('one business cannot read or decide another business approvals', async () => {
    const a = await registerOwner(app);
    const b = await registerOwner(app);
    created.push(a.businessId, b.businessId);

    const approvalInA = await seedRecommendation(a.csrf, a.agent);

    // B's owner sees none of A's approvals
    const listB = await b.agent.get('/api/approvals');
    expect(listB.status).toBe(200);
    expect(listB.body.approvals.some((x: { id: string }) => x.id === approvalInA)).toBe(false);

    // B's owner cannot decide A's approval (IDOR)
    const idor = await b.agent
      .post(`/api/approvals/${approvalInA}/decision`)
      .set('x-csrf-token', b.csrf)
      .send({ decision: 'APPROVED' });
    expect(idor.status).toBe(404);
  });

  it('audit is scoped to the authenticated business', async () => {
    const a = await registerOwner(app);
    const b = await registerOwner(app);
    created.push(a.businessId, b.businessId);

    const auditB = await b.agent.get('/api/audit?pageSize=100');
    expect(auditB.status).toBe(200);
    const ids = auditB.body.rows.map((r: { businessId: string }) => r.businessId);
    expect(ids.every((id: string) => id === b.businessId)).toBe(true);
  });
});
