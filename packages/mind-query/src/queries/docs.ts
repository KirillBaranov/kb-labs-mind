/**
 * Docs query for KB Labs Mind Query
 */

import type { DocsIndex, DocsResult } from '@kb-labs/mind-types';

export function queryDocs(
  docsIndex: DocsIndex | undefined,
  filter?: { tag?: string; type?: string; search?: string }
): DocsResult {
  if (!docsIndex) {
    return { docs: [], count: 0 };
  }
  
  let docs = docsIndex.docs;
  
  if (filter?.tag) {
    docs = docs.filter(d => d.tags.includes(filter.tag!));
  }
  
  if (filter?.type) {
    docs = docs.filter(d => d.type === filter.type);
  }
  
  if (filter?.search) {
    const term = filter.search.toLowerCase();
    docs = docs.filter(d => 
      d.title.toLowerCase().includes(term) ||
      d.summary.toLowerCase().includes(term)
    );
  }
  
  return { docs, count: docs.length };
}
