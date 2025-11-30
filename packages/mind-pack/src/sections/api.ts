/**
 * API signatures section builder
 */

import { estimateTokens, truncateToTokens } from '@kb-labs/mind-core';
import { sortEntriesDeterministically } from '../utils/deterministic';
import type { PackContext } from '../types/index';
import type { ApiIndex } from '@kb-labs/mind-core';

/**
 * Build API signatures section
 */
export async function buildApiSection(
  context: PackContext,
  apiIndex: ApiIndex,
  maxTokens: number
): Promise<{ content: string; tokensUsed: number }> {
  const files = Object.entries(apiIndex.files);
  const sortedFiles = sortEntriesDeterministically(files, context.seed);
  let content = '# API Signatures\n\n';
  
  for (const [filePath, file] of sortedFiles.slice(0, 10)) { // Limit to 10 files
    content += `## ${filePath}\n`;
    const sortedExports = sortEntriesDeterministically(
      file.exports.map(exp => [exp.name, exp] as [string, any]), 
      context.seed
    );
    for (const [, export_] of sortedExports.slice(0, 5)) { // Limit to 5 exports per file
      content += `- ${export_.name} (${export_.kind})`;
      if (export_.signature) {
        content += `: ${export_.signature}`;
      }
      content += '\n';
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
