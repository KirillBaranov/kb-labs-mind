/**
 * LLM Provider Interface
 *
 * Pluggable LLM abstraction for orchestrator operations.
 * Extends ILLM with JSON structured output support.
 */

import type { ILLM, LLMResponse } from '@kb-labs/sdk';

export interface LLMCompleteOptions {
  prompt: string;
  systemPrompt?: string;
  maxTokens?: number;
  temperature?: number;
  stop?: string[];
}

export interface LLMJSONOptions<T> {
  prompt: string;
  systemPrompt?: string;
  maxTokens?: number;
  temperature?: number;
  schema?: {
    name: string;
    description?: string;
    strict?: boolean;
  };
}

export interface LLMStats {
  calls: number;
  tokensIn: number;
  tokensOut: number;
}

/**
 * Extended LLM Provider with JSON support
 */
export interface LLMProvider {
  readonly name: string;

  /**
   * Generate text completion
   */
  complete(options: LLMCompleteOptions): Promise<string>;

  /**
   * Generate JSON structured output
   * Uses OpenAI JSON mode or similar
   */
  completeJSON<T>(options: LLMJSONOptions<T>): Promise<T>;

  /**
   * Get accumulated stats
   */
  getStats(): LLMStats;

  /**
   * Reset stats
   */
  resetStats(): void;
}

/**
 * Create LLM provider from ILLM
 */
export function createLLMProvider(llm: ILLM): LLMProvider {
  let stats: LLMStats = { calls: 0, tokensIn: 0, tokensOut: 0 };

  return {
    name: 'llm-provider',

    async complete(options: LLMCompleteOptions): Promise<string> {
      // Pass system prompt separately (NOT concatenated) for OpenAI prompt caching
      const inputTokens = Math.ceil(
        ((options.systemPrompt?.length ?? 0) + options.prompt.length) / 4
      );
      stats.tokensIn += inputTokens;
      stats.calls++;

      const result = await llm.complete(options.prompt, {
        systemPrompt: options.systemPrompt,
        maxTokens: options.maxTokens ?? 1024,
        temperature: options.temperature ?? 0.2,
        stop: options.stop,
      });

      stats.tokensOut += result.usage.completionTokens;
      return result.content;
    },

    async completeJSON<T>(options: LLMJSONOptions<T>): Promise<T> {
      const jsonInstructions = `
IMPORTANT: Respond with valid JSON only. No markdown, no code blocks, just raw JSON.
Do not include any text before or after the JSON object.
`;

      // Append JSON instructions to system prompt (still cacheable!)
      const systemPrompt = options.systemPrompt
        ? `${options.systemPrompt}\n\n${jsonInstructions}`
        : jsonInstructions;

      // Estimate input tokens
      const inputTokens = Math.ceil(
        (systemPrompt.length + options.prompt.length) / 4
      );
      stats.tokensIn += inputTokens;
      stats.calls++;

      const result = await llm.complete(options.prompt, {
        systemPrompt,
        maxTokens: options.maxTokens ?? 2048,
        temperature: options.temperature ?? 0.1, // Lower for JSON
      });

      stats.tokensOut += result.usage.completionTokens;

      // Parse JSON from response
      const text = result.content.trim();
      try {
        // Try direct parse first
        return JSON.parse(text) as T;
      } catch {
        // Try to extract JSON from markdown code block
        const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
        if (jsonMatch && jsonMatch[1]) {
          return JSON.parse(jsonMatch[1].trim()) as T;
        }

        // Try to find JSON object in text
        const objectMatch = text.match(/\{[\s\S]*\}/);
        if (objectMatch) {
          return JSON.parse(objectMatch[0]) as T;
        }

        throw new Error(`Failed to parse JSON from LLM response: ${text.slice(0, 200)}...`);
      }
    },

    getStats(): LLMStats {
      return { ...stats };
    },

    resetStats(): void {
      stats = { calls: 0, tokensIn: 0, tokensOut: 0 };
    },
  };
}
