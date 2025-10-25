/**
 * Configs and profiles section builder
 */

import { estimateTokens, truncateToTokens } from '@kb-labs/mind-core';
import type { PackContext } from '../types/index.js';

/**
 * Build configs and profiles section
 */
export async function buildConfigsSection(
  context: PackContext,
  maxTokens: number
): Promise<{ content: string; tokensUsed: number }> {
  const content = '# Configuration\n\nNo configuration files found in this context.';
  const tokensUsed = estimateTokens(content);
  
  if (tokensUsed > maxTokens) {
    const truncated = truncateToTokens(content, maxTokens, context.budget.truncation);
    return { content: truncated, tokensUsed: estimateTokens(truncated) };
  }
  
  return { content, tokensUsed };
}
