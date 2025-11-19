/**
 * @module @kb-labs/mind-llm/openai
 * OpenAI LLM engine implementation
 */

import OpenAI from 'openai';
import type {
  MindLLMEngine,
  MindLLMGenerateOptions,
  MindLLMGenerateResult,
} from './index.js';

export interface OpenAILLMEngineOptions {
  /**
   * OpenAI API key (required)
   */
  apiKey: string;

  /**
   * Model to use
   * Default: 'gpt-4o-mini' (cheap and fast)
   */
  model?: string;

  /**
   * Base URL for API (optional, for custom endpoints)
   */
  baseURL?: string;

  /**
   * Maximum retries for API calls
   * Default: 3
   */
  maxRetries?: number;

  /**
   * Timeout in milliseconds
   * Default: 30000 (30 seconds)
   */
  timeout?: number;
}

/**
 * Create OpenAI LLM engine
 */
export function createOpenAILLMEngine(
  options: OpenAILLMEngineOptions,
): MindLLMEngine {
  const {
    apiKey,
    model = 'gpt-4o-mini',
    baseURL,
    maxRetries = 3,
    timeout = 30000,
  } = options;

  const client = new OpenAI({
    apiKey,
    baseURL,
    maxRetries,
    timeout,
  });

  return {
    id: 'openai',
    description: `OpenAI LLM engine (${model})`,
    async generate(
      prompt: string,
      generateOptions?: MindLLMGenerateOptions,
    ): Promise<MindLLMGenerateResult> {
      try {
        const response = await client.chat.completions.create({
          model,
          messages: [
            {
              role: 'user',
              content: prompt,
            },
          ],
          max_tokens: generateOptions?.maxTokens ?? 512,
          temperature: generateOptions?.temperature ?? 0.3, // Lower temperature for compression/summarization
          stop: generateOptions?.stop,
        });

        const choice = response.choices[0];
        if (!choice) {
          throw new Error('No response from OpenAI');
        }

        const text = choice.message.content ?? '';
        const finishReason = choice.finish_reason === 'length' ? 'length' : 'stop';

        // Estimate tokens (rough approximation)
        const tokens = Math.ceil(text.length / 4);

        return {
          text,
          tokens,
          finishReason,
          metadata: {
            ...generateOptions?.metadata,
            model: response.model,
            usage: response.usage,
          },
        };
      } catch (error) {
        throw new Error(
          `OpenAI LLM generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        );
      }
    },
  };
}

