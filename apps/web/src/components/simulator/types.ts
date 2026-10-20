'use client';

import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { ForecastResponse } from '@/lib/queries';

export interface ScenarioParams {
  salesChangePct: number;
  supplierCostChangePct: number;
  settlementDelayDays: number;
  adSpendChangePct: number;
}

export const ZERO_PARAMS: ScenarioParams = {
  salesChangePct: 0,
  supplierCostChangePct: 0,
  settlementDelayDays: 0,
  adSpendChangePct: 0
};

export function isZeroParams(p: ScenarioParams): boolean {
  return (
    p.salesChangePct === 0 && p.supplierCostChangePct === 0 && p.settlementDelayDays === 0 && p.adSpendChangePct === 0
  );
}

export const CLAMPS = { percentMin: -80, percentMax: 200, delayMin: 0, delayMax: 60 } as const;

export function clampParams(raw: Partial<ScenarioParams>): ScenarioParams {
  const clampPct = (v: number | undefined): number =>
    Math.min(CLAMPS.percentMax, Math.max(CLAMPS.percentMin, Math.round(v ?? 0)));
  return {
    salesChangePct: clampPct(raw.salesChangePct),
    supplierCostChangePct: clampPct(raw.supplierCostChangePct),
    settlementDelayDays: Math.min(CLAMPS.delayMax, Math.max(CLAMPS.delayMin, Math.round(raw.settlementDelayDays ?? 0))),
    adSpendChangePct: clampPct(raw.adSpendChangePct)
  };
}

export interface SupplierObligationDto {
  id: string;
  label: string;
  dueInDays: number;
  amountFen: number;
  status: string;
}

export interface ForecastSpecDto {
  openingCashFen: number;
  asOfISO: string;
  horizonDays: number;
  dailySalesFen: number;
  settlementDelayDays: number;
  supplierObligations: SupplierObligationDto[];
  adSpendPerDayFen: number;
  fixedCostsPerDayFen: number;
  extraInflows?: Array<{ id: string; label: string; dayOffset: number; amountFen: number }>;
}

export interface ForecastWithSpecResponse extends ForecastResponse {
  spec: ForecastSpecDto;
}

export function useForecastWithSpec() {
  return useQuery({
    queryKey: ['forecast'],
    queryFn: () => api<ForecastWithSpecResponse>('/api/cash/forecast')
  });
}
