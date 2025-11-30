/**
 * Intent summary section builder
 */

import { estimateTokens, truncateToTokens } from '@kb-labs/mind-core';
import type { PackContext } from '../types/index';

/**
 * Build intent summary section
 */
export async function buildIntentSection(
  context: PackContext,
  maxTokens: number
): Promise<{ content: string; tokensUsed: number }> {
  const content = `# Intent: ${context.intent}\n\nThis context pack provides information to help implement: ${context.intent}`;
  const tokensUsed = estimateTokens(content);
  
  if (tokensUsed > maxTokens) {
    const truncated = truncateToTokens(content, maxTokens, context.budget.truncation);
    return { content: truncated, tokensUsed: estimateTokens(truncated) };
  }
  
  return { content, tokensUsed };
}
