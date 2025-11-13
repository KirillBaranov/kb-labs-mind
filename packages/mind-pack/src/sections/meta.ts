/**
 * Project metadata section builder
 */

import { estimateTokens, truncateToTokens } from '@kb-labs/mind-core';
import type { PackContext } from '../types/index.js';
import type { ProjectMeta, ProductMeta } from '@kb-labs/mind-types';

const PRODUCT_LIMIT = 5;

function formatProduct(product: ProductMeta): string {
  const lines: string[] = [];
  const description = product.description?.trim() || 'No description provided.';
  lines.push(`- ${product.name || product.id} (${product.id}) — ${description}`);

  if (product.maintainers?.length) {
    lines.push(`  Maintainers: ${product.maintainers.join(', ')}`);
  }

  if (product.tags?.length) {
    lines.push(`  Tags: ${product.tags.join(', ')}`);
  }

  if (product.dependencies?.length) {
    lines.push(`  Dependencies: ${product.dependencies.join(', ')}`);
  }

  return lines.join('\n');
}

/**
 * Build project metadata section
 */
export async function buildMetaSection(
  context: PackContext,
  meta: ProjectMeta | null,
  maxTokens: number
): Promise<{ content: string; tokensUsed: number }> {
  if (!meta) {
    const fallback = '# Project Metadata\n\nNo metadata available. Run `kb mind update` to generate meta index.';
    return { content: fallback, tokensUsed: estimateTokens(fallback) };
  }

  const lines: string[] = [];
  lines.push('# Project Metadata');
  lines.push('');
  lines.push(`Project: ${meta.project || 'unknown'}`);
  if (meta.generatedAt) {
    lines.push(`Generated: ${meta.generatedAt}`);
  }
  lines.push('');

  const products = meta.products ?? [];
  if (products.length === 0) {
    lines.push('No products registered in metadata.');
  } else {
    lines.push(`## Products (${products.length})`);
    const limited = products.slice(0, PRODUCT_LIMIT);
    for (const product of limited) {
      lines.push(formatProduct(product));
    }
    if (products.length > PRODUCT_LIMIT) {
      lines.push('');
      lines.push(`_… ${products.length - PRODUCT_LIMIT} more products omitted for brevity._`);
    }
  }

  const content = lines.join('\n');
  const tokensUsed = estimateTokens(content);

  if (tokensUsed > maxTokens) {
    const truncated = truncateToTokens(content, maxTokens, context.budget.truncation);
    return { content: truncated, tokensUsed: estimateTokens(truncated) };
  }

  return { content, tokensUsed };
}

