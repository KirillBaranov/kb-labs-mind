/**
 * Implementation snippets section builder
 */

import { estimateTokens, truncateToTokens, MAX_SNIPPET_LINES } from '@kb-labs/mind-core';
import type { PackContext } from '../types/index.js';
import type { ApiIndex } from '@kb-labs/mind-core';

/**
 * Build implementation snippets section
 */
export async function buildSnippetsSection(
  context: PackContext,
  apiIndex: ApiIndex,
  maxTokens: number
): Promise<{ content: string; tokensUsed: number }> {
  let content = '# Implementation Snippets\n\n';
  
  const files = Object.entries(apiIndex.files);
  for (const [filePath, file] of files.slice(0, 5)) { // Limit to 5 files
    content += `## ${filePath}\n`;
    content += `Size: ${file.size} bytes\n`;
    content += `Exports: ${file.exports.length}\n\n`;
    
    // Add some sample exports
    for (const export_ of file.exports.slice(0, 3)) {
      content += `### ${export_.name}\n`;
      if (export_.jsdoc) {
        content += `${export_.jsdoc}\n\n`;
      }
    }
    content += '\n';
  }
  
  const tokensUsed = estimateTokens(content);
  
  if (tokensUsed > maxTokens) {
    const truncated = truncateToTokens(content, maxTokens, context.budget.truncation);
    return { content: truncated, tokensUsed: estimateTokens(truncated) };
  }
  
  return { content, tokensUsed };
}
