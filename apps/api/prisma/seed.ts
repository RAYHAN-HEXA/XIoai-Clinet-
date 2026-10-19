/**
 * Deterministic demo seed — "Ms. Li" persona from the pitch deck.
 *
 * Run:  npm run db:seed   (inside apps/api)
 *
 * Tuned so the engine's documented invariants hold on LIVE data:
 *   - GMV of the last 30 days ≈ ¥180,000  (dailySalesFen ≈ 600,000)
 *   - settled cash ≈ ¥142,000
 *   - supplier obligations ≈ ¥90,000 incl. exactly 1 MISSING_DOC
 *   - supplier buckets on day 6 = ¥40,000 and day 12 = ¥50,000
 *     ⇒ with opening cash ¥60,000, sales ¥6,000/day settling in 5 days and
 *       ads ¥800/day, the BASE forecast stays positive (floor ¥2,400 @ day 12)
 *     ⇒ the STRESSED forecast (sales −20%, supplier +10%, payout +5d)
 *       has firstShortageDay = 12  (engine-tested invariant)
 *   - an OVERDUE ¥2,000 invoice keeps the brief dramatic without breaking day 12
 *
 * All rows carry isDemo=true on the business and deterministic external ids,
 * so re-running replaces the demo dataset safely. Real businesses are untouched.
 */
import bcrypt from 'bcryptjs';
import { prisma } from '../src/lib/prisma';

