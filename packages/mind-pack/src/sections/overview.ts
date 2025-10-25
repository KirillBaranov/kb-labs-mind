/**
 * Product overview section builder
 */

import { estimateTokens, truncateToTokens } from '@kb-labs/mind-core';
import type { PackContext } from '../types/index.js';
import type { MindIndex } from '@kb-labs/mind-core';

/**
 * Build product overview section
 */
export async function buildOverviewSection(
  context: PackContext,
  index: MindIndex,
  maxTokens: number
): Promise<{ content: string; tokensUsed: number }> {
  const product = context.product || 'unknown';
  const filesCount = index.filesIndexed || 0;
  
  const content = `# Product Overview: ${product}\n\nFiles indexed: ${filesCount}\nLast updated: ${index.updatedAt}`;
  const tokensUsed = estimateTokens(content);
  
  if (tokensUsed > maxTokens) {
    const truncated = truncateToTokens(content, maxTokens, context.budget.truncation);
    return { content: truncated, tokensUsed: estimateTokens(truncated) };
  }
  
  return { content, tokensUsed };
}
