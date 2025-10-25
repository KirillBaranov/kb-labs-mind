/**
 * Recent diffs section builder
 */

import { estimateTokens, truncateToTokens } from '@kb-labs/mind-core';
import type { PackContext } from '../types/index.js';
import type { RecentDiff } from '@kb-labs/mind-core';

/**
 * Build recent diffs section
 */
export async function buildDiffsSection(
  context: PackContext,
  recentDiff: RecentDiff,
  maxTokens: number
): Promise<{ content: string; tokensUsed: number }> {
  let content = '# Recent Changes\n\n';
  
  if (recentDiff.files.length === 0) {
    content += 'No recent changes detected.\n';
  } else {
    content += `Since: ${recentDiff.since}\n\n`;
    for (const file of recentDiff.files.slice(0, 20)) { // Limit to 20 files
      content += `- ${file.status} ${file.path}\n`;
    }
  }
  
  const tokensUsed = estimateTokens(content);
  
  if (tokensUsed > maxTokens) {
    const truncated = truncateToTokens(content, maxTokens, context.budget.truncation);
    return { content: truncated, tokensUsed: estimateTokens(truncated) };
  }
  
  return { content, tokensUsed };
}
