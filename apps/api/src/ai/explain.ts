import type { LlmProvider } from './provider';
import { tryComplete } from './provider';
import { allNumbersFromEngine } from './numbers';
import { logger } from '../lib/logger';

/**
 * explain(): the LLM receives ONLY the engine's JSON and writes 2–4 sentences.
 * Post-check: every number in the reply must be traceable to that JSON
 * (numbers.ts) — otherwise the reply is discarded and the template is used.
 * The engine wins, always. Events where the guard fires are logged.
 */

export async function explain(
  provider: LlmProvider,
  engineJson: unknown,
  template: string,
  lang: 'en' | 'zh'
): Promise<{ text: string; source: 'llm' | 'template' }> {
  if (provider.name === 'noop') {
    return { text: template, source: 'template' };
  }
  const text = await tryComplete(provider, {
    system:
      lang === 'zh'
        ? '你是一位面向中国小微企业主的财务助手。只用引擎给出的 JSON 写 2–4 句简短解释。每个数字都必须原样来自 JSON——绝对不要计算、换算或编造任何数字。不要使用列表或标题。'
        : 'You are a finance assistant for small-business owners. Write a 2–4 sentence explanation using ONLY the engine JSON provided. Every number must come verbatim from the JSON — never compute, convert, or invent numbers. No lists, no headings.',
    user: `Engine JSON:\n${JSON.stringify(engineJson)}`,
    maxTokens: 400
  });
  if (text === null || text.trim() === '') {
    return { text: template, source: 'template' };
  }
  if (!allNumbersFromEngine(text, engineJson)) {
    logger.warn({ preview: text.slice(0, 120) }, 'LLM explanation rejected — contained numbers not present in engine JSON');
    return { text: template, source: 'template' };
  }
  return { text: text.trim(), source: 'llm' };
}
