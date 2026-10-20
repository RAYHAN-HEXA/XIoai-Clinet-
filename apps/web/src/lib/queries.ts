'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from './api';

/** API response types — mirror the server; money is integer fen. */

export interface Localized {
  en: string;
  zh: string;
}
export interface EvidenceRefDto {
  type: string;
  id: string;
  label: string;
  amountFen: number;
  dateISO: string;
}

export interface GroupRowDto {
  key: string;
  label: string;
  revenue: number;
  productCost: number;
  influencerCommission: number;
  delivery: number;
  refunds: number;
  platformFees: number;
  advertising?: number;
  profit: number;
  marginPct: number | null;
  orders: number;
  roas: number | null;
}

export interface SummaryDto {
  revenue: number;
  productCost: number;
  advertising: number;
  influencerCommission: number;
  delivery: number;
  refunds: number;
  platformFees: number;
  totalCosts: number;
  realProfit: number;
  marginPct: number | null;
  costRatiosPct: Record<string, number | null>;
}

export interface ForecastDayDto {
  day: number;
  dateISO: string;
  inflowFen: number;
  outflowFen: number;
  balanceFen: number;
}

export interface ForecastDto {
  days: ForecastDayDto[];
  minBalanceFen: number;
  minBalanceDay: number;
  firstShortageDay: number | null;
  firstShortageDateISO: string | null;
  closingBalanceFen: number;
  alertLevel: 'NONE' | 'WATCH' | 'WARNING' | 'CRITICAL';
  obligationsAtShortage: Array<{ id: string; label: string; amountFen: number; dueInDays: number }>;
  alertExplanation: Localized;
}

export interface ForecastResponse {
  base: ForecastDto;
  stressed: ForecastDto;
  stressParams: { salesChangePct: number; supplierCostChangePct: number; settlementDelayDays: number; adSpendChangePct: number };
}

export interface DriverDto {
  id: string;
  label: Localized;
  previousValue: number;
  currentValue: number;
  absDiff: number;
  pctDiff: number | null;
  contributionToFenProfitChange: number;
  impactOnProfit: 'POSITIVE' | 'NEGATIVE' | 'NONE';
  evidenceRefs: EvidenceRefDto[];
}

export interface FinancingOptionDto {
  id: string;
  rank: number;
  name: Localized;
  costLabel: Localized;
  speedLabel: Localized;
  bestWhen: Localized;
  documents: Localized[];
  risks: Localized[];
  matchedOn: Localized;
}

export interface BriefDto {
  urgentPayments: Array<{ id: string; label: string; amountFen: number; dueDate: string; urgency: string }>;
  overdueInvoices: Array<{ id: string; label: string; amountFen: number; dueDate: string }>;
  risingCosts: Array<{ category: Localized; previousFen: number; currentFen: number; changeFen: number; changePct: number | null }>;
  approvalsNeeded: Array<{ id: string; title: string }>;
  missingDocs: Array<{ id: string; label: string; amountFen: number; dueDate: string }>;
  cashRisk: { alertLevel: string; firstShortageDay: number | null; minBalanceFen: number } | null;
  revenueTrend: { last7Fen: number; prior7Fen: number; changePct: number | null };
}

export interface ApprovalDto {
  id: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  decidedAt: string | null;
  note: string;
  recommendation: { id: string; type: string; title: string; evidence: unknown; impact: unknown; action: unknown; createdAt: string };
}

export interface SourceDto {
  id: string;
  type: string;
  name: string;
  platform: string | null;
  status: 'GRANTED' | 'REVOKED';
  permission: 'READ_ONLY' | 'READ_WRITE';
  grantedAt: string;
  revokedAt: string | null;
  linkedOrders: number;
  linkedAds: number;
}

export interface AuditRowDto {
  id: string;
  action: string;
  entityType: string;
  entityId: string | null;
  ip: string | null;
  createdAt: string;
  hash: string | null;
}

