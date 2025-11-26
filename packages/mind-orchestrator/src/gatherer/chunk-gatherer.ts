/**
 * Chunk Gatherer
 *
 * Gathers chunks from mind-engine for multiple sub-queries,
 * deduplicates and merges results.
 */

import type { KnowledgeChunk, KnowledgeIntent } from '@kb-labs/knowledge-contracts';
import type { AgentQueryMode } from '@kb-labs/knowledge-contracts';
import type { DecomposedQuery, GatheredChunks, OrchestratorConfig } from '../types.js';

export interface ChunkGathererOptions {
  config: OrchestratorConfig;
}

/**
 * Query function options with adaptive search weights
 */
export interface QueryFnOptions {
  text: string;
  intent?: KnowledgeIntent;
  limit?: number;
  /** Vector search weight (0-1), default 0.7 */
  vectorWeight?: number;
  /** Keyword search weight (0-1), default 0.3 */
  keywordWeight?: number;
}

export interface QueryFn {
  (options: QueryFnOptions): Promise<{
    chunks: KnowledgeChunk[];
  }>;
}

/**
 * Chunk Gatherer - collects chunks for all sub-queries
 */
export class ChunkGatherer {
  private readonly config: OrchestratorConfig;

  constructor(options: ChunkGathererOptions) {
    this.config = options.config;
  }

  /**
   * Gather chunks for decomposed query
   */
  async gather(
    decomposed: DecomposedQuery,
    mode: AgentQueryMode,
    queryFn: QueryFn,
  ): Promise<GatheredChunks> {
    const modeConfig = this.getModeConfig(mode);
    const subqueryResults = new Map<string, KnowledgeChunk[]>();
    const allChunks: KnowledgeChunk[] = [];
    let totalMatches = 0;

    // Execute sub-queries
    for (const subquery of decomposed.subqueries) {
      try {
        const result = await queryFn({
          text: subquery,
          intent: 'search',
          limit: modeConfig.chunksPerQuery,
        });

        subqueryResults.set(subquery, result.chunks);
        allChunks.push(...result.chunks);
        totalMatches += result.chunks.length;
      } catch (error) {
        // Log error but continue with other sub-queries
        console.warn(`Subquery failed: ${subquery}`, error);
        subqueryResults.set(subquery, []);
      }
    }

    // Deduplicate chunks
    const deduplicatedChunks = this.deduplicateChunks(allChunks);

    // Limit total chunks based on mode
    const limitedChunks = deduplicatedChunks.slice(0, modeConfig.maxChunks);

    return {
      chunks: limitedChunks,
      subqueryResults,
      totalMatches,
    };
  }

  /**
   * Deduplicate chunks by ID, keeping highest score
   */
  private deduplicateChunks(chunks: KnowledgeChunk[]): KnowledgeChunk[] {
    const chunkMap = new Map<string, KnowledgeChunk>();

    for (const chunk of chunks) {
      const existing = chunkMap.get(chunk.id);
      if (!existing || chunk.score > existing.score) {
        chunkMap.set(chunk.id, chunk);
      }
    }

    // Sort by score descending
    return Array.from(chunkMap.values()).sort((a, b) => b.score - a.score);
  }

  /**
   * Get mode-specific configuration
   */
  private getModeConfig(mode: AgentQueryMode) {
    switch (mode) {
      case 'instant':
        return {
          chunksPerQuery: this.config.modes.instant.maxChunks,
          maxChunks: this.config.modes.instant.maxChunks,
        };
      case 'thinking':
        return {
          chunksPerQuery: this.config.modes.thinking.chunksPerQuery,
          maxChunks: this.config.modes.thinking.chunksPerQuery * this.config.modes.thinking.maxSubqueries,
        };
      default: // auto
        return {
          chunksPerQuery: this.config.modes.auto.chunksPerQuery,
          maxChunks: this.config.modes.auto.chunksPerQuery * this.config.modes.auto.maxSubqueries,
        };
    }
  }
}

export function createChunkGatherer(options: ChunkGathererOptions): ChunkGatherer {
  return new ChunkGatherer(options);
}
