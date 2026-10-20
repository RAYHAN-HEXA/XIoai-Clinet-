import { Router } from 'express';
import { randomUUID, randomBytes } from 'node:crypto';
import bcrypt from 'bcryptjs';
import type { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { SESSION_TTL_SECONDS, signSession } from '../lib/jwt';
import { SESSION_COOKIE, sessionCookieOptions } from '../lib/cookies';
import { issueCsrfToken } from '../middleware/csrf';
import { rateLimit } from 'express-rate-limit';
import { writeAudit } from '../audit/audit';
import { asyncHandler } from '../lib/async';

/**
 * Demo mode — "Try the Ms. Li demo".
 *
 * ISOLATION: every demo visit clones the canonical (seeded) demo business into
 * a fresh, private business (name + " (Demo clone)"), together with its user,
 * sources, products, orders, ad spend, invoices, settlements, recommendations
 * and approvals. The visitor's session points at THEIR clone, so approvals,
 * imports, source revocations and scenarios performed by one visitor can never
 * be seen (or broken) by another visitor.
 *
 * NO SECRET IN THE CLIENT: the clone's password is random and never returned —
 * the endpoint issues the session cookie directly (exactly like login does).
 * Clones are purged after 24 h on a best-effort basis; the canonical demo
 * dataset (isDemo, no clone suffix) is never touched.
 *
 * Anonymous, pre-auth endpoint (like /login and /register) — CSRF-exempt by
 * design, rate-limited per IP.
 */

export const demoRouter = Router();

const CLONE_SUFFIX = ' (Demo clone)';
const CLONE_TTL_MS = 24 * 60 * 60 * 1000;

const DEMO_ROLES = ['OWNER', 'ACCOUNTANT', 'VIEWER'] as const;
type DemoRole = (typeof DEMO_ROLES)[number];
const isDemoRole = (v: unknown): v is DemoRole =>
  typeof v === 'string' && (DEMO_ROLES as readonly string[]).includes(v);

const demoLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: 20,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'RATE_LIMITED', message: 'Too many demo sessions. Try again shortly.' }
});

async function purgeOldClones(): Promise<void> {
  const cutoff = new Date(Date.now() - CLONE_TTL_MS);
  const old = await prisma.business.findMany({
    where: { isDemo: true, name: { endsWith: CLONE_SUFFIX }, createdAt: { lt: cutoff } },
    select: { id: true }
  });
  for (const b of old) {
    try {
      await prisma.business.delete({ where: { id: b.id } }); // cascades to all rows + sessions
    } catch (err) {
      // best effort — a failed purge must never block a demo visit
      void err;
    }
  }
}

async function findCanonicalDemo(): Promise<string | null> {
  const candidates = await prisma.business.findMany({
    where: { isDemo: true, name: { not: { endsWith: CLONE_SUFFIX } } },
    select: { id: true, _count: { select: { orders: true } } },
    orderBy: { createdAt: 'asc' }
  });
  const withData = candidates.filter((c) => c._count.orders > 0);
  return withData[0]?.id ?? null;
}