export interface EvidenceTreeDto {
  level1: { label: Localized; valueFen: number; formula: Localized; periodLabel?: string };
  level2: Array<{ key: string; label: Localized; valueFen: number; sharePct: number | null }>;
  level3: EvidenceRefDto[];
  warnings: Localized[];
}

export interface ImportJobDto {
  id: string;
  kind: string;
  filename: string;
  rowsTotal: number;
  rowsOk: number;
  rowsFailed: number;
  status: string;
  createdAt: string;
}

// ── hooks ────────────────────────────────────────────────────────────────────

export function useProfitSummary(from?: string, to?: string) {
  const q = new URLSearchParams();
  if (from) q.set('from', from);
  if (to) q.set('to', to);
  return useQuery({
    queryKey: ['profit-summary', from ?? '', to ?? ''],
    queryFn: () =>
      api<{ summary: SummaryDto; byProduct: GroupRowDto[]; byCampaign: GroupRowDto[]; byChannel: GroupRowDto[]; meta: { ordersIncluded: number; ordersMissingProduct: number; notes: Localized[] } }>(
        `/api/profit/summary?${q.toString()}`
      )
  });
}

export function useGroupRows(kind: 'by-product' | 'by-campaign' | 'by-channel', from?: string, to?: string) {
  const q = new URLSearchParams();
  if (from) q.set('from', from);
  if (to) q.set('to', to);
  return useQuery({
    queryKey: ['profit-group', kind, from ?? '', to ?? ''],
    queryFn: () =>
      api<{ groups: GroupRowDto[]; meta: { ordersMissingProduct: number; notes: Localized[] } }>(
        `/api/profit/${kind}?${q.toString()}`
      )
  });
}

export interface DriverResponse {
  profitChangeFen: number;
  profitChangePct: number | null;
  previousProfitFen: number;
  currentProfitFen: number;
  drivers: DriverDto[];
  method: Localized;
  previous: { from: string; to: string };
  current: { from: string; to: string };
}

export function useDrivers(range?: { from: string; to: string; prevFrom?: string; prevTo?: string }) {
  const q = new URLSearchParams();
  if (range?.from) q.set('from', range.from);
  if (range?.to) q.set('to', range.to);
  if (range?.prevFrom) q.set('prevFrom', range.prevFrom);
  if (range?.prevTo) q.set('prevTo', range.prevTo);
  return useQuery({
    queryKey: ['drivers', range?.from ?? '', range?.to ?? '', range?.prevFrom ?? '', range?.prevTo ?? ''],
    queryFn: () => api<DriverResponse>(`/api/profit/drivers?${q.toString()}`)
  });
}

export interface DashboardSummaryDto {
  business: { name: string; nameZh: string | null; isDemo: boolean; openingCash: number; currency: string };
  range: { from: string; to: string };
  revenue: number;
  realProfit: number;
  marginPct: number | null;
  gmv30Fen: number;
  settledFen: number;
  obligationsFen: number;
  cash: {
    openingCashFen: number;
    alertLevel: 'NONE' | 'WATCH' | 'WARNING' | 'CRITICAL';
    firstShortageDay: number | null;
    firstShortageDateISO: string | null;
    minBalanceFen: number;
    minBalanceDay: number;
  };
  counts: {
    pendingApprovals: number;
    missingDocs: number;
    sourcesGranted: number;
    sourcesRevoked: number;
    ordersIncluded: number;
  };
  insights: Array<{
    id: string;
    severity: 'info' | 'warning' | 'critical' | 'positive';
    title: Localized;
    detail: Localized;
  }>;
  recentImports: ImportJobDto[];
  freshness: { lastOrderAt: string | null; lastImportAt: string | null; computedAt: string };
  revokedSourceCount: number;
}

export function useDashboardSummary() {
  return useQuery({
    queryKey: ['dashboard-summary'],
    queryFn: () => api<DashboardSummaryDto>('/api/dashboard/summary'),
    refetchOnMount: 'always'
  });
}

