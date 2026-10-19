import { Router, type Response } from 'express';
import { Prisma } from '@prisma/client';
import multer from 'multer';
import path from 'node:path';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { requireAuth, requireRole } from '../middleware/auth';
import { writeAudit } from '../audit/audit';
import { asyncHandler } from '../lib/async';
import {
  IMPORT_KINDS,
  MAX_IMPORT_ROWS,
  REQUIRED_COLUMNS,
  parseCsv,
  suggestMapping,
  validateRows,
  type ImportKind
} from '../services/csv';

export const importsRouter = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (ext === '.csv' || file.mimetype === 'text/csv') cb(null, true);
    else cb(new Error('ONLY_CSV'));
  }
});

function kindOf(raw: string): ImportKind | null {
  return (IMPORT_KINDS as readonly string[]).includes(raw) ? (raw as ImportKind) : null;
}

const mappingSchema = z.record(z.string());

function fail(res: Response, code: number, body: Record<string, unknown>): void {
  res.status(code).json(body);
}

// ── preview: parse + map + validate, commit nothing ─────────────────────────
importsRouter.post(
  '/:kind/preview',
  requireAuth,
  requireRole('OWNER', 'ACCOUNTANT'),
  upload.single('file'),
  asyncHandler(async (req, res) => {
    const user = req.user!;
    const kind = kindOf(req.params['kind'] ?? '');
    if (!kind) {
      fail(res, 404, { error: 'NOT_FOUND', message: `kind must be one of ${IMPORT_KINDS.join(', ')}` });
      return;
    }
    if (!req.file) {
      fail(res, 400, { error: 'VALIDATION', message: 'CSV file required (field name "file")' });
      return;
    }
    const parsed = parseCsv(req.file.buffer.toString('utf8'));
    if (parsed.rows.length === 0) {
      fail(res, 400, { error: 'VALIDATION', message: 'No data rows found' });
      return;
    }
    if (parsed.rows.length > MAX_IMPORT_ROWS) {
      fail(res, 413, { error: 'TOO_MANY_ROWS', message: `Max ${MAX_IMPORT_ROWS} rows per import` });
      return;
    }
    const missing = REQUIRED_COLUMNS[kind].filter(
      (c) => !Object.values(suggestMapping(kind, parsed.headers)).some((h) => h?.toLowerCase().includes(c.toLowerCase()))
    );
    const mapping = suggestMapping(kind, parsed.headers);
    const { valid, errors } = validateRows(kind, parsed.rows, mapping);
    writeAudit({
      businessId: user.businessId,
      userId: user.id,
      action: 'DATA_ACCESS',
      entityType: 'IMPORT_PREVIEW',
      entityId: kind,
      ip: req.ip,
      metadata: { rows: parsed.rows.length }
    });
    res.json({
      kind,
      filename: req.file.originalname,
      detectedHeaders: parsed.headers,
      suggestedMapping: mapping,
      missingRequiredColumns: missing,
      totalRows: parsed.rows.length,
      validRows: valid.length,
      errorRows: errors.length,
      errors: errors.slice(0, 100),
      sample: valid.slice(0, 20).map((v) => v.data)
    });
  })
);