/** Deterministic PRNG (mulberry32) — same seed, same dataset. */
function mulberry32(seed: number): () => number {
  let t = seed >>> 0;
  return () => {
    t = (t + 0x6d2b79f5) >>> 0;
    let x = Math.imul(t ^ (t >>> 15), t | 1);
    x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

const FEN = 100;
const GMV30_TARGET = 18_000_000; // ¥180,000 in fen
const GMV_PREV_TARGET = 7_000_000; // ¥70,000 in fen
const SETTLED_TARGET = 14_200_000; // ¥142,000 in fen

const DEMO_EMAIL = 'msli@demo.xiaocai.ai';
const DEMO_PASSWORD = 'Demo1234!';

const BUSINESS_NAME = "Li's Livestream Store";
const BUSINESS_NAME_ZH = '李女士直播店';

async function main(): Promise<void> {
  const rng = mulberry32(20260101);
  const asOf = new Date();
  asOf.setUTCHours(0, 0, 0, 0);
  const day = (offset: number, hour = 9): Date => new Date(asOf.getTime() + offset * 86_400_000 + hour * 3_600_000);
  const isoDate = (d: Date): string => d.toISOString().slice(0, 10);

  // ── replace prior demo dataset only ───────────────────────────────────────
  await prisma.business.deleteMany({ where: { isDemo: true, name: BUSINESS_NAME } });

  const business = await prisma.business.create({
    data: { name: BUSINESS_NAME, nameZh: BUSINESS_NAME_ZH, openingCash: 6_000_000, isDemo: true }
  });

  const demoUser = await prisma.user.create({
    data: {
      email: DEMO_EMAIL,
      passwordHash: await bcrypt.hash(DEMO_PASSWORD, 10),
      name: 'Ms. Li 李女士',
      role: 'OWNER',
      businessId: business.id
    }
  });

  // ── data sources (all granted, read-only) ─────────────────────────────────
  const sourceDefs = [
    { type: 'CHANNEL' as const, name: 'Douyin Shop 抖音小店', platform: 'douyin' },
    { type: 'CHANNEL' as const, name: 'Taobao Store 淘宝店铺', platform: 'taobao' },
    { type: 'CHANNEL' as const, name: 'Xiaohongshu 小红书店铺', platform: 'xiaohongshu' },
    { type: 'ADS' as const, name: 'Juqian Ads 巨千广告', platform: 'douyin' },
    { type: 'LOGISTICS' as const, name: 'SF Express 顺丰物流', platform: 'sf' },
    { type: 'INVOICES' as const, name: 'Supplier invoices 供应商发票', platform: 'internal' },
    { type: 'BANK' as const, name: 'CMB Business Account 招行对公账户', platform: 'cmb' }
  ];
  const sources: Record<string, string> = {};
  for (const def of sourceDefs) {
    const row = await prisma.dataSource.create({
      data: { businessId: business.id, type: def.type, name: def.name, platform: def.platform, status: 'GRANTED', permission: 'READ_ONLY' }
    });
    sources[def.platform] = row.id;
  }

  // ── products ──────────────────────────────────────────────────────────────
  const productDefs = [
    { sku: 'XC-CUP-01', name: '保温杯 316L', basePrice: 19_900 },
    { sku: 'XC-CREAM-02', name: '烟酰胺面霜', basePrice: 29_900 },
    { sku: 'XC-DRESS-03', name: '真丝连衣裙', basePrice: 49_900 },
    { sku: 'XC-SHOE-04', name: '轻跑运动鞋', basePrice: 69_900 },
    { sku: 'XC-JACK-05', name: '白鸭绒羽绒服', basePrice: 89_900 }
  ];
  const products: Array<{ id: string; unitCost: number }> = [];
  for (const def of productDefs) {
    const row = await prisma.product.create({
      data: { businessId: business.id, sku: def.sku, name: def.name, unitCost: Math.round(def.basePrice * 0.3) }
    });
    products.push({ id: row.id, unitCost: row.unitCost });
  }

  // ── orders ────────────────────────────────────────────────────────────────
  const channels = [
    { name: 'douyin', sourceId: sources['douyin'], weight: 0.6 },
    { name: 'taobao', sourceId: sources['taobao'], weight: 0.25 },
    { name: 'xiaohongshu', sourceId: sources['xiaohongshu'], weight: 0.15 }
  ];
  const pickChannel = (): (typeof channels)[number] => {
    const r = rng();
    let acc = 0;
    for (const c of channels) {
      acc += c.weight;
      if (r <= acc) return c;
    }
    return channels[0]!;
  };
  const pickProduct = (): { id: string; unitCost: number; basePrice: number } => {
    const def = productDefs[Math.floor(rng() * productDefs.length)]!;
    return { ...def, basePrice: productDefs.find((p) => p.sku === def.sku)!.basePrice };
  };

  interface OrderDraft {
    day: number; // 0 = today, negative = past
    i: number;
    gross: number;
    product: { id: string; unitCost: number };
    channel: (typeof channels)[number];
    refund: boolean;
  }

  const drafts: OrderDraft[] = [];
  // recent 30 days: spike waves, normalized to exactly ¥180,000
  const rawRecent: OrderDraft[] = [];
  for (let d = -29; d <= 0; d++) {
    const count = 10 + Math.floor(rng() * 6) + (Math.abs(d) % 7 === 5 ? 4 : 0); // livestream spikes
    for (let i = 0; i < count; i++) {
      const product = pickProduct();
      const gross = Math.round(product.basePrice * (0.7 + rng() * 0.6));
      rawRecent.push({ day: d, i, gross, product, channel: pickChannel(), refund: rng() < 0.08 });
    }
  }
  const scaleRecent = GMV30_TARGET / rawRecent.reduce((s, o) => s + o.gross, 0);
  let seq = 0;
  for (const o of rawRecent) drafts.push({ ...o, gross: Math.round(o.gross * scaleRecent), i: seq++ });
  // normalize rounding residue onto the first order
  const recentSum = drafts.reduce((s, o) => s + o.gross, 0);
  drafts[0]!.gross += GMV30_TARGET - recentSum;

  // prior 30 days: lower volume & spend (gives the Driver Explainer a story)
  const rawPrev: OrderDraft[] = [];
  for (let d = -59; d <= -30; d++) {
    const count = 5 + Math.floor(rng() * 4);
    for (let i = 0; i < count; i++) {
      const product = pickProduct();
      const gross = Math.round(product.basePrice * (0.7 + rng() * 0.6));
      rawPrev.push({ day: d, i, gross, product, channel: pickChannel(), refund: rng() < 0.05 });
    }
  }
  const scalePrev = GMV_PREV_TARGET / rawPrev.reduce((s, o) => s + o.gross, 0);
  for (const o of rawPrev) drafts.push({ ...o, gross: Math.round(o.gross * scalePrev), i: seq++ });
  const prevSum = drafts.slice(rawRecent.length).reduce((s, o) => s + o.gross, 0);
  drafts[rawRecent.length]!.gross += GMV_PREV_TARGET - prevSum;

  // settlements: eligible = ordered ≥5 days ago; greedy-fill to ≈ ¥142,000 settled
  const eligible = drafts.filter((o) => o.day <= -5).sort((a, b) => a.day - b.day);
  const settledIds = new Set<number>();
  let settledSum = 0;
  for (const o of eligible) {
    if (settledSum >= SETTLED_TARGET) break;
    settledIds.add(o.i);
    settledSum += o.gross - Math.round(o.gross * 0.05) - Math.round(o.gross * 0.2);
  }

  const settlementRows: Array<{ channel: string; expectedDate: Date; amount: number; status: 'PENDING' | 'RECEIVED' }> = [];
  const agg = new Map<string, { channel: string; expectedDate: Date; amount: number; status: 'PENDING' | 'RECEIVED' }>();
  const addSettlement = (channel: string, expectedDate: Date, amount: number, status: 'PENDING' | 'RECEIVED'): void => {
    const key = `${channel}|${isoDate(expectedDate)}|${status}`;
    const existing = agg.get(key);
    if (existing) existing.amount += amount;
    else agg.set(key, { channel, expectedDate, amount, status });
  };

  for (const o of drafts) {
    const orderedAt = day(o.day, 8 + Math.floor(rng() * 10));
    const received = settledIds.has(o.i);
    // payout lag: recent era 5–15 days (matches the forecast model), older 10–20
    const lag = o.day >= -29 ? 5 + Math.floor(rng() * 11) : 10 + Math.floor(rng() * 11);
    const settleDate = new Date(orderedAt.getTime() + lag * 86_400_000);
    const platformFee = Math.round(o.gross * 0.05);
    const commission = Math.round(o.gross * (o.day >= -29 ? 0.2 : 0.12));
    const deliveryCost = 1_200;
    const refundAmount = o.refund ? o.gross : 0;

    await prisma.order.create({
      data: {
        businessId: business.id,
        sourceId: o.channel.sourceId,
        channel: o.channel.name,
        externalId: `DEMO-${String(o.day).padStart(3, '0')}-${String(o.i).padStart(4, '0')}`,
        productId: o.product.id,
        orderedAt,
        grossAmount: o.gross,
        platformFee,
        commission,
        deliveryCost,
        refundAmount,
        status: 'COMPLETED',
        settlementDate: settleDate,
        settledAmount: received ? o.gross - platformFee - commission : null
      }
    });

    if (settleDate.getTime() <= asOf.getTime()) {
      addSettlement(o.channel.name, settleDate, o.gross - platformFee - commission, 'RECEIVED');
    } else {
      addSettlement(o.channel.name, settleDate, o.gross - platformFee - commission, 'PENDING');
    }
  }
  settlementRows.push(...agg.values());
  for (const s of settlementRows) {
    await prisma.settlement.create({
      data: { businessId: business.id, channel: s.channel, expectedDate: s.expectedDate, amount: s.amount, status: s.status }
    });
  }

  // ── ad spend: ¥800/day total across 3 campaigns ───────────────────────────
  const campaigns = [
    { channel: 'douyin', campaign: '超级直播', perDay: 500_000, sourceId: sources['douyin'], roas: 2.2 },
    { channel: 'xiaohongshu', campaign: '新品种草', perDay: 200_000, sourceId: sources['xiaohongshu'], roas: 1.6 },
    { channel: 'taobao', campaign: '搜索直通车', perDay: 100_000, sourceId: sources['taobao'], roas: 3.1 }
  ];
  for (let d = -59; d <= 0; d++) {
    for (const c of campaigns) {
      const wave = 0.7 + rng() * 0.6 + (Math.abs(d) % 7 === 5 ? 0.5 : 0);
      const spend = Math.round(c.perDay * wave);
      await prisma.adSpend.create({
        data: {
          businessId: business.id,
          sourceId: sources[c.channel],
          channel: c.channel,
          campaign: c.campaign,
          date: day(d, 12),
          spend,
          attributedRevenue: Math.round(spend * c.roas * (0.8 + rng() * 0.4))
        }
      });
    }
  }

  // ── supplier invoices: ¥90,000 due incl. exactly 1 MISSING_DOC ────────────
  // day-6 bucket ¥40,000 (engine demo sup-1) · day-12 bucket ¥50,000 (sup-2 + missing doc)
  const invoiceDefs = [
    { supplierName: '绍兴纺织 A 绍兴面料厂', amount: 4_000_000, dueOffset: 6, status: 'DUE' as const, documentRef: 'INV-2026-0117' },
    { supplierName: '义乌包装 B 义乌彩印厂', amount: 4_880_000, dueOffset: 12, status: 'DUE' as const, documentRef: 'INV-2026-0123' },
    { supplierName: '东莞辅料 C 宏达辅料', amount: 120_000, dueOffset: 12, status: 'MISSING_DOC' as const, documentRef: null },
    { supplierName: '广州物流 D 快运公司', amount: 200_000, dueOffset: -3, status: 'OVERDUE' as const, documentRef: 'INV-2025-0991' },
    { supplierName: '杭州云仓 E 仓储服务', amount: 300_000, dueOffset: -10, status: 'PAID' as const, documentRef: 'INV-2025-0954' }
  ];
  for (const inv of invoiceDefs) {
    await prisma.supplierInvoice.create({
      data: {
        businessId: business.id,
        supplierName: inv.supplierName,
        amount: inv.amount,
        dueDate: day(inv.dueOffset, 12),
        status: inv.status,
        documentRef: inv.documentRef
      }
    });
  }

  const counts = {
    orders: await prisma.order.count({ where: { businessId: business.id } }),
    settlements: await prisma.settlement.count({ where: { businessId: business.id } }),
    ads: await prisma.adSpend.count({ where: { businessId: business.id } }),
    invoices: await prisma.supplierInvoice.count({ where: { businessId: business.id } })
  };

  console.log('Demo seed complete — Ms. Li sandbox is ready.');
  console.log(`  business : ${business.name} (${business.id})  isDemo=true`);
  console.log(`  login    : ${DEMO_EMAIL} / ${DEMO_PASSWORD}`);
  console.log(`  rows     : ${JSON.stringify(counts)}`);
  console.log(`  GMV(30d) : ¥${(recentSum / FEN).toLocaleString('en-US')} (target ¥18,000) · settled target ¥${SETTLED_TARGET / FEN}`);
  console.log('  All demo data is illustrative — sandbox demo dataset.');
  void demoUser;
}

void main()
  .catch((err: unknown) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => void prisma.$disconnect());
