/**
 * @module @kb-labs/mind-engine/search/adaptive-hybrid
 * Adaptive hybrid search with query classification and source boosting
 */

import type {
  EmbeddingVector,
  StoredMindChunk,
  VectorSearchFilters,
  VectorSearchMatch,
} from '../vector-store/vector-store.js';
import { hybridSearch, type HybridSearchOptions } from './hybrid.js';
import { keywordSearch } from './keyword.js';
import { classifyQuery, extractIdentifiers, type QueryClassification } from './query-classifier.js';
import {
  categorizeMatches,
  applyQueryBoost,
  type CategorizedMatch,
} from './source-categorizer.js';

export interface AdaptiveHybridSearchOptions extends HybridSearchOptions {
  /**
   * Enable adaptive weights based on query classification
   * Default: true
   */
  adaptiveWeights?: boolean;

  /**
   * Enable source-type boosting
   * Default: true
   */
  sourceBoost?: boolean;

  /**
   * Force specific weights (overrides adaptive)
   */
  forceWeights?: {
    vector: number;
    keyword: number;
  };
}

export interface AdaptiveSearchResult {
  matches: VectorSearchMatch[];
  classification: QueryClassification;
  usedWeights: { vector: number; keyword: number };
  identifiers: string[];
}

/**
 * Adaptive hybrid search with query classification
 */
export async function adaptiveHybridSearch(
  vectorSearch: (
    scopeId: string,
    vector: EmbeddingVector,
    limit: number,
    filters?: VectorSearchFilters,
  ) => Promise<VectorSearchMatch[]>,
  scopeId: string,
  queryVector: EmbeddingVector,
  queryText: string,
  allChunks: StoredMindChunk[],
  limit: number,
  filters?: VectorSearchFilters,
  options: AdaptiveHybridSearchOptions = {},
): Promise<AdaptiveSearchResult> {
  const {
    adaptiveWeights = true,
    sourceBoost = true,
    forceWeights,
    ...hybridOptions
  } = options;

  // Classify query
  const classification = classifyQuery(queryText);
  const identifiers = extractIdentifiers(queryText);

  // Determine weights
  let usedWeights: { vector: number; keyword: number };

  if (forceWeights) {
    usedWeights = forceWeights;
  } else if (adaptiveWeights) {
    usedWeights = classification.weights;
  } else {
    usedWeights = { vector: 0.7, keyword: 0.3 };
  }

  // Run hybrid search with adaptive weights
  const searchOptions: HybridSearchOptions = {
    ...hybridOptions,
    vectorWeight: usedWeights.vector,
    keywordWeight: usedWeights.keyword,
  };

  // Use suggested limit from classification if not overridden
  const effectiveLimit = options.candidateLimit
    ? limit
    : Math.max(limit, classification.suggestedLimit);

  let matches = await hybridSearch(
    vectorSearch,
    keywordSearch,
    scopeId,
    queryVector,
    queryText,
    allChunks,
    effectiveLimit,
    filters,
    searchOptions,
  );

  // Apply source-type boosting if enabled
  if (sourceBoost && matches.length > 0) {
    const categorized = categorizeMatches(matches);
    const boosted = applyQueryBoost(categorized, queryText);

    // Re-sort by boosted scores
    boosted.sort((a, b) => b.score - a.score);

    // Convert back to VectorSearchMatch
    matches = boosted.slice(0, limit).map(m => ({
      chunk: m.chunk,
      score: m.score,
    }));
  }

  // Boost results containing exact identifiers
  if (identifiers.length > 0) {
    matches = boostExactIdentifiers(matches, identifiers);
  }

  return {
    matches: matches.slice(0, limit),
    classification,
    usedWeights,
    identifiers,
  };
}

/**
 * Boost matches that contain exact identifiers from query
 */
function boostExactIdentifiers(
  matches: VectorSearchMatch[],
  identifiers: string[],
): VectorSearchMatch[] {
  return matches
    .map(match => {
      const text = match.chunk.text;
      const path = match.chunk.path;

      // Count how many identifiers appear in this chunk
      const identifierMatches = identifiers.filter(id => {
        const lowerText = text.toLowerCase();
        const lowerId = id.toLowerCase();
        return (
          lowerText.includes(lowerId) ||
          path.toLowerCase().includes(lowerId)
        );
      });

      // Boost score based on identifier matches
      const boostFactor = 1 + identifierMatches.length * 0.15;

      return {
        chunk: match.chunk,
        score: match.score * boostFactor,
      };
    })
    .sort((a, b) => b.score - a.score);
}

/**
 * Quick helper to get just matches (for simpler API)
 */
export async function adaptiveSearch(
  vectorSearch: (
    scopeId: string,
    vector: EmbeddingVector,
    limit: number,
    filters?: VectorSearchFilters,
  ) => Promise<VectorSearchMatch[]>,
  scopeId: string,
  queryVector: EmbeddingVector,
  queryText: string,
  allChunks: StoredMindChunk[],
  limit: number,
  filters?: VectorSearchFilters,
  options?: AdaptiveHybridSearchOptions,
): Promise<VectorSearchMatch[]> {
  const result = await adaptiveHybridSearch(
    vectorSearch,
    scopeId,
    queryVector,
    queryText,
    allChunks,
    limit,
    filters,
    options,
  );
  return result.matches;
}