export interface MeResponse {
  user: { id: string; email: string; name: string; role: 'OWNER' | 'ACCOUNTANT' | 'VIEWER'; businessId: string; createdAt: string };
  business: { id: string; name: string; nameZh: string | null; currency: string; openingCash: number; isDemo: boolean; createdAt: string };
}

export function useMe() {
  return useQuery({ queryKey: ['me'], queryFn: () => api<MeResponse>('/api/auth/me'), staleTime: 60_000 });
}

export function useForecast() {
  return useQuery({ queryKey: ['forecast'], queryFn: () => api<ForecastResponse>('/api/cash/forecast') });
}

export function useCashAlerts() {
  return useQuery({
    queryKey: ['cash-alerts'],
    queryFn: () => api<ForecastDto & { completeness: { missingDocCount: number } }>('/api/cash/alerts')
  });
}

export function usePreviewScenario(params: { salesChangePct: number; supplierCostChangePct: number; settlementDelayDays: number; adSpendChangePct: number } | null) {
  return useQuery({
    queryKey: ['scenario-preview', params],
    enabled: !!params,
    queryFn: () => api<{ base: ForecastDto; result: ForecastDto }>('/api/cash/preview', { method: 'POST', body: JSON.stringify({ params }) })
  });
}

export function useSaveScenario() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { name: string; params: { salesChangePct: number; supplierCostChangePct: number; settlementDelayDays: number; adSpendChangePct: number } }) =>
      api('/api/cash/scenario', { method: 'POST', body: JSON.stringify(input) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['scenarios'] })
  });
}

export function useFinancing() {
  return useQuery({
    queryKey: ['financing'],
    queryFn: () => api<{ gap: { firstShortageDay: number | null; gapAmountFen: number | null }; reason: string; ranked: FinancingOptionDto[]; disclaimer: Localized; gapSummary: Localized }>(
      '/api/financing/options'
    )
  });
}

export function useBrief(lang: string) {
  return useQuery({
    queryKey: ['brief', lang],
    queryFn: () => api<{ brief: BriefDto; isDemo: boolean }>(`/api/brief/daily?lang=${lang}`)
  });
}

export function useApprovals() {
  return useQuery({ queryKey: ['approvals'], queryFn: () => api<{ approvals: ApprovalDto[] }>('/api/approvals') });
}

export function useDecideApproval() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { id: string; decision: 'APPROVED' | 'REJECTED'; note?: string }) =>
      api<{ nextStepsForOwner: string[] }>(`/api/approvals/${input.id}/decision`, {
        method: 'POST',
        body: JSON.stringify({ decision: input.decision, note: input.note })
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['approvals'] });
      qc.invalidateQueries({ queryKey: ['brief'] });
    }
  });
}

export function useCreateRecommendation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { type: string; title: string; evidence: unknown[]; impact: Record<string, unknown>; action: Record<string, unknown> }) =>
      api<{ approval: { id: string } }>('/api/recommendations', { method: 'POST', body: JSON.stringify(input) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['approvals'] })
  });
}

export interface ScenarioDto {
  id: string;
  name: string;
  params: { salesChangePct: number; supplierCostChangePct: number; settlementDelayDays: number; adSpendChangePct: number };
  result: { firstShortageDay: number | null; minBalanceFen: number; minBalanceDay: number; closingBalanceFen: number; alertLevel: string };
  createdAt: string;
}

export function useScenarios() {
  return useQuery({ queryKey: ['scenarios'], queryFn: () => api<{ scenarios: ScenarioDto[] }>('/api/cash/scenarios') });
}

export function useSources() {
  return useQuery({ queryKey: ['sources'], queryFn: () => api<{ sources: SourceDto[] }>('/api/sources') });
}

