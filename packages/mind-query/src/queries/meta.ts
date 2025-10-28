/**
 * Meta query for KB Labs Mind Query
 */

import type { ProjectMeta, MetaResult } from '@kb-labs/mind-types';

export function queryMeta(
  meta: ProjectMeta | undefined,
  productId?: string
): MetaResult {
  if (!meta) {
    throw new Error('Meta index not found. Run: kb mind update');
  }
  
  let products = meta.products;
  if (productId) {
    products = products.filter(p => p.id === productId);
  }
  
  return {
    project: meta.project,
    products,
    generatedAt: meta.generatedAt
  };
}
