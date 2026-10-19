import Anthropic from '@anthropic-ai/sdk';
import { env } from '../config/env';
import { logger } from '../lib/logger';

/**
 * LLM provider abstraction — the AI layer is OPTIONAL.
 * With no ANTHROPIC_API_KEY (or on any provider failure), callers fall back to
 * deterministic templates. The AI NEVER creates numbers: it only parses
 * questions into scenario params and writes explanations over engine JSON that
 * is post-validated number-by-number (see explain.ts).
 */
export interface LlmProvider {
  readonly name: 'claude' | 'noop';
  complete(req: { system: string; user: string; maxTokens?: number }): Promise<string>;
}

export class NoopProvider implements LlmProvider {
  readonly name = 'noop' as const;
  async complete(_req: { system: string; user: string; maxTokens?: number }): Promise<string> {
    return '';
  }
}

const MODEL = 'claude-opus-4-8';

export class ClaudeProvider implements LlmProvider {
  readonly name = 'claude' as const;
  private client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY, timeout: 30_000, maxRetries: 1 });

  async complete(req: { system: string; user: string; maxTokens?: number }): Promise<string> {
    const response = await this.client.messages.create({
      model: MODEL,
      max_tokens: req.maxTokens ?? 1024,
      system: req.system,
      messages: [{ role: 'user', content: req.user }]
    });
    for (const block of response.content) {
      if (block.type === 'text') return block.text;
    }
    return '';
  }
}

export function getLlmProvider(): LlmProvider {
  if (env.ANTHROPIC_API_KEY && env.ANTHROPIC_API_KEY.trim() !== '') {
    return new ClaudeProvider();
  }
  return new NoopProvider();
}

/** Never let an LLM failure break the request — callers must catch. */
export async function tryComplete(provider: LlmProvider, req: { system: string; user: string; maxTokens?: number }): Promise<string | null> {
  if (provider.name === 'noop') return null;
  try {
    return await provider.complete(req);
  } catch (err) {
    logger.warn({ err, provider: provider.name }, 'LLM call failed — falling back to template');
    return null;
  }
}
