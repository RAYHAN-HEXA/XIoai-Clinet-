import { Router } from 'express';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { requireAuth, requireRole } from '../middleware/auth';
import { writeAudit } from '../audit/audit';
import { asyncHandler } from '../lib/async';

export const recommendationsRouter = Router();

/**
 * Every recommendation carries Evidence · Impact · Action, and APPROVED does
 * NOT execute anything — it only records the owner's decision. XiaoCai never
 * pays or messages anyone on its own.
 */

const createSchema = z.object({
  type: z.string().trim().min(1).max(60),
  title: z.string().trim().min(1).max(160),
  evidence: z.array(z.record(z.string(), z.unknown())).min(1),
  impact: z.record(z.string(), z.unknown()),
  action: z.record(z.string(), z.unknown())
});

const decisionSchema = z.object({
  decision: z.enum(['APPROVED', 'REJECTED']),
  note: z.string().trim().max(500).optional()
});

recommendationsRouter.get(
  '/',
  requireAuth,
  asyncHandler(async (req, res) => {
    const user = req.user!;
    const recommendations = await prisma.recommendation.findMany({
      where: { businessId: user.businessId },
      include: { approval: true },
      orderBy: { createdAt: 'desc' },
      take: 50
    });
    res.json({ recommendations });
  })
);

recommendationsRouter.post(
  '/',
  requireAuth,
  requireRole('OWNER', 'ACCOUNTANT'),
  asyncHandler(async (req, res) => {
    const user = req.user!;
    const body = createSchema.parse(req.body);
    const recommendation = await prisma.recommendation.create({
      data: {
        businessId: user.businessId,
        type: body.type,
        title: body.title,
        evidence: body.evidence as unknown as Prisma.InputJsonValue,
        impact: body.impact as unknown as Prisma.InputJsonValue,
        action: body.action as unknown as Prisma.InputJsonValue
      }
    });
    const approval = await prisma.approval.create({
      data: { recommendationId: recommendation.id, status: 'PENDING' }
    });
    writeAudit({
      businessId: user.businessId,
      userId: user.id,
      action: 'RECOMMENDATION_CREATED',
      entityType: 'RECOMMENDATION',
      entityId: recommendation.id,
      ip: req.ip,
      metadata: { type: body.type, title: body.title }
    });
    res.status(201).json({ recommendation, approval });
  })
);

export const approvalsRouter = Router();

approvalsRouter.get(
  '/',
  requireAuth,
  asyncHandler(async (req, res) => {
    const user = req.user!;
    const approvals = await prisma.approval.findMany({
      where: { recommendation: { businessId: user.businessId } },
      include: { recommendation: true },
      orderBy: [{ status: 'asc' }, { recommendation: { createdAt: 'desc' } }]
    });
    res.json({ approvals, principle: 'XiaoCai never pays or messages anyone on its own.' });
  })
);

approvalsRouter.post(
  '/:id/decision',
  requireAuth,
  requireRole('OWNER'),
  asyncHandler(async (req, res) => {
    const user = req.user!;
    const body = decisionSchema.parse(req.body);

    const approval = await prisma.approval.findFirst({
      where: { id: req.params['id'], recommendation: { businessId: user.businessId } },
      include: { recommendation: true }
    });
    if (!approval) {
      res.status(404).json({ error: 'NOT_FOUND' });
      return;
    }
    if (approval.status !== 'PENDING') {
      res.status(409).json({ error: 'CONFLICT', message: 'This recommendation was already decided.' });
      return;
    }

    const updated = await prisma.approval.update({
      where: { id: approval.id },
      data: { status: body.decision, decidedById: user.id, decidedAt: new Date(), note: body.note ?? '' },
      include: { recommendation: true }
    });

    writeAudit({
      businessId: user.businessId,
      userId: user.id,
      action: 'APPROVAL_DECISION',
      entityType: 'APPROVAL',
      entityId: approval.id,
      ip: req.ip,
      metadata: { decision: body.decision, recommendationId: approval.recommendationId, title: approval.recommendation.title }
    });

    // APPROVED does not execute anything — hand the owner the next steps instead.
    const nextSteps: Record<string, string[]> = {
      EXTEND_SUPPLIER_TERMS: [
        'Call the supplier and agree a new payment date in writing.',
        'Record the revised due date in your invoice ledger.',
        'Re-run the Survival Simulator to confirm the gap is closed.'
      ],
      SETTLEMENT_ADVANCE: [
        'Open your platform seller center and check the advance fee.',
        'Apply for the advance yourself — XiaoCai does not submit anything.',
        'Verify the payout arrives and re-check the cash curve.'
      ],
      MERCHANT_WORKING_CAPITAL: [
        'Compare the offer with at least one other lender.',
        'Prepare sales statements requested by the lender.',
        'Confirm the repayment schedule fits the projected inflow.'
      ],
      BANK_SME_LOAN: [
        'Book an appointment with your bank relationship manager.',
        'Prepare financial statements and tax records.',
        'Check personal-guarantee terms carefully before signing.'
      ]
    };
    const typeKey = approval.recommendation.type;
    const steps = nextSteps[typeKey] ?? [
      'Execute this decision through the appropriate counterparty yourself.',
      'Record the outcome in your books.',
      'Re-run the forecast to confirm the effect.'
    ];

    res.json({ approval: updated, decisionRecorded: true, executesNothing: true, nextStepsForOwner: steps });
  })
);
