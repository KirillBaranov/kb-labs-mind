/**
 * Recent diffs section builder
 */

import { estimateTokens, truncateToTokens } from '@kb-labs/mind-core';
import { sortDeterministically } from '../utils/deterministic';
import type { PackContext } from '../types/index';
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
    const sortedFiles = sortDeterministically(recentDiff.files, context.seed);
    for (const file of sortedFiles.slice(0, 20)) { // Limit to 20 files
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
