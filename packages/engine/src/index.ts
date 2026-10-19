/**
 * XiaoCai engine — pure, deterministic finance functions.
 *
 * Rules (non-negotiable):
 *  - No I/O: no DB, no network, no filesystem, no clock, no randomness.
 *  - No LLM calls. The AI layer explains engine output; it never produces numbers.
 *  - All money values are integers in fen (¥1 = 100).
 *
 * Phase 2 fills this package: trueProfit, profitDrivers, cashForecast,
 * applyScenario, financingMatcher, buildEvidenceTree, dailyBriefData.
 */
export const ENGINE_VERSION = '0.1.0';