// ── confirm: re-validate with the (possibly edited) mapping, then insert ────
importsRouter.post(
  '/:kind',
  requireAuth,
  requireRole('OWNER', 'ACCOUNTANT'),
  upload.single('file'),
  asyncHandler(async (req, res) => {
    const user = req.user!;
    const kind = kindOf(req.params['kind'] ?? '');
    if (!kind) {
      fail(res, 404, { error: 'NOT_FOUND', message: `kind must be one of ${IMPORT_KINDS.join(', ')}` });
      return;
    }
    if (!req.file) {
      fail(res, 400, { error: 'VALIDATION', message: 'CSV file required (field name "file")' });
      return;
    }
    let mapping: Record<string, string>;
    try {
      mapping = mappingSchema.parse(JSON.parse(String(req.body['mapping'] ?? '{}')));
    } catch {
      fail(res, 400, { error: 'VALIDATION', message: 'mapping must be JSON mapping templateField→csvHeader' });
      return;
    }

    const parsed = parseCsv(req.file.buffer.toString('utf8'));
    if (parsed.rows.length > MAX_IMPORT_ROWS) {
      fail(res, 413, { error: 'TOO_MANY_ROWS', message: `Max ${MAX_IMPORT_ROWS} rows per import` });
      return;
    }
    const { valid, errors } = validateRows(kind, parsed.rows, mapping);

    const job = await prisma.importJob.create({
      data: {
        businessId: user.businessId,
        kind: kind.toUpperCase() as 'ORDERS' | 'SETTLEMENTS' | 'ADS' | 'INVOICES',
        filename: req.file.originalname,
        rowsTotal: parsed.rows.length,
        status: 'RUNNING'
      }
    });

    let inserted = 0;
    let duplicates = 0;
    const products = await prisma.product.findMany({ where: { businessId: user.businessId }, select: { id: true, sku: true } });
    const skuToId = new Map(products.map((p) => [p.sku, p.id]));

    try {
      await prisma.$transaction(async (tx) => {
        for (const row of valid) {
          const d = row.data;
          if (kind === 'orders') {
            const data = d;
            const sku = data['productSku'];
            const productId = typeof sku === 'string' && sku !== '' ? (skuToId.get(sku) ?? null) : null;
            const existing = await tx.order.findFirst({
              where: { businessId: user.businessId, channel: data['channel'] as string, externalId: data['externalId'] as string },
              select: { id: true }
            });
            if (existing) {
              duplicates += 1;
              continue;
            }
            await tx.order.create({
              data: {
                businessId: user.businessId,
                channel: data['channel'] as string,
                externalId: data['externalId'] as string,
                productId,
                orderedAt: data['orderedAt'] as Date,
                grossAmount: data['grossAmount'] as number,
                platformFee: (data['platformFee'] as number) ?? 0,
                commission: (data['commission'] as number) ?? 0,
                deliveryCost: (data['deliveryCost'] as number) ?? 0,
                refundAmount: (data['refundAmount'] as number) ?? 0,
                status: (data['status'] as 'COMPLETED') ?? 'COMPLETED',
                settlementDate: (data['settlementDate'] as Date | undefined) ?? null,
                settledAmount: (data['settledAmount'] as number | undefined) ?? null
              }
            });
            inserted += 1;
          } else if (kind === 'settlements') {
            await tx.settlement.create({
              data: {
                businessId: user.businessId,
                channel: d['channel'] as string,
                expectedDate: d['expectedDate'] as Date,
                amount: d['amount'] as number,
                status: (d['status'] as 'PENDING') ?? 'PENDING'
              }
            });
            inserted += 1;
          } else if (kind === 'ads') {
            await tx.adSpend.create({
              data: {
                businessId: user.businessId,
                channel: d['channel'] as string,
                campaign: d['campaign'] as string,
                date: d['date'] as Date,
                spend: d['spend'] as number,
                attributedRevenue: (d['attributedRevenue'] as number) ?? 0
              }
            });
            inserted += 1;
          } else {
            await tx.supplierInvoice.create({
              data: {
                businessId: user.businessId,
                supplierName: d['supplierName'] as string,
                amount: d['amount'] as number,
                dueDate: d['dueDate'] as Date,
                status: (d['status'] as 'DUE') ?? 'DUE',
                documentRef: (d['documentRef'] as string | undefined) ?? null
              }
            });
            inserted += 1;
          }
        }
      });

      const finished = await prisma.importJob.update({
        where: { id: job.id },
        data: {
          rowsOk: inserted,
          rowsFailed: errors.length + duplicates,
          errors: {
            rowErrors: errors.slice(0, 100).map((e) => ({ rowNumber: e.rowNumber, errors: e.errors })) as unknown as Prisma.InputJsonValue,
            duplicates
          },
          status: 'COMPLETED'
        }
      });
      writeAudit({
        businessId: user.businessId,
        userId: user.id,
        action: 'IMPORT',
        entityType: 'IMPORT_JOB',
        entityId: finished.id,
        ip: req.ip,
        metadata: { kind, inserted, duplicates, failed: errors.length, filename: req.file.originalname }
      });
      res.json({ job: finished, inserted, duplicates, failedRows: errors.length, errors: errors.slice(0, 100) });
    } catch (err) {
      await prisma.importJob.update({ where: { id: job.id }, data: { status: 'FAILED', errors: { message: String(err) } } });
      throw err;
    }
  })
);

// ── templates + history ──────────────────────────────────────────────────────
const TEMPLATES: Record<ImportKind, string> = {
  orders: [
    'channel,externalId,orderedAt,grossAmount,platformFee,commission,deliveryCost,refundAmount,status,productSku,settlementDate,settledAmount',
    'douyin,1002001,2026-01-05,299.00,14.95,59.80,12.00,0,COMPLETED,XC-CUP-01,2026-01-12,224.25',
    'taobao,1002002,2026-01-05,499.00,24.95,99.80,12.00,499.00,REFUNDED,XC-DRESS-03,,'
  ].join('\n'),
  settlements: 'channel,expectedDate,amount,status\ndouyin,2026-01-20,5320.50,PENDING\ntaobao,2026-01-18,1240.00,RECEIVED',
  ads: 'channel,campaign,date,spend,attributedRevenue\ndouyin,超级直播,2026-01-05,520.00,1180.00\ntaobao,搜索直通车,2026-01-05,105.00,326.00',
  invoices: 'supplierName,amount,dueDate,status,documentRef\n绍兴纺织A,40000.00,2026-01-25,DUE,INV-2026-0117\n义乌包装B,1200.00,2026-01-25,MISSING_DOC,'
};

importsRouter.get(
  '/templates/:kind',
  requireAuth,
  (req, res) => {
    const kind = kindOf(req.params['kind'] ?? '');
    if (!kind) {
      fail(res, 404, { error: 'NOT_FOUND' });
      return;
    }
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="xiaocai-${kind}-template.csv"`);
    res.send(TEMPLATES[kind]);
  }
);

importsRouter.get(
  '/',
  requireAuth,
  requireRole('OWNER', 'ACCOUNTANT'),
  asyncHandler(async (req, res) => {
    const user = req.user!;
    const jobs = await prisma.importJob.findMany({
      where: { businessId: user.businessId },
      orderBy: { createdAt: 'desc' },
      take: 50
    });
    res.json({ jobs });
  })
);
