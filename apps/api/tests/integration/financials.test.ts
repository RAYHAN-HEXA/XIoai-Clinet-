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

describe('true profit — documented ¥100,000 → ¥5,000 example', () => {
  it('reproduces the example exactly through the API', async () => {
    const { agent, businessId } = await registerOwner(app);
    created.push(businessId);
    const now = new Date();

    const product = await prisma.product.create({
      data: { businessId, sku: 'XC-EXAMPLE', name: 'Example product', unitCost: 2_500_000 }
    });
    await prisma.order.create({
      data: {
        businessId,
        channel: 'douyin',
        externalId: 'EX-1',
        productId: product.id,
        orderedAt: now,
        grossAmount: 10_000_000,
        platformFee: 500_000,
        commission: 2_000_000,
        deliveryCost: 1_200_000,
        refundAmount: 800_000,
        status: 'REFUNDED'
      }
    });
    await prisma.adSpend.create({
      data: { businessId, channel: 'douyin', campaign: 'Example campaign', date: now, spend: 2_500_000, attributedRevenue: 10_000_000 }
    });

    const res = await agent.get('/api/profit/summary');
    expect(res.status).toBe(200);
    const s = res.body.summary;
    expect(s.revenue).toBe(10_000_000);
    expect(s.productCost).toBe(2_500_000);
    expect(s.advertising).toBe(2_500_000);
    expect(s.influencerCommission).toBe(2_000_000);
    expect(s.delivery).toBe(1_200_000);
    expect(s.refunds).toBe(800_000);
    expect(s.platformFees).toBe(500_000);
    expect(s.totalCosts).toBe(9_500_000);
    expect(s.realProfit).toBe(500_000); // ¥5,000
    expect(s.marginPct).toBe(5);
  });
});

describe('cash forecast — documented day-12 stressed shortage', () => {
  it('base case never breaches; the −20% / supplier +10% stress breaches on day 12', async () => {
    const { agent, businessId } = await registerOwner(app);
    created.push(businessId);
    const now = new Date();

    await prisma.business.update({ where: { id: businessId }, data: { openingCash: 6_000_000 } });
    await prisma.order.create({
      data: { businessId, channel: 'douyin', externalId: 'GMV', orderedAt: now, grossAmount: 18_000_000, status: 'COMPLETED' }
    });
    await prisma.adSpend.create({
      data: { businessId, channel: 'douyin', campaign: 'c', date: now, spend: 2_400_000, attributedRevenue: 0 }
    });
    const day = (offset: number): Date => new Date(now.getTime() + offset * 86_400_000);
    await prisma.supplierInvoice.createMany({
      data: [
        { businessId, supplierName: 'Fabric A', amount: 4_000_000, dueDate: day(6), status: 'DUE' },
        { businessId, supplierName: 'Packaging B', amount: 5_000_000, dueDate: day(12), status: 'DUE' }
      ]
    });

    const res = await agent.get('/api/cash/forecast');
    expect(res.status).toBe(200);
    expect(res.body.base.firstShortageDay).toBeNull();
    expect(res.body.base.minBalanceFen).toBe(240_000);
    expect(res.body.base.minBalanceDay).toBe(12);
    expect(res.body.stressed.firstShortageDay).toBe(12);
  });
});

describe('data-source revocation', () => {
  it('revoked source data stops contributing to profit', async () => {
    const { agent, csrf, businessId } = await registerOwner(app);
    created.push(businessId);
    const now = new Date();

    const source = await prisma.dataSource.create({
      data: { businessId, type: 'CHANNEL', name: 'Douyin feed', permission: 'READ_ONLY', status: 'GRANTED' }
    });
    await prisma.order.create({
      data: { businessId, sourceId: source.id, channel: 'douyin', externalId: 'R-1', orderedAt: now, grossAmount: 5_000_000, status: 'COMPLETED' }
    });

    const included = await agent.get('/api/profit/summary');
    expect(included.body.summary.revenue).toBe(5_000_000);

    const revoke = await agent.post(`/api/sources/${source.id}/status`).set('x-csrf-token', csrf).send({ status: 'REVOKED' });
    expect(revoke.status).toBe(200);

    const excluded = await agent.get('/api/profit/summary');
    expect(excluded.body.summary.revenue).toBe(0);
  });
});

describe('scenario persistence', () => {
  it('saves and lists a scenario with its parameters', async () => {
    const { agent, csrf, businessId } = await registerOwner(app);
    created.push(businessId);

    const save = await agent
      .post('/api/cash/scenario')
      .set('x-csrf-token', csrf)
      .send({ name: 'Sales −20%', params: { salesChangePct: -20, supplierCostChangePct: 0, settlementDelayDays: 0, adSpendChangePct: 0 } });
    expect(save.status).toBe(201);

    const list = await agent.get('/api/cash/scenarios');
    expect(list.status).toBe(200);
    expect(list.body.scenarios.some((s: { name: string }) => s.name === 'Sales −20%')).toBe(true);
  });
});

describe('profit drivers', () => {
  it('returns reconciling drivers for two periods', async () => {
    const { agent, businessId } = await registerOwner(app);
    created.push(businessId);
    const now = new Date();
    const mk = (offsetDays: number, gross: number): Promise<unknown> =>
      prisma.order.create({
        data: {
          businessId,
          channel: 'douyin',
          externalId: `D-${offsetDays}-${gross}`,
          orderedAt: new Date(now.getTime() + offsetDays * 86_400_000),
          grossAmount: gross,
          status: 'COMPLETED'
        }
      });
    await mk(-5, 10_000_000);
    await mk(-40, 6_000_000);

    const res = await agent.get('/api/profit/drivers?from=' + new Date(now.getTime() - 30 * 86_400_000).toISOString() + '&to=' + now.toISOString());
    expect(res.status).toBe(200);
    expect(res.body.profitChangeFen).toBeDefined();
    const sum = (res.body.drivers as Array<{ contributionToFenProfitChange: number }>).reduce(
      (a, d) => a + d.contributionToFenProfitChange,
      0
    );
    // drivers reconcile to the total change
    expect(sum).toBe(res.body.profitChangeFen);
  });
});
