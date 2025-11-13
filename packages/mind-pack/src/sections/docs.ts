/**
 * Documentation overview section builder
 */

import { estimateTokens, truncateToTokens } from '@kb-labs/mind-core';
import type { PackContext } from '../types/index.js';
import type { DocsIndex, DocEntry } from '@kb-labs/mind-types';

const DOC_LIMIT = 8;

function formatDocEntry(entry: DocEntry, index: number): string {
  const tags = entry.tags?.length ? ` [tags: ${entry.tags.join(', ')}]` : '';
  const summary = entry.summary?.trim() || 'No summary available.';
  return `${index + 1}. ${entry.title} (${entry.type})${tags}\n   Path: ${entry.path}\n   ${summary}`;
}

/**
 * Build docs overview section
 */
export async function buildDocsSection(
  context: PackContext,
  docsIndex: DocsIndex | null,
  maxTokens: number
): Promise<{ content: string; tokensUsed: number }> {
  if (!docsIndex || !docsIndex.docs?.length) {
    const fallback = '# Documentation Overview\n\nNo documentation entries found in the current workspace.';
    return { content: fallback, tokensUsed: estimateTokens(fallback) };
  }

  const docs = docsIndex.docs;
  const lines: string[] = [];
  lines.push('# Documentation Overview');
  lines.push('');
  lines.push(`Total docs indexed: ${docsIndex.count ?? docs.length}`);
  lines.push('');

  const limited = docs.slice(0, DOC_LIMIT);
  limited.forEach((entry, idx) => lines.push(formatDocEntry(entry, idx)));

  if (docs.length > DOC_LIMIT) {
    lines.push('');
    lines.push(`_… ${docs.length - DOC_LIMIT} more docs available in the index._`);
  }

  const content = lines.join('\n');
  const tokensUsed = estimateTokens(content);

  if (tokensUsed > maxTokens) {
    const truncated = truncateToTokens(content, maxTokens, context.budget.truncation);
    return { content: truncated, tokensUsed: estimateTokens(truncated) };
  }

  return { content, tokensUsed };
}

