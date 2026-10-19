import { z } from 'zod';
import { clampScenarioParams } from '@xiaocai/engine';
import type { LlmProvider } from './provider';
import { tryComplete } from './provider';

/**
 * parseWhatIf: natural-language question → scenario parameters.
 * The prompt demands STRICT JSON; output is Zod-validated and clamped by the
 * engine regardless of what the model returns. Low confidence ⇒ clarification.
 * Supports English and 简体中文 questions.
 */

const rawSchema = z.object({
  salesChangePct: z.number(),
  supplierCostChangePct: z.number(),
  settlementDelayDays: z.number(),
  adSpendChangePct: z.number(),
  confidence: z.number().min(0).max(1)
});

export interface WhatIfResult {
  ok: boolean;
  needsClarification?: boolean;
  unavailable?: boolean;
  params?: { salesChangePct: number; supplierCostChangePct: number; settlementDelayDays: number; adSpendChangePct: number };
  confidence?: number;
}

const SYSTEM = `You convert small-business what-if questions into scenario parameters for a cash-flow simulator.
Answer with STRICT JSON ONLY — no prose, no markdown, no code fences.
Schema:
{"salesChangePct": number, "supplierCostChangePct": number, "settlementDelayDays": number, "adSpendChangePct": number, "confidence": number}
Rules:
- Percentages are whole numbers (e.g. -20 for "sales drop 20%").
- Anything NOT mentioned in the question stays 0.
- settlementDelayDays is ADDITIONAL days of payout delay (0 if not mentioned).
- confidence is 0..1 for how sure you are that the numbers match the question.
- Accept questions in English or Chinese (中文). If the question contains no usable numbers, set confidence to 0.`;

function extractJson(text: string): unknown {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end <= start) return null;
  try {
    return JSON.parse(text.slice(start, end + 1));
  } catch {
    return null;
  }
}

export async function parseWhatIf(provider: LlmProvider, question: string): Promise<WhatIfResult> {
  if (provider.name === 'noop') {
    return { ok: false, unavailable: true };
  }
  const text = await tryComplete(provider, {
    system: SYSTEM,
    user: `Question: ${question}`,
    maxTokens: 256
  });
  if (text === null || text.trim() === '') {
    return { ok: false, unavailable: true };
  }
  const parsed = rawSchema.safeParse(extractJson(text));
  if (!parsed.success) {
    return { ok: false, needsClarification: true };
  }
  const { confidence, ...raw } = parsed.data;
  if (confidence < 0.5) {
    return { ok: false, needsClarification: true, confidence };
  }
  return { ok: true, params: clampScenarioParams(raw), confidence };
}
