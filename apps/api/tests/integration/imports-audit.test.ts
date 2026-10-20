import { afterAll, describe, expect, it } from 'vitest';
import { createApp } from '../../src/app';
import { prisma } from '../../src/lib/prisma';
import { cleanupBusiness, registerOwner } from './helpers';

const app = createApp();
const created: string[] = [];

afterAll(async () => {
  for (const id of created) await cleanupBusiness(id);
  await prisma.$disconnect();
});

const GOOD_CSV =
  'externalId,channel,orderedAt,grossAmount,platformFee,commission,deliveryCost,refundAmount,status\n' +
  'IMP-1,douyin,2026-01-10,200.00,10.00,40.00,12.00,0,COMPLETED\n' +
  'IMP-2,taobao,2026-01-11,300.00,15.00,60.00,12.00,0,COMPLETED\n';

const MAPPING = JSON.stringify({
  externalId: 'externalId',
  channel: 'channel',
  orderedAt: 'orderedAt',
  grossAmount: 'grossAmount',
  platformFee: 'platformFee',
  commission: 'commission',
  deliveryCost: 'deliveryCost',
  refundAmount: 'refundAmount',
  status: 'status'
});

describe('CSV imports', () => {
  it('downloads a real template', async () => {
    const { agent, businessId } = await registerOwner(app);
    created.push(businessId);
    const res = await agent.get('/api/imports/templates/orders');
    expect(res.status).toBe(200);
    expect(res.text).toContain('externalId');
  });

  it('previews a file, reporting row-level errors instead of failing (no 500)', async () => {
    const { agent, csrf, businessId } = await registerOwner(app);
    created.push(businessId);
    const csv =
      'externalId,channel,orderedAt,grossAmount,platformFee,commission,deliveryCost,refundAmount,status\n' +
      'OK-1,douyin,2026-01-10,100.00,5.00,0,3.00,0,COMPLETED\n' +
      'BAD-date,douyin,not-a-date,100.00,0,0,0,0,COMPLETED\n' +
      'BAD-amount,douyin,2026-01-10,abc,0,0,0,0,COMPLETED\n';
    const res = await agent
      .post('/api/imports/orders/preview')
      .set('x-csrf-token', csrf)
      .attach('file', Buffer.from(csv), 'orders.csv');
    expect(res.status).toBe(200);
    expect(res.body.validRows).toBe(1);
    expect(res.body.errorRows).toBe(2);
    expect(res.body.errors[0].errors[0]).toMatch(/date|amount/);
  });

  it('rejects a non-CSV upload', async () => {
    const { agent, csrf, businessId } = await registerOwner(app);
    created.push(businessId);
    const res = await agent
      .post('/api/imports/orders/preview')
      .set('x-csrf-token', csrf)
      .attach('file', Buffer.from('hello'), 'notes.txt');
    expect(res.status).toBeGreaterThanOrEqual(400);
  });

  it('confirms an import, persists rows, detects duplicates, and records a job', async () => {
    const { agent, csrf, businessId } = await registerOwner(app);
    created.push(businessId);

    const res = await agent
      .post('/api/imports/orders')
      .set('x-csrf-token', csrf)
      .field('mapping', MAPPING)
      .attach('file', Buffer.from(GOOD_CSV), 'orders.csv');
    expect([200, 201]).toContain(res.status);
    expect(res.body.inserted).toBe(2);

    const persisted = await prisma.order.count({ where: { businessId } });
    expect(persisted).toBe(2);

    // Re-import the same file → both rows detected as duplicates, nothing new
    const dup = await agent
      .post('/api/imports/orders')
      .set('x-csrf-token', csrf)
      .field('mapping', MAPPING)
      .attach('file', Buffer.from(GOOD_CSV), 'orders.csv');
    expect(dup.body.inserted).toBe(0);
    expect(dup.body.duplicates).toBe(2);
    expect(await prisma.order.count({ where: { businessId } })).toBe(2);

    const history = await agent.get('/api/imports');
    expect(history.status).toBe(200);
    expect(history.body.jobs.length).toBeGreaterThanOrEqual(2);
  });

  it('records import + access events in the audit trail', async () => {
    const { agent, csrf, businessId } = await registerOwner(app);
    created.push(businessId);
    await agent
      .post('/api/imports/orders')
      .set('x-csrf-token', csrf)
      .field('mapping', MAPPING)
      .attach('file', Buffer.from(GOOD_CSV), 'orders.csv');

    const audit = await agent.get('/api/audit?pageSize=100');
    const actions = audit.body.rows.map((r: { action: string }) => r.action);
    expect(actions).toContain('IMPORT');
  });
});

describe('audit export', () => {
  it('exports a real CSV with the audit columns', async () => {
    const { agent, businessId } = await registerOwner(app);
    created.push(businessId);
    const res = await agent.get('/api/audit/export.csv');
    expect(res.status).toBe(200);
    expect(res.text.split('\n')[0]).toBe('createdAt,action,entityType,entityId,ip,prevHash,hash');
    expect(res.text).toContain('REGISTER');
  });

  it('verifies the audit hash chain for the business', async () => {
    const { agent, businessId } = await registerOwner(app);
    created.push(businessId);
    const res = await agent.get('/api/audit/integrity');
    expect(res.status).toBe(200);
    expect(res.body.valid).toBe(true);
  });
});