export function useToggleSource() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { id: string; status: 'GRANTED' | 'REVOKED' }) =>
      api(`/api/sources/${input.id}/status`, { method: 'POST', body: JSON.stringify({ status: input.status }) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['sources'] })
  });
}

export function useSetSourcePermission() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { id: string; permission: 'READ_ONLY' | 'READ_WRITE' }) =>
      api(`/api/sources/${input.id}/permission`, { method: 'POST', body: JSON.stringify({ permission: input.permission }) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['sources'] })
  });
}

export interface ImportPreviewDto {
  kind: string;
  filename: string;
  detectedHeaders: string[];
  suggestedMapping: Record<string, string>;
  missingRequiredColumns: string[];
  totalRows: number;
  validRows: number;
  errorRows: number;
  errors: Array<{ rowNumber: number; errors: string[] }>;
  sample: Array<Record<string, unknown>>;
}

export function useImportPreview() {
  return useMutation({
    mutationFn: (input: { kind: string; file: File }) => {
      const body = new FormData();
      body.append('file', input.file);
      return api<ImportPreviewDto>(`/api/imports/${input.kind}/preview`, { method: 'POST', body });
    }
  });
}

export interface ImportConfirmDto {
  job: ImportJobDto;
  inserted: number;
  duplicates: number;
  failedRows: number;
  errors: Array<{ rowNumber: number; errors: string[] }>;
}

export function useImportConfirm() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { kind: string; file: File; mapping?: Record<string, string> }) => {
      const body = new FormData();
      body.append('file', input.file);
      if (input.mapping) body.append('mapping', JSON.stringify(input.mapping));
      return api<ImportConfirmDto>(`/api/imports/${input.kind}`, { method: 'POST', body });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['imports'] });
      qc.invalidateQueries({ queryKey: ['dashboard-summary'] });
      qc.invalidateQueries({ queryKey: ['profit-summary'] });
      qc.invalidateQueries({ queryKey: ['forecast'] });
    }
  });
}

export function useSecurityEvents() {
  return useQuery({
    queryKey: ['security-events'],
    queryFn: () => api<{ events: Array<{ id: string; action: string; entityType: string; ip: string | null; createdAt: string }> }>(
      '/api/auth/events'
    )
  });
}

export function useAudit(params: { page: number; action?: string; from?: string; to?: string }) {
  const q = new URLSearchParams({ page: String(params.page), pageSize: '20' });
  if (params.action) q.set('action', params.action);
  if (params.from) q.set('from', params.from);
  if (params.to) q.set('to', params.to);
  return useQuery({
    queryKey: ['audit', params],
    queryFn: () => api<{ rows: AuditRowDto[]; total: number }>(`/api/audit?${q.toString()}`)
  });
}

export function useAuditIntegrity() {
  return useQuery({ queryKey: ['audit-integrity'], queryFn: () => api<{ valid: boolean; rows: number }>('/api/audit/integrity') });
}

export function useEvidence(metric: string | null) {
  return useQuery({
    queryKey: ['evidence', metric],
    enabled: !!metric,
    queryFn: () => api<EvidenceTreeDto>(`/api/evidence/${metric}`)
  });
}

export function useImports() {
  return useQuery({ queryKey: ['imports'], queryFn: () => api<{ jobs: ImportJobDto[] }>('/api/imports') });
}

export interface AskResponse {
  status: 'OK' | 'NEEDS_CLARIFICATION' | 'LLM_UNAVAILABLE';
  answer: string;
  params: { salesChangePct: number; supplierCostChangePct: number; settlementDelayDays: number; adSpendChangePct: number } | null;
  scenario?: { firstShortageDay: number | null; minBalanceFen: number; alertLevel: string };
  options?: FinancingOptionDto[];
  disclaimer?: Localized;
}

export function useAsk() {
  return useMutation({
    mutationFn: (input: { question: string; lang: string }) => api<AskResponse>('/api/assistant/ask', { method: 'POST', body: JSON.stringify(input) })
  });
}