demoRouter.post(
  '/',
  demoLimiter,
  asyncHandler(async (req, res) => {
    await purgeOldClones();

    const canonicalId = await findCanonicalDemo();
    if (!canonicalId) {
      res.status(503).json({ error: 'DEMO_UNAVAILABLE', message: 'Demo dataset is not seeded on this environment.' });
      return;
    }

    const suffix = `-${randomUUID().slice(0, 8)}`;
    // The visitor picks which role to experience; the clone's user carries that
    // role so server-side requireRole behaves exactly as in production.
    const role: DemoRole = isDemoRole((req.body as { role?: unknown } | undefined)?.role)
      ? ((req.body as { role: DemoRole }).role)
      : 'OWNER';
    const newIds = {
      dataSources: new Map<string, string>(),
      products: new Map<string, string>()
    };

    const source = await prisma.business.findUniqueOrThrow({
      where: { id: canonicalId },
      include: {
        users: { take: 1, orderBy: { createdAt: 'asc' } },
        dataSources: true,
        products: true,
        orders: { orderBy: { orderedAt: 'asc' } },
        adSpends: true,
        supplierInvoices: true,
        settlements: true,
        recommendations: true
      }
    });

    // Sequential writes (not one long interactive transaction): the Neon
    // websocket adapter is unreliable across multi-second interactive
    // transactions. Failure ⇒ delete the partial clone (cascade), so a visitor
    // never sees half a demo business.
    let businessId: string | null = null;
    let business: Awaited<ReturnType<typeof prisma.business.create>>;
    let user: Awaited<ReturnType<typeof prisma.user.create>>;
    try {
      const passwordHash = await bcrypt.hash(randomBytes(24).toString('hex'), 10);
      business = await prisma.business.create({
        data: {
          name: `${source.name}${CLONE_SUFFIX}`,
          nameZh: source.nameZh ? `${source.nameZh}（演示）` : null,
          currency: source.currency,
          openingCash: source.openingCash,
          isDemo: true
        }
      });
      businessId = business.id;

      user = await prisma.user.create({
        data: {
          email: `demo${suffix}@demo.xiaocai.ai`,
          passwordHash,
          name: source.users[0]?.name ?? 'Demo owner',
          role,
          businessId: business.id
        }
      });

      for (const s of source.dataSources) {
        const created = await prisma.dataSource.create({
          data: {
            businessId: business.id,
            type: s.type,
            name: s.name,
            platform: s.platform,
            status: s.status,
            permission: s.permission,
            grantedAt: s.grantedAt,
            revokedAt: s.revokedAt
          }
        });
        newIds.dataSources.set(s.id, created.id);
      }

      for (const p of source.products) {
        const created = await prisma.product.create({
          data: { businessId: business.id, sku: p.sku, name: p.name, unitCost: p.unitCost }
        });
        newIds.products.set(p.id, created.id);
      }

      await prisma.order.createMany({
        data: source.orders.map((o) => ({
          businessId: business.id,
          sourceId: o.sourceId ? (newIds.dataSources.get(o.sourceId) ?? null) : null,
          channel: o.channel,
          externalId: o.externalId,
          productId: o.productId ? (newIds.products.get(o.productId) ?? null) : null,
          orderedAt: o.orderedAt,
          grossAmount: o.grossAmount,
          platformFee: o.platformFee,
          commission: o.commission,
          deliveryCost: o.deliveryCost,
          refundAmount: o.refundAmount,
          status: o.status,
          settlementDate: o.settlementDate,
          settledAmount: o.settledAmount
        }))
      });

      await prisma.adSpend.createMany({
        data: source.adSpends.map((a) => ({
          businessId: business.id,
          sourceId: a.sourceId ? (newIds.dataSources.get(a.sourceId) ?? null) : null,
          channel: a.channel,
          campaign: a.campaign,
          date: a.date,
          spend: a.spend,
          attributedRevenue: a.attributedRevenue
        }))
      });

      await prisma.supplierInvoice.createMany({
        data: source.supplierInvoices.map((i) => ({
          businessId: business.id,
          supplierName: i.supplierName,
          amount: i.amount,
          dueDate: i.dueDate,
          status: i.status,
          documentRef: i.documentRef
        }))
      });

      await prisma.settlement.createMany({
        data: source.settlements.map((s) => ({
          businessId: business.id,
          channel: s.channel,
          expectedDate: s.expectedDate,
          amount: s.amount,
          status: s.status
        }))
      });

      for (const r of source.recommendations) {
        const rec = await prisma.recommendation.create({
          data: {
            businessId: business.id,
            type: r.type,
            title: r.title,
            evidence: r.evidence as Prisma.InputJsonValue,
            impact: r.impact as Prisma.InputJsonValue,
            action: r.action as Prisma.InputJsonValue,
            createdAt: r.createdAt
          }
        });
        const existing = await prisma.approval.findUnique({ where: { recommendationId: r.id } });
        if (existing) {
          await prisma.approval.create({
            data: {
              recommendationId: rec.id,
              status: existing.status,
              decidedById: null, // decisions belong to the original business — never carried over
              decidedAt: existing.decidedAt,
              note: existing.note
            }
          });
        }
      }
    } catch (err) {
      if (businessId) {
        await prisma.business.delete({ where: { id: businessId } }).catch(() => undefined);
      }
      throw err;
    }

    const jti = randomUUID();
    await prisma.session.create({
      data: { id: jti, userId: user.id, expiresAt: new Date(Date.now() + SESSION_TTL_SECONDS * 1000), ip: req.ip ?? null }
    });
    const token = signSession({ userId: user.id, businessId: business.id, role: user.role, jti });
    res.cookie(SESSION_COOKIE, token, sessionCookieOptions());
    issueCsrfToken(req, res);

    writeAudit({
      businessId: business.id,
      userId: user.id,
      action: 'DEMO_SESSION',
      entityType: 'USER',
      entityId: user.id,
      ip: req.ip,
      metadata: { clonedFrom: canonicalId }
    });

    const { passwordHash: _ph, ...safeUser } = user;
    res.status(201).json({ user: safeUser, business, demo: true });
  })
);
