/**
 * @module @kb-labs/mind-engine/search
 * Search module exports
 */

// Hybrid search
export { hybridSearch, type HybridSearchOptions } from './hybrid';

// Keyword search (BM25)
export { keywordSearch, type KeywordSearchOptions } from './keyword';

// Query classification
export {
  classifyQuery,
  hasExactIdentifier,
  extractIdentifiers,
  detectLanguage,
  type QueryType,
  type QueryClassification,
} from './query-classifier';

// Source categorization
export {
  categorizeFile,
  categorizeMatches,
  applyQueryBoost,
  groupByCategory,
  getCategoryStats,
  type SourceCategory,
  type CategorizedMatch,
} from './source-categorizer';

// Adaptive hybrid search
export {
  adaptiveHybridSearch,
  adaptiveSearch,
  type AdaptiveHybridSearchOptions,
  type AdaptiveSearchResult,
} from './adaptive-hybrid';
