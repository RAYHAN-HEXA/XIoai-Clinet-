import { Router } from 'express';
import { z } from 'zod';
import { applyScenario, financingMatcher } from '@xiaocai/engine';
import { getLlmProvider } from '../ai/provider';
import { parseWhatIf } from '../ai/parseWhatIf';
import { explain } from '../ai/explain';
import { templateShortage, TEMPLATES } from '../ai/templates';
import { buildBaseForecastSpec } from '../services/forecast-spec';
import { requireAuth } from '../middleware/auth';
import { writeAudit } from '../audit/audit';
import { asyncHandler } from '../lib/async';

export const assistantRouter = Router();

const askSchema = z.object({
  question: z.string().trim().min(1).max(500),
  lang: z.enum(['en', 'zh']).default('en')
});

/**
 * Natural-language what-if: "If sales drop 20% and supplier costs rise 10%,
 * when do I run short?" → LLM extracts params (Zod + clamped) → the ENGINE
 * computes → the LLM explains (number-guarded) → financing options attach.
 * With the LLM off, the caller gets a template nudge toward the sliders.
 * CSV/user text never reaches the LLM — only the question field does, and it
 * is treated as untrusted data inside a fixed extraction prompt.
 */
assistantRouter.post(
  '/ask',
  requireAuth,
  asyncHandler(async (req, res) => {
    const user = req.user!;
    const body = askSchema.parse(req.body);
    const lang = body.lang;
    const provider = getLlmProvider();

    writeAudit({
      businessId: user.businessId,
      userId: user.id,
      action: 'ASSISTANT_ASK',
      entityType: 'ASSISTANT',
      ip: req.ip,
      metadata: { lang, questionLength: body.question.length }
    });

    const parsed = await parseWhatIf(provider, body.question);
    if (parsed.unavailable) {
      res.json({ status: 'LLM_UNAVAILABLE', answer: TEMPLATES.llmUnavailable[lang], params: null });
      return;
    }
    if (!parsed.ok || !parsed.params) {
      res.json({ status: 'NEEDS_CLARIFICATION', answer: TEMPLATES.needsClarification[lang], params: null });
      return;
    }

    const spec = await buildBaseForecastSpec(user.businessId);
    const stressed = applyScenario(spec, parsed.params);

    const financing = financingMatcher({
      gapAmountFen: stressed.firstShortageDay !== null ? stressed.minBalanceFen : null,
      firstShortageDay: stressed.firstShortageDay,
      reason: 'SHORT_GAP'
    });

    const engineJson = {
      params: parsed.params,
      firstShortageDay: stressed.firstShortageDay,
      firstShortageDateISO: stressed.firstShortageDateISO,
      minBalanceFen: stressed.minBalanceFen,
      minBalanceDay: stressed.minBalanceDay,
      alertLevel: stressed.alertLevel,
      openingCashFen: stressed.openingCashFen,
      closingBalanceFen: stressed.closingBalanceFen,
      optionsCount: financing.ranked.length
    };
    const { text } = await explain(provider, engineJson, templateShortage(stressed, lang), lang);

    res.json({
      status: 'OK',
      params: parsed.params,
      confidence: parsed.confidence,
      scenario: engineJson,
      answer: text,
      answerSource: 'guarded', // number-checked by explain()
      options: financing.ranked.slice(0, 3),
      disclaimer: financing.disclaimer
    });
  })
);
