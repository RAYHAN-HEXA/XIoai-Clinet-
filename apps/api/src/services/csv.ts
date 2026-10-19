import Papa from 'papaparse';
import { z } from 'zod';

/**
 * CSV import pipeline helpers. Uploaded files are UNTRUSTED:
 *  - size/type enforced at the route (multer, ≤5 MB, text/csv)
 *  - every cell is validated + coerced through Zod before touching the DB
 *  - exports sanitize cells against spreadsheet formula injection (=, +, -, @)
 * CSV content is DATA, never instructions — it must never reach the LLM.
 */

export const IMPORT_KINDS = ['orders', 'settlements', 'ads', 'invoices'] as const;
export type ImportKind = (typeof IMPORT_KINDS)[number];

export const MAX_IMPORT_ROWS = 10_000;

/** Money columns in templates are YUAN (decimals allowed); stored as integer fen. */
export function yuanToFen(raw: string): number {
  const t = raw.trim().replace(/[¥,\s]/g, '');
  if (!/^-?\d+(\.\d{1,2})?$/.test(t)) throw new Error(`not a valid amount: "${raw}"`);
  return Math.round(parseFloat(t) * 100);
}

function dateField(raw: unknown): Date {
  const s = String(raw ?? '').trim();
  const d = new Date(s.length <= 10 ? `${s}T00:00:00Z` : s);
  if (Number.isNaN(d.getTime())) throw new Error(`not a valid date: "${raw}"`);
  return d;
}

function moneyFromYuan(raw: unknown): number {
  return yuanToFen(String(raw ?? ''));
}

export const rowSchemas: Record<ImportKind, z.ZodObject<z.ZodRawShape>> = {
  orders: z.object({
    channel: z.string().trim().min(1).max(40),
    externalId: z.string().trim().min(1).max(64),
    orderedAt: z.preprocess(dateField, z.date()),
    grossAmount: z.preprocess(moneyFromYuan, z.number().int().min(0)),
    platformFee: z.preprocess((v) => (v === '' || v == null ? 0 : moneyFromYuan(v)), z.number().int().min(0)).default(0),
    commission: z.preprocess((v) => (v === '' || v == null ? 0 : moneyFromYuan(v)), z.number().int().min(0)).default(0),
    deliveryCost: z.preprocess((v) => (v === '' || v == null ? 0 : moneyFromYuan(v)), z.number().int().min(0)).default(0),
    refundAmount: z.preprocess((v) => (v === '' || v == null ? 0 : moneyFromYuan(v)), z.number().int().min(0)).default(0),
    status: z.enum(['PENDING', 'COMPLETED', 'REFUNDED', 'CANCELLED']).default('COMPLETED'),
    productSku: z.string().trim().max(64).optional(),
    settlementDate: z.preprocess((v) => (v === '' || v == null ? undefined : dateField(v)), z.date().optional()),
    settledAmount: z.preprocess((v) => (v === '' || v == null ? undefined : moneyFromYuan(v)), z.number().int().min(0).optional())
  }),
  settlements: z.object({
    channel: z.string().trim().min(1).max(40),
    expectedDate: z.preprocess(dateField, z.date()),
    amount: z.preprocess(moneyFromYuan, z.number().int().min(0)),
    status: z.enum(['PENDING', 'RECEIVED']).default('PENDING')
  }),
  ads: z.object({
    channel: z.string().trim().min(1).max(40),
    campaign: z.string().trim().min(1).max(120),
    date: z.preprocess(dateField, z.date()),
    spend: z.preprocess(moneyFromYuan, z.number().int().min(0)),
    attributedRevenue: z.preprocess((v) => (v === '' || v == null ? 0 : moneyFromYuan(v)), z.number().int().min(0)).default(0)
  }),
  invoices: z.object({
    supplierName: z.string().trim().min(1).max(120),
    amount: z.preprocess(moneyFromYuan, z.number().int().min(0)),
    dueDate: z.preprocess(dateField, z.date()),
    status: z.enum(['PAID', 'DUE', 'OVERDUE', 'MISSING_DOC']).default('DUE'),
    documentRef: z.string().trim().max(120).optional()
  })
};

export const REQUIRED_COLUMNS: Record<ImportKind, string[]> = {
  orders: ['channel', 'externalId', 'orderedAt', 'grossAmount'],
  settlements: ['channel', 'expectedDate', 'amount'],
  ads: ['channel', 'campaign', 'date', 'spend'],
  invoices: ['supplierName', 'amount', 'dueDate']
};

export interface ParsedCsv {
  headers: string[];
  rows: Array<Record<string, string>>;
}

export function parseCsv(content: string): ParsedCsv {
  const result = Papa.parse<Record<string, string>>(content, {
    header: true,
    skipEmptyLines: 'greedy',
    transformHeader: (h) => h.trim()
  });
  const headers = result.meta.fields ?? [];
  return { headers, rows: result.data.filter((r) => Object.values(r).some((v) => (v ?? '').toString().trim() !== '')) };
}

/** Suggest a mapping templateField → csvHeader by normalized name match. */
export function suggestMapping(kind: ImportKind, headers: string[]): Record<string, string> {
  const normalize = (s: string): string => s.toLowerCase().replace(/[^a-z0-9]/g, '');
  const mapping: Record<string, string> = {};
  for (const field of Object.keys(rowSchemas[kind].shape as Record<string, unknown>)) {
    const target = normalize(field);
    const exact = headers.find((h) => normalize(h) === target);
    const loose = headers.find((h) => normalize(h).includes(target) || target.includes(normalize(h)));
    if (exact || loose) mapping[field] = (exact ?? loose) as string;
  }
  return mapping;
}

export interface ValidatedRow {
  rowNumber: number;
  data: Record<string, unknown>;
}
export interface RowError {
  rowNumber: number;
  errors: string[];
}

export function validateRows(
  kind: ImportKind,
  rows: Array<Record<string, string>>,
  mapping: Record<string, string>
): { valid: ValidatedRow[]; errors: RowError[] } {
  const schema = rowSchemas[kind];
  const valid: ValidatedRow[] = [];
  const errors: RowError[] = [];

  rows.forEach((raw, idx) => {
    const record: Record<string, unknown> = {};
    for (const [field, header] of Object.entries(mapping)) {
      record[field] = raw[header];
    }
    const parsed = schema.safeParse(record);
    if (parsed.success) {
      valid.push({ rowNumber: idx + 2, data: parsed.data as Record<string, unknown> }); // +2: header row, 1-indexed
    } else {
      errors.push({
        rowNumber: idx + 2,
        errors: parsed.error.issues.map((i) => `${String(i.path[0] ?? 'row')}: ${i.message}`)
      });
    }
  });

  return { valid, errors };
}

/** Neutralize spreadsheet formula injection for CSV exports. */
export function sanitizeCsvCell(value: string): string {
  return /^[-=@+\t\r]/.test(value) ? `'${value}` : value;
}
