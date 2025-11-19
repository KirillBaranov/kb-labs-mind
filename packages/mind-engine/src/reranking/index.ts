/**
 * @module @kb-labs/mind-engine/reranking
 * Re-ranking system for improving search result relevance
 */

export type {
  Reranker,
  RerankingOptions,
  CrossEncoderRerankerOptions,
} from './reranker.js';

export { CrossEncoderReranker, HeuristicReranker } from './reranker.js';

import type { RuntimeAdapter } from '../adapters/runtime-adapter.js';
import { CrossEncoderReranker } from './reranker.js';
import { HeuristicReranker } from './reranker.js';
import type { Reranker } from './reranker.js';

export type RerankerType = 'cross-encoder' | 'heuristic' | 'none';

export interface RerankerConfig {
  type?: RerankerType;
  crossEncoder?: {
    endpoint?: string;
    apiKey?: string;
    model?: string;
    batchSize?: number;
    timeout?: number;
  };
}

/**
 * Create a reranker instance based on configuration
 */
export function createReranker(
  config: RerankerConfig,
  runtime: RuntimeAdapter,
): Reranker | null {
  const type = config.type ?? 'none';

  if (type === 'none') {
    return null;
  }

  if (type === 'heuristic') {
    return new HeuristicReranker();
  }

  if (type === 'cross-encoder') {
    return new CrossEncoderReranker({
      endpoint: config.crossEncoder?.endpoint,
      apiKey: config.crossEncoder?.apiKey,
      model: config.crossEncoder?.model,
      batchSize: config.crossEncoder?.batchSize,
      timeout: config.crossEncoder?.timeout,
      runtime,
    });
  }

  throw new Error(`Unknown reranker type: ${type}`);
}






