import path from 'node:path';
import fs from 'fs-extra';
import fg from 'fast-glob';
// @ts-expect-error - picomatch doesn't have types
import picomatch from 'picomatch';
import { createHash } from 'node:crypto';
import { getChunkerForFile, type Chunk } from './chunking/index.js';
import type {
  KnowledgeChunk,
  KnowledgeEngineConfig,
  KnowledgeQuery,
  KnowledgeScope,
  KnowledgeSource,
  SpanRange,
} from '@kb-labs/knowledge-contracts';
import {
  createKnowledgeError,
  type KnowledgeEngine,
  type KnowledgeEngineFactory,
  type KnowledgeEngineFactoryContext,
  type KnowledgeEngineRegistry,
  type KnowledgeExecutionContext,
  type KnowledgeIndexOptions,
} from '@kb-labs/knowledge-core';
import {
  createDeterministicEmbeddingProvider,
  createEmbeddingProvider,
  type EmbeddingProvider,
  type EmbeddingProviderConfig,
  type EmbeddingRuntimeAdapter,
} from '@kb-labs/mind-embeddings';
import {
  createLocalStubLLMEngine,
  type MindLLMEngine,
} from '@kb-labs/mind-llm';
import {
  MindVectorStore,
  type MindVectorStoreOptions,
  type VectorSearchFilters,
  type VectorSearchMatch,
} from '@kb-labs/mind-vector-store';
import type { RuntimeAdapter } from './adapters/runtime-adapter.js';
import { createRuntimeAdapter } from './adapters/runtime-adapter.js';
import { createVectorStore, type VectorStoreConfig } from './vector-store/index.js';
import type { VectorStore } from './vector-store/vector-store.js';
import type { StoredMindChunk } from './vector-store/vector-store.js';
import { hybridSearch } from './search/hybrid.js';
import { keywordSearch } from './search/keyword.js';
import { createReranker, type RerankerConfig } from './reranking/index.js';
import type { Reranker } from './reranking/reranker.js';
import { ContextOptimizer, type ContextOptimizationOptions } from './optimization/index.js';
import {
  type QueryHistoryStore,
  QdrantQueryHistoryStore,
  MemoryQueryHistoryStore,
  type QueryHistoryEntry,
} from './learning/query-history.js';
import {
  type FeedbackStore,
  QdrantFeedbackStore,
  MemoryFeedbackStore,
  SelfFeedbackGenerator,
  type FeedbackEntry,
} from './learning/feedback.js';
import {
  PopularityBoostCalculator,
  type PopularityBoost,
} from './learning/popularity.js';
import {
  QueryPatternMatcher,
  applyPatternBoost,
  type QueryPatternMatcher as IQueryPatternMatcher,
} from './learning/query-patterns.js';
import {
  AdaptiveWeightCalculator,
  type AdaptiveWeights,
} from './learning/adaptive-weights.js';

const DEFAULT_INDEX_DIR = '.kb/mind/rag';
const DEFAULT_CODE_CHUNK_LINES = 120;
const DEFAULT_DOC_CHUNK_LINES = 80;
const DEFAULT_CHUNK_OVERLAP = 20;

export interface MindEngineChunkOptions {
  codeLines?: number;
  docLines?: number;
  overlap?: number;
}

export interface MindEngineEmbeddingOptions {
  type?: 'auto' | 'openai' | 'local' | 'deterministic';
  dimension?: number;
  provider?: EmbeddingProviderConfig['provider'];
}

export interface MindEngineVectorStoreOptions {
  type?: 'auto' | 'local' | 'qdrant';
  local?: VectorStoreConfig['local'];
  qdrant?: VectorStoreConfig['qdrant'];
}

export interface MindEngineSearchOptions {
  /**
   * Enable hybrid search (vector + keyword)
   * Default: false (vector only)
   */
  hybrid?: boolean;

  /**
   * Weight for vector search in hybrid mode (0-1)
   * Default: 0.7
   */
  vectorWeight?: number;

  /**
   * Weight for keyword search in hybrid mode (0-1)
   * Default: 0.3
   */
  keywordWeight?: number;

  /**
   * RRF constant for hybrid search
   * Default: 60
   */
  rrfK?: number;

  /**
   * Re-ranking configuration
   */
  reranking?: {
    /**
     * Re-ranker type: 'cross-encoder' | 'heuristic' | 'none'
     * Default: 'none'
     */
    type?: 'cross-encoder' | 'heuristic' | 'none';

    /**
     * Cross-encoder options (when type is 'cross-encoder')
     */
    crossEncoder?: {
      endpoint?: string;
      apiKey?: string;
      model?: string;
      batchSize?: number;
      timeout?: number;
    };

    /**
     * Top-K candidates to re-rank
     * Default: 20
     */
    topK?: number;

    /**
     * Minimum score threshold
     * Default: 0
     */
    minScore?: number;
  };

  /**
   * Self-learning configuration
   */
  learning?: {
    /**
     * Enable self-learning features
     * Default: false
     */
    enabled?: boolean;

    /**
     * Store query history
     * Default: true (when learning enabled)
     */
    queryHistory?: boolean;

    /**
     * Enable feedback collection (implicit + self-feedback)
     * Default: true (when learning enabled)
     */
    feedback?: boolean;

    /**
     * Enable popularity boost
     * Default: true (when learning enabled)
     */
    popularityBoost?: boolean;

    /**
     * Enable query pattern learning
     * Default: true (when learning enabled)
     */
    queryPatterns?: boolean;

    /**
     * Enable adaptive weights
     * Default: false (requires more data)
     */
    adaptiveWeights?: boolean;

    /**
     * Use persistent storage (Qdrant) or memory
     * Default: 'auto' (uses Qdrant if available, otherwise memory)
     */
    storage?: 'qdrant' | 'memory' | 'auto';
  };

  /**
   * Context optimization configuration
   */
  optimization?: {
    /**
     * Enable deduplication
     * Default: true
     */
    deduplication?: boolean;

    /**
     * Similarity threshold for deduplication (0-1)
     * Default: 0.9
     */
    deduplicationThreshold?: number;

    /**
     * Enable diversification
     * Default: true
     */
    diversification?: boolean;

    /**
     * Diversity threshold (0-1)
     * Default: 0.3
     */
    diversityThreshold?: number;

    /**
     * Maximum chunks per file
     * Default: 3
     */
    maxChunksPerFile?: number;

    /**
     * Enable adaptive selection based on token budget
     * Default: false
     */
    adaptiveSelection?: boolean;

    /**
     * Average tokens per chunk (for estimation)
     * Default: 200
     */
    avgTokensPerChunk?: number;

    /**
     * Compression configuration for token optimization
     */
    compression?: {
      /**
       * Enable compression features
       * Default: false
       */
      enabled?: boolean;

      /**
       * Cache strategy for compressed chunks
       * 'memory' - in-memory cache for the duration of a query
       * 'qdrant' - persistent storage in Qdrant (future)
       * 'both' - use both (future)
       * Default: 'memory'
       */
      cache?: 'memory' | 'qdrant' | 'both';

      /**
       * Smart truncation configuration
       */
      smartTruncation?: {
        /**
         * Enable smart truncation with context preservation
         * Default: true (when compression enabled)
         */
        enabled?: boolean;

        /**
         * Maximum length for chunks before truncation
         * Default: 2000 characters
         */
        maxLength?: number;

        /**
         * Preserve code structure (function signatures, types, etc.)
         * Default: true
         */
        preserveStructure?: boolean;
      };

      /**
       * Metadata-only mode for low-score chunks
       */
      metadataOnly?: {
        /**
         * Enable metadata-only mode
         * Default: true (when compression enabled)
         */
        enabled?: boolean;

        /**
         * Score threshold below which chunks are shown as metadata-only
         * Default: 0.4
         */
        scoreThreshold?: number;
      };

      /**
       * LLM compression configuration (future)
       */
      llm?: {
        /**
         * Enable LLM-based compression
         * Default: false (not implemented yet)
         */
        enabled?: boolean;

        /**
         * LLM model to use for compression
         */
        model?: string;

        /**
         * Maximum tokens for compressed output
         */
        maxTokens?: number;
      };
    };
  };
}

export interface MindEngineOptions {
  indexDir?: string;
  chunk?: MindEngineChunkOptions;
  embedding?: MindEngineEmbeddingOptions;
  vectorStore?: MindEngineVectorStoreOptions;
  search?: MindEngineSearchOptions;
  learning?: MindEngineSearchOptions['learning'];
  llmEngineId?: string;
  /**
   * Runtime adapter for sandbox Runtime API
   * Passed through options to avoid changing knowledge-core interfaces
   * @internal
   */
  _runtime?: RuntimeAdapter | {
    fetch?: (input: string | { url: string } | { href: string }, init?: {
      method?: string;
      headers?: Record<string, string>;
      body?: string;
      signal?: { aborted: boolean } | null;
      [key: string]: unknown;
    }) => Promise<{
      ok: boolean;
      status: number;
      text(): Promise<string>;
      json(): Promise<unknown>;
      [key: string]: unknown;
    }>;
    fs?: any;
    env?: (key: string) => string | undefined;
    log?: (
      level: 'debug' | 'info' | 'warn' | 'error',
      msg: string,
      meta?: Record<string, unknown>,
    ) => void;
    analytics?: {
      track(event: string, properties?: Record<string, unknown>): void;
      metric(name: string, value: number, tags?: Record<string, string>): void;
    };
  };
}

interface NormalizedOptions {
  indexDir: string;
  chunk: Required<MindEngineChunkOptions>;
  search: {
    hybrid: boolean;
    vectorWeight: number;
    keywordWeight: number;
    rrfK: number;
    reranking: {
      enabled: boolean;
      type: 'cross-encoder' | 'heuristic' | 'none';
      topK: number;
      minScore: number;
      config?: RerankerConfig;
    };
    optimization: {
      enabled: boolean;
      deduplication: boolean;
      deduplicationThreshold: number;
      diversification: boolean;
      diversityThreshold: number;
      maxChunksPerFile: number;
      adaptiveSelection: boolean;
      avgTokensPerChunk: number;
      compression: {
        enabled: boolean;
        cache: 'memory' | 'qdrant' | 'both';
        smartTruncation: {
          enabled: boolean;
          maxLength: number;
          preserveStructure: boolean;
        };
        metadataOnly: {
          enabled: boolean;
          scoreThreshold: number;
        };
        llm: {
          enabled: boolean;
          model?: string;
          maxTokens?: number;
        };
      };
    };
  };
  learning: {
    enabled: boolean;
    queryHistory: boolean;
    feedback: boolean;
    popularityBoost: boolean;
    queryPatterns: boolean;
    adaptiveWeights: boolean;
    storage: 'qdrant' | 'memory' | 'auto';
  };
}

interface MindChunk {
  chunkId: string;
  sourceId: string;
  path: string;
  span: SpanRange;
  text: string;
  metadata?: Record<string, unknown>;
}

export class MindKnowledgeEngine implements KnowledgeEngine {
  readonly id: string;
  readonly type = 'mind';
  private readonly workspaceRoot: string;
  private readonly options: NormalizedOptions;
  private readonly vectorStore: VectorStore;
  private embeddingProvider: EmbeddingProvider;
  private readonly llmEngine: MindLLMEngine;
  private readonly runtime: RuntimeAdapter;
  private readonly reranker: Reranker | null;
  private readonly contextOptimizer: ContextOptimizer;
  
  // Self-learning components
  private readonly queryHistory: QueryHistoryStore | null;
  private readonly feedbackStore: FeedbackStore | null;
  private readonly popularityBoost: PopularityBoost | null;
  private readonly queryPatternMatcher: IQueryPatternMatcher | null;
  private readonly adaptiveWeights: AdaptiveWeights | null;
  private readonly selfFeedbackGenerator: SelfFeedbackGenerator | null;

  constructor(
    config: KnowledgeEngineConfig,
    context: KnowledgeEngineFactoryContext,
  ) {
    this.id = config.id;
    this.workspaceRoot = context.workspaceRoot ?? (typeof process !== 'undefined' && process.cwd ? process.cwd() : '/');
    const rawOptions = (config.options ?? {}) as MindEngineOptions;
    this.options = normalizeOptions(rawOptions);
    
    // Extract runtime adapter from options (passed through from handlers)
    const runtimeInput = rawOptions._runtime;
    this.runtime = runtimeInput && 'fetch' in runtimeInput && typeof runtimeInput.fetch === 'function'
      ? runtimeInput as RuntimeAdapter
      : createRuntimeAdapter(runtimeInput as any);
    
    // Determine embedding dimension based on provider config
    // Deterministic provider uses 384, OpenAI uses 1536
    const embeddingConfig: EmbeddingProviderConfig = rawOptions.embedding
      ? {
          type: rawOptions.embedding.type,
          provider: rawOptions.embedding.provider,
        }
      : { type: 'auto' };
    
    // Infer dimension from config: deterministic = 384, openai = 1536, default = 1536
    // When type is 'auto', check if OpenAI API key is available to determine dimension
    let embeddingDimension = 1536; // Default
    if (embeddingConfig.type === 'deterministic') {
      embeddingDimension = 384;
    } else if (embeddingConfig.type === 'openai') {
      embeddingDimension = 1536;
    } else if (embeddingConfig.type === 'auto') {
      // Auto mode: use deterministic (384) if no OpenAI API key, otherwise OpenAI (1536)
      const hasOpenAIKey = this.runtime.env.get('OPENAI_API_KEY');
      embeddingDimension = hasOpenAIKey ? 1536 : 384;
    } else if (rawOptions.vectorStore?.qdrant?.dimension) {
      embeddingDimension = rawOptions.vectorStore.qdrant.dimension;
    }
    
    // Create vector store using factory with correct dimension
    const vectorStoreConfig: VectorStoreConfig = rawOptions.vectorStore
      ? {
          type: rawOptions.vectorStore.type,
          local: rawOptions.vectorStore.local
            ? {
                indexDir: path.resolve(this.workspaceRoot, rawOptions.vectorStore.local.indexDir ?? this.options.indexDir),
              }
            : undefined,
          qdrant: rawOptions.vectorStore.qdrant
            ? {
                ...rawOptions.vectorStore.qdrant,
                dimension: rawOptions.vectorStore.qdrant.dimension ?? embeddingDimension,
              }
            : rawOptions.vectorStore.type === 'qdrant'
              ? {
                  url: this.runtime.env.get('QDRANT_URL') ?? 'http://localhost:6333',
                  dimension: embeddingDimension,
                }
              : undefined,
        }
      : {
          type: 'auto',
          local: {
      indexDir: path.resolve(this.workspaceRoot, this.options.indexDir),
          },
          qdrant: this.runtime.env.get('QDRANT_URL')
            ? {
                url: this.runtime.env.get('QDRANT_URL')!,
                dimension: embeddingDimension,
              }
            : undefined,
        };
    
    this.vectorStore = createVectorStore(vectorStoreConfig, this.runtime);
    
    // Debug: log vector store configuration
    this.runtime.log?.('debug', 'Vector store configuration', {
      type: vectorStoreConfig.type,
      qdrantUrl: vectorStoreConfig.qdrant?.url,
      qdrantDimension: vectorStoreConfig.qdrant?.dimension,
      embeddingDimension,
      hasQdrantConfig: !!vectorStoreConfig.qdrant,
      hasLocalConfig: !!vectorStoreConfig.local,
      storeType: this.vectorStore.constructor.name,
    });
    
    // Create embedding provider using new factory
    // Convert RuntimeAdapter to EmbeddingRuntimeAdapter (subset interface)
    const embeddingRuntime: EmbeddingRuntimeAdapter = {
      fetch: this.runtime.fetch as any, // Type compatibility - EmbeddingRuntimeAdapter uses compatible fetch signature
      env: this.runtime.env,
      analytics: this.runtime.analytics,
    };
    
    this.embeddingProvider = createEmbeddingProvider(embeddingConfig, embeddingRuntime);
    
    this.llmEngine = createLocalStubLLMEngine({
      id: rawOptions.llmEngineId,
    });

    // Create reranker if enabled
    if (this.options.search.reranking.enabled && this.options.search.reranking.config) {
      this.reranker = createReranker(this.options.search.reranking.config, this.runtime);
    } else {
      this.reranker = null;
    }

    // Create context optimizer
    this.contextOptimizer = new ContextOptimizer();

    // Initialize self-learning components if enabled
    if (this.options.learning.enabled) {
      // Determine storage: use Qdrant if explicitly set or if vector store is Qdrant (for 'auto')
      const storageType = this.options.learning.storage;
      // For 'auto', check if vector store is Qdrant; for 'memory', never use Qdrant; for 'qdrant', always use Qdrant
      const useQdrant = storageType === 'qdrant' || 
                       (storageType === 'auto' && vectorStoreConfig.type === 'qdrant' && !!vectorStoreConfig.qdrant);
      const qdrantUrl = useQdrant ? (vectorStoreConfig.qdrant?.url ?? 'http://localhost:6333') : undefined;
      const qdrantApiKey = useQdrant ? this.runtime.env.get('QDRANT_API_KEY') : undefined;
      
      this.runtime.log?.('info', 'Initializing self-learning system', {
        enabled: this.options.learning.enabled,
        storageType,
        useQdrant: Boolean(useQdrant),
        qdrantUrl,
        vectorStoreType: vectorStoreConfig.type,
        hasQdrantConfig: !!vectorStoreConfig.qdrant,
      });

      // Initialize query history
      if (this.options.learning.queryHistory) {
        this.queryHistory = useQdrant && qdrantUrl
          ? new QdrantQueryHistoryStore({
              url: qdrantUrl,
              apiKey: qdrantApiKey,
              runtime: this.runtime,
            })
          : new MemoryQueryHistoryStore();
      } else {
        this.queryHistory = null;
      }

      // Initialize feedback store
      if (this.options.learning.feedback) {
        this.feedbackStore = useQdrant && qdrantUrl
          ? new QdrantFeedbackStore({
              url: qdrantUrl,
              apiKey: qdrantApiKey,
              runtime: this.runtime,
            })
          : new MemoryFeedbackStore();
      } else {
        this.feedbackStore = null;
      }

      // Initialize popularity boost
      if (this.options.learning.popularityBoost && this.feedbackStore) {
        this.popularityBoost = new PopularityBoostCalculator(this.feedbackStore);
      } else {
        this.popularityBoost = null;
      }

      // Initialize query pattern matcher
      if (this.options.learning.queryPatterns && this.queryHistory) {
        this.queryPatternMatcher = new QueryPatternMatcher(this.queryHistory);
      } else {
        this.queryPatternMatcher = null;
      }

      // Initialize adaptive weights
      if (this.options.learning.adaptiveWeights && this.queryHistory && this.feedbackStore) {
        this.adaptiveWeights = new AdaptiveWeightCalculator(this.queryHistory, this.feedbackStore);
      } else {
        this.adaptiveWeights = null;
      }

      // Initialize self-feedback generator
      if (this.options.learning.feedback) {
        this.selfFeedbackGenerator = new SelfFeedbackGenerator(this.runtime);
      } else {
        this.selfFeedbackGenerator = null;
      }
    } else {
      this.queryHistory = null;
      this.feedbackStore = null;
      this.popularityBoost = null;
      this.queryPatternMatcher = null;
      this.adaptiveWeights = null;
      this.selfFeedbackGenerator = null;
    }
  }

  async init(options?: MindEngineOptions): Promise<void> {
    if (options?.embedding) {
      const embeddingConfig: EmbeddingProviderConfig = {
        type: options.embedding.type,
        provider: options.embedding.provider,
      };
      const embeddingRuntime: EmbeddingRuntimeAdapter = {
        fetch: this.runtime.fetch as any, // Type compatibility
        env: this.runtime.env,
        analytics: this.runtime.analytics,
      };
      this.embeddingProvider = createEmbeddingProvider(embeddingConfig, embeddingRuntime);
    }
  }

  async dispose(): Promise<void> {
    // No-op for now. Placeholder for future resource cleanup.
  }

  async index(
    sources: KnowledgeSource[],
    options: KnowledgeIndexOptions,
  ): Promise<void> {
    const { chunks, fileMetadata } = await this.collectChunks(sources);
    
    this.runtime.log?.('info', `Collected ${chunks.length} chunks from ${sources.length} sources`, {
      scopeId: options.scope.id,
      sources: sources.map(s => s.id),
      filesCount: fileMetadata.size,
    });
    
    if (chunks.length === 0) {
      this.runtime.log?.('warn', `No chunks collected for scope ${options.scope.id}, clearing store`);
      await this.vectorStore.replaceScope(options.scope.id, []);
      return;
    }

    const embeddings = await this.embedChunks(chunks);
    
    // Create a map of file paths to metadata for quick lookup
    const fileMetadataByPath = new Map(fileMetadata);
    
    const storedChunks: StoredMindChunk[] = chunks.map((chunk, idx) => {
      const fileMeta = fileMetadataByPath.get(chunk.path);
      return {
      chunkId: chunk.chunkId,
      scopeId: options.scope.id,
      sourceId: chunk.sourceId,
      path: chunk.path,
      span: chunk.span,
      text: chunk.text,
        metadata: {
          ...chunk.metadata,
          fileHash: fileMeta?.hash,
          fileMtime: fileMeta?.mtime,
        },
      embedding: embeddings[idx]!,
      };
    });

    // Log vector store type for debugging
    const vectorStoreType = this.vectorStore.constructor.name;
    const isQdrant = vectorStoreType === 'QdrantVectorStore';
    this.runtime.log?.('info', `Using vector store: ${vectorStoreType}`, {
      scopeId: options.scope.id,
      chunksCount: storedChunks.length,
      isQdrant,
      firstChunkId: storedChunks[0]?.chunkId,
      firstChunkHasEmbedding: !!storedChunks[0]?.embedding,
    });
    
    if (!isQdrant) {
      this.runtime.log?.('warn', `Expected QdrantVectorStore but got ${vectorStoreType}. Check vectorStore config.`);
    }
    
    // Use incremental update if available and scope exists, otherwise fallback to full replace
    const hasUpdateScope = !!this.vectorStore.updateScope;
    const scopeExists = this.vectorStore.scopeExists 
      ? await this.vectorStore.scopeExists(options.scope.id)
      : false;
    const useIncremental = hasUpdateScope && scopeExists;
    
    if (useIncremental && this.vectorStore.updateScope) {
      this.runtime.log?.('info', `Using incremental update for scope ${options.scope.id}`);
      await this.vectorStore.updateScope(options.scope.id, storedChunks, fileMetadata);
    } else {
      this.runtime.log?.('info', `Using full rebuild for scope ${options.scope.id}`);
    await this.vectorStore.replaceScope(options.scope.id, storedChunks);
    }
  }

  async query(
    query: KnowledgeQuery,
    context: KnowledgeExecutionContext,
  ) {
    const [queryVector] = await this.embeddingProvider.embed([query.text]);
    if (!queryVector) {
      throw createKnowledgeError(
        'KNOWLEDGE_QUERY_INVALID',
        'Unable to generate embedding for query text.',
      );
    }

    const filters = this.createSearchFilters(context);
    let matches: VectorSearchMatch[];

    // Get adaptive weights if learning enabled
    let vectorWeight = this.options.search.vectorWeight;
    let keywordWeight = this.options.search.keywordWeight;
    let rrfK = this.options.search.rrfK;

    if (this.options.learning.enabled && this.adaptiveWeights) {
      try {
        const adaptiveWeights = await this.adaptiveWeights.getWeights(
          query.text,
          queryVector.values,
          context.scope.id,
        );
        vectorWeight = adaptiveWeights.vectorWeight;
        keywordWeight = adaptiveWeights.keywordWeight;
        rrfK = adaptiveWeights.rrfK;
        this.runtime.log?.('debug', 'Using adaptive weights', {
          vectorWeight,
          keywordWeight,
          rrfK,
        });
      } catch (error) {
        this.runtime.log?.('warn', 'Failed to get adaptive weights, using defaults', {
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    // Use hybrid search if enabled
    if (this.options.search.hybrid && this.vectorStore.getAllChunks) {
      // Get all chunks for keyword search
      const allChunks = await this.vectorStore.getAllChunks(context.scope.id, filters);

      // Perform hybrid search
      matches = await hybridSearch(
        async (scopeId, vector, limit, searchFilters) => {
          return await this.vectorStore.search(scopeId, vector, limit, searchFilters);
        },
        keywordSearch,
        context.scope.id,
        queryVector,
        query.text,
        allChunks,
        context.limit,
        filters,
        {
          vectorWeight,
          keywordWeight,
          rrfK,
        },
      );
    } else {
      // Vector search only
      matches = await this.vectorStore.search(
      context.scope.id,
      queryVector,
      context.limit,
      filters,
    );
    }

    // Apply popularity boost if enabled
    if (this.options.learning.enabled && this.popularityBoost) {
      matches = await Promise.all(
        matches.map(async (match) => {
          const boost = await this.popularityBoost!.getBoost(match.chunk.chunkId, context.scope.id);
          return {
            ...match,
            score: match.score * boost,
          };
        }),
      );
      // Re-sort after boost
      matches.sort((a, b) => b.score - a.score);
    }

    // Apply query pattern boost if enabled
    if (this.options.learning.enabled && this.queryPatternMatcher) {
      try {
        const recommendedChunkIds = await this.queryPatternMatcher.getRecommendedChunks(
          query.text,
          queryVector.values,
          context.scope.id,
          10,
        );
        if (recommendedChunkIds.length > 0) {
          matches = applyPatternBoost(matches, recommendedChunkIds, 1.3);
          matches.sort((a, b) => b.score - a.score);
        }
      } catch (error) {
        this.runtime.log?.('warn', 'Failed to apply query pattern boost', {
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    // Apply re-ranking if enabled
    let finalMatches = matches;
    if (this.reranker) {
      finalMatches = await this.reranker.rerank(query.text, matches, {
        topK: this.options.search.reranking.topK,
        minScore: this.options.search.reranking.minScore,
      });
    }

    // Convert to chunks
    let chunks: KnowledgeChunk[] = finalMatches.map((match: VectorSearchMatch) => ({
      id: match.chunk.chunkId,
      sourceId: match.chunk.sourceId,
      path: match.chunk.path,
      span: match.chunk.span,
      text: match.chunk.text,
      score: match.score,
      metadata: match.chunk.metadata,
    }));

    // Apply context optimization if enabled
    if (this.options.search.optimization.enabled) {
      chunks = this.contextOptimizer.optimize(finalMatches, {
        maxChunks: context.limit,
        deduplication: this.options.search.optimization.deduplication,
        deduplicationThreshold: this.options.search.optimization.deduplicationThreshold,
        diversification: this.options.search.optimization.diversification,
        diversityThreshold: this.options.search.optimization.diversityThreshold,
        maxChunksPerFile: this.options.search.optimization.maxChunksPerFile,
        adaptiveSelection: this.options.search.optimization.adaptiveSelection,
        tokenBudget: (context as any).tokenBudget,
        avgTokensPerChunk: this.options.search.optimization.avgTokensPerChunk,
      });
    }

    // In-memory cache for compressed chunks (per query)
    const compressionCache = new Map<string, string>();
    
    // Calculate tokens before compression
    const tokensBeforeCompression = chunks.reduce((sum, chunk) => {
      return sum + Math.ceil(chunk.text.length / 4);
    }, 0);
    
    let metadataOnlyCount = 0;
    
    // Format chunks with compression
    const compressionOptions = this.options.search.optimization.compression;
    const formattedChunks = chunks.map(chunk => {
      // Check cache first (if cache is enabled and using memory)
      if (compressionOptions.enabled && compressionOptions.cache === 'memory') {
        const cached = compressionCache.get(chunk.id);
        if (cached) {
          return cached;
        }
      }
      
      // Count metadata-only chunks
      if (
        compressionOptions.enabled &&
        compressionOptions.metadataOnly.enabled &&
        chunk.score !== undefined &&
        chunk.score < compressionOptions.metadataOnly.scoreThreshold
      ) {
        metadataOnlyCount++;
      }
      
      // Format chunk with compression
      const formatted = formatChunkForContext(
        chunk,
        compressionOptions.enabled ? compressionOptions : undefined,
        chunk.score,
      );
      
      // Cache the result
      if (compressionOptions.enabled && compressionOptions.cache === 'memory') {
        compressionCache.set(chunk.id, formatted);
      }
      
      return formatted;
    });
    
    const contextText = formattedChunks.join('\n\n---\n\n');
    
    // Calculate tokens after compression
    const tokensAfterCompression = Math.ceil(contextText.length / 4);
    const tokensSaved = tokensBeforeCompression - tokensAfterCompression;
    const compressionRate = tokensBeforeCompression > 0
      ? ((tokensSaved / tokensBeforeCompression) * 100).toFixed(1)
      : '0.0';
    
    // Log compression metrics if compression is enabled
    if (compressionOptions.enabled) {
      this.runtime.log?.('info', 'Compression metrics', {
        totalChunks: chunks.length,
        metadataOnlyChunks: metadataOnlyCount,
        tokensBeforeCompression,
        tokensAfterCompression,
        tokensSaved,
        compressionRate: `${compressionRate}%`,
      });
    }

    // Save query history if enabled (async, don't wait)
    if (this.options.learning.enabled && this.queryHistory) {
      const queryId = createHash('sha256')
        .update(`${context.scope.id}:${query.text}:${Date.now()}`)
        .digest('hex')
        .substring(0, 16);
      
      const queryHash = createHash('sha256')
        .update(query.text.toLowerCase().trim())
        .digest('hex');

      const historyEntry: QueryHistoryEntry = {
        queryId,
        queryText: query.text,
        queryHash,
        scopeId: context.scope.id,
        timestamp: Date.now(),
        resultChunkIds: chunks.map(c => c.id),
        topChunkIds: chunks.slice(0, 10).map(c => c.id),
        queryVector: queryVector.values,
      };

      this.runtime.log?.('info', 'Saving query history', {
        queryId,
        queryText: query.text.substring(0, 50),
        chunksCount: chunks.length,
        hasQueryHistory: !!this.queryHistory,
        queryVectorLength: queryVector.values.length,
      });
      
      // Save query history
      // For testing: await to see errors immediately (remove await in production)
      try {
        await this.queryHistory.save(historyEntry);
        this.runtime.log?.('info', 'Query history saved successfully', { 
          queryId,
          queryText: query.text.substring(0, 30),
        });
      } catch (error) {
        this.runtime.log?.('error', 'Failed to save query history', {
          error: error instanceof Error ? error.message : String(error),
          errorStack: error instanceof Error ? error.stack : undefined,
          queryId,
          queryText: query.text.substring(0, 30),
        });
        // Don't throw - learning is non-critical
      }
    }

    // Generate self-feedback for top chunks (async, don't wait)
    if (this.options.learning.enabled && this.selfFeedbackGenerator && this.feedbackStore) {
      const topChunks = chunks.slice(0, 5); // Top 5 chunks
      const queryId = createHash('sha256')
        .update(`${context.scope.id}:${query.text}:${Date.now()}`)
        .digest('hex')
        .substring(0, 16);

      Promise.all(
        topChunks.map(async (chunk) => {
          try {
            const feedback = await this.selfFeedbackGenerator!.generateFeedback(
              query.text,
              chunk.text,
              chunk.path,
            );

            const feedbackEntry: FeedbackEntry = {
              feedbackId: createHash('sha256')
                .update(`${queryId}:${chunk.id}:${Date.now()}`)
                .digest('hex')
                .substring(0, 16),
              queryId,
              chunkId: chunk.id,
              scopeId: context.scope.id,
              type: 'self',
              score: feedback.score,
              timestamp: Date.now(),
              metadata: {
                llmReasoning: feedback.reasoning,
                confidence: feedback.confidence,
              },
            };

            await this.feedbackStore!.save(feedbackEntry);
          } catch (error) {
            this.runtime.log?.('warn', 'Failed to generate self-feedback', {
              chunkId: chunk.id,
              error: error instanceof Error ? error.message : String(error),
            });
          }
        }),
      ).catch((error) => {
        this.runtime.log?.('warn', 'Error in self-feedback generation', {
          error: error instanceof Error ? error.message : String(error),
        });
      });
    }

    return {
      query: { ...query, limit: context.limit },
      chunks,
      contextText,
      engineId: this.id,
      generatedAt: new Date().toISOString(),
      // Add learning metadata for agent to use
      _learning: this.options.learning.enabled ? {
        queryId: createHash('sha256')
          .update(`${context.scope.id}:${query.text}:${Date.now()}`)
          .digest('hex')
          .substring(0, 16),
        feedbackStore: this.feedbackStore ? {
          // Method for agent to provide implicit feedback
          recordUsage: async (chunkIds: string[], usedInResponse: boolean = true) => {
            if (!this.feedbackStore) return;
            
            const queryId = createHash('sha256')
              .update(`${context.scope.id}:${query.text}:${Date.now()}`)
              .digest('hex')
              .substring(0, 16);

            await Promise.all(
              chunkIds.map(async (chunkId) => {
                const chunk = chunks.find(c => c.id === chunkId);
                if (!chunk) return;

                const feedbackEntry: FeedbackEntry = {
                  feedbackId: createHash('sha256')
                    .update(`${queryId}:${chunkId}:${Date.now()}`)
                    .digest('hex')
                    .substring(0, 16),
                  queryId,
                  chunkId,
                  scopeId: context.scope.id,
                  type: 'implicit',
                  score: usedInResponse ? 0.8 : 0.2, // High score if used, low if not
                  timestamp: Date.now(),
                  metadata: {
                    usedInResponse,
                    positionInResults: chunks.findIndex(c => c.id === chunkId),
                  },
                };

                if (this.feedbackStore) {
                  await this.feedbackStore.save(feedbackEntry);
                }
              }),
            );
          },
        } : undefined,
      } : undefined,
    };
  }

  private async collectChunks(
    sources: KnowledgeSource[],
  ): Promise<{ chunks: MindChunk[]; fileMetadata: Map<string, import('./vector-store/vector-store.js').FileMetadata> }> {
    const chunkList: MindChunk[] = [];
    const fileMetadata = new Map<string, import('./vector-store/vector-store.js').FileMetadata>();
    
    for (const source of sources) {
      const files = await fg(source.paths, {
        cwd: this.workspaceRoot,
        ignore: source.exclude ?? [],
        onlyFiles: true,
        dot: true,
        absolute: false,
      });

      this.runtime.log?.('info', `Found ${files.length} files for source ${source.id}`, {
        sourceId: source.id,
        paths: source.paths,
        filesCount: files.length,
      });

      for (const relativePath of files) {
        const fullPath = path.resolve(this.workspaceRoot, relativePath);
        const normalizedPath = relativePath.replace(/\\/g, '/');
        
        // Get file stats for incremental updates
        const stats = await fs.stat(fullPath);
        const contents = await fs.readFile(fullPath, 'utf8');
        const hash = createHash('sha256').update(contents).digest('hex');
        
        // Store file metadata
        fileMetadata.set(normalizedPath, {
          path: normalizedPath,
          mtime: stats.mtimeMs,
          hash,
        });
        
        const sourceChunks = this.chunkFile(
          source,
          normalizedPath,
          contents,
        );
        chunkList.push(...sourceChunks);
      }
    }
    
    this.runtime.log?.('info', `Total chunks collected: ${chunkList.length}`, {
      sourcesCount: sources.length,
      totalChunks: chunkList.length,
      filesCount: fileMetadata.size,
    });
    
    return { chunks: chunkList, fileMetadata };
  }

  private chunkFile(
    source: KnowledgeSource,
    relativePath: string,
    contents: string,
  ): MindChunk[] {
    // Get appropriate chunker for this file
    const chunker = getChunkerForFile(relativePath, source.language);

    // Prepare chunking options based on source kind
    const chunkingOptions = {
      maxLines:
        source.kind === 'docs'
          ? this.options.chunk.docLines
          : this.options.chunk.codeLines,
      minLines: source.kind === 'docs' ? 30 : 20,
      overlap: this.options.chunk.overlap,
      preserveContext: true,
      // Language-specific options
      ...(source.kind === 'code' && {
        includeJSDoc: true,
      }),
      ...(source.kind === 'docs' && {
        byHeadings: true,
        includeCodeBlocks: true,
      }),
    };

    // Chunk using selected chunker
    const chunks = chunker.chunk(contents, relativePath, chunkingOptions);

    // Convert to MindChunk format
    return chunks.map((chunk: Chunk, idx: number) => ({
      chunkId: `${source.id}:${relativePath}:${chunk.span.startLine}-${chunk.span.endLine}:${idx}`,
      sourceId: source.id,
      path: relativePath,
      span: chunk.span,
      text: chunk.text,
      metadata: {
        kind: source.kind,
        language: source.language,
        chunkerId: chunker.id,
        chunkType: chunk.type,
        chunkName: chunk.name,
        ...chunk.metadata,
      },
    }));
  }

  private chunkFileByLines(
    source: KnowledgeSource,
    relativePath: string,
    contents: string,
  ): MindChunk[] {
    const lines = contents.split(/\r?\n/);
    const maxLines =
      source.kind === 'docs'
        ? this.options.chunk.docLines
        : this.options.chunk.codeLines;
    const overlap = this.options.chunk.overlap;

    const chunks: MindChunk[] = [];
    let start = 0;
    while (start < lines.length) {
      const end = Math.min(lines.length, start + maxLines);
      const text = lines.slice(start, end).join('\n');
      const span: SpanRange = {
        startLine: start + 1,
        endLine: end,
      };
      chunks.push({
        chunkId: `${source.id}:${relativePath}:${span.startLine}-${span.endLine}`,
        sourceId: source.id,
        path: relativePath,
        span,
        text,
        metadata: {
          kind: source.kind,
          language: source.language,
          chunkMethod: 'line-based',
        },
      });

      if (end === lines.length) {
        break;
      }
      start = Math.max(0, end - overlap);
    }
    return chunks;
  }

  private async embedChunks(chunks: MindChunk[]) {
    const texts = chunks.map(chunk => chunk.text);
    
    // Track analytics
    const startTime = Date.now();
    this.runtime.analytics?.track('rag.embed_chunks.start', {
      chunksCount: chunks.length,
      provider: this.embeddingProvider.id,
    });

    try {
      const embeddings = await this.embeddingProvider.embed(texts);
      
      const duration = Date.now() - startTime;
      this.runtime.analytics?.track('rag.embed_chunks.complete', {
        chunksCount: chunks.length,
        provider: this.embeddingProvider.id,
        duration,
      });

      return embeddings;
    } catch (error) {
      const duration = Date.now() - startTime;
      this.runtime.analytics?.track('rag.embed_chunks.error', {
        chunksCount: chunks.length,
        provider: this.embeddingProvider.id,
        error: error instanceof Error ? error.message : String(error),
        duration,
      });
      throw error;
    }
  }

  private createSearchFilters(
    context: KnowledgeExecutionContext,
  ): VectorSearchFilters | undefined {
    if (!context.filters) {
      return undefined;
    }
    const filters: VectorSearchFilters = {};
    if (context.filters.sourceIds?.length) {
      filters.sourceIds = new Set(context.filters.sourceIds);
    }
    if (context.filters.paths?.length) {
      const matcher = picomatch(context.filters.paths, { dot: true });
      filters.pathMatcher = (candidate: string) => matcher(candidate);
    }
    return Object.keys(filters).length ? filters : undefined;
  }
}

function normalizeOptions(raw: MindEngineOptions): NormalizedOptions {
  const rerankingType = raw.search?.reranking?.type ?? 'none';
  const rerankingEnabled = rerankingType !== 'none';
  const optimizationEnabled = raw.search?.optimization !== undefined;

  return {
    indexDir: raw.indexDir ?? DEFAULT_INDEX_DIR,
    chunk: {
      codeLines: raw.chunk?.codeLines ?? DEFAULT_CODE_CHUNK_LINES,
      docLines: raw.chunk?.docLines ?? DEFAULT_DOC_CHUNK_LINES,
      overlap: raw.chunk?.overlap ?? DEFAULT_CHUNK_OVERLAP,
    },
    search: {
      hybrid: raw.search?.hybrid ?? false,
      vectorWeight: raw.search?.vectorWeight ?? 0.7,
      keywordWeight: raw.search?.keywordWeight ?? 0.3,
      rrfK: raw.search?.rrfK ?? 60,
      reranking: {
        enabled: rerankingEnabled,
        type: rerankingType,
        topK: raw.search?.reranking?.topK ?? 20,
        minScore: raw.search?.reranking?.minScore ?? 0,
        config: rerankingEnabled
          ? {
              type: rerankingType,
              crossEncoder: raw.search?.reranking?.crossEncoder,
            }
          : undefined,
      },
      optimization: {
        enabled: optimizationEnabled,
        deduplication: raw.search?.optimization?.deduplication ?? true,
        deduplicationThreshold: raw.search?.optimization?.deduplicationThreshold ?? 0.9,
        diversification: raw.search?.optimization?.diversification ?? true,
        diversityThreshold: raw.search?.optimization?.diversityThreshold ?? 0.3,
        maxChunksPerFile: raw.search?.optimization?.maxChunksPerFile ?? 3,
        adaptiveSelection: raw.search?.optimization?.adaptiveSelection ?? false,
        avgTokensPerChunk: raw.search?.optimization?.avgTokensPerChunk ?? 200,
        compression: {
          enabled: raw.search?.optimization?.compression?.enabled ?? false,
          cache: raw.search?.optimization?.compression?.cache ?? 'memory',
          smartTruncation: {
            enabled: raw.search?.optimization?.compression?.smartTruncation?.enabled ?? 
                     (raw.search?.optimization?.compression?.enabled ? true : false),
            maxLength: raw.search?.optimization?.compression?.smartTruncation?.maxLength ?? 2000,
            preserveStructure: raw.search?.optimization?.compression?.smartTruncation?.preserveStructure ?? true,
          },
          metadataOnly: {
            enabled: raw.search?.optimization?.compression?.metadataOnly?.enabled ?? 
                     (raw.search?.optimization?.compression?.enabled ? true : false),
            scoreThreshold: raw.search?.optimization?.compression?.metadataOnly?.scoreThreshold ?? 0.4,
          },
          llm: {
            enabled: raw.search?.optimization?.compression?.llm?.enabled ?? false,
            model: raw.search?.optimization?.compression?.llm?.model,
            maxTokens: raw.search?.optimization?.compression?.llm?.maxTokens,
          },
        },
      },
    },
    learning: {
      enabled: raw.learning?.enabled ?? false,
      queryHistory: raw.learning?.queryHistory ?? (raw.learning?.enabled ? true : false),
      feedback: raw.learning?.feedback ?? (raw.learning?.enabled ? true : false),
      popularityBoost: raw.learning?.popularityBoost ?? (raw.learning?.enabled ? true : false),
      queryPatterns: raw.learning?.queryPatterns ?? (raw.learning?.enabled ? true : false),
      adaptiveWeights: raw.learning?.adaptiveWeights ?? false,
      // Keep 'auto' as-is, it will be resolved in constructor based on vector store type
      storage: (raw.learning?.storage === 'qdrant' || raw.learning?.storage === 'memory' || raw.learning?.storage === 'auto')
        ? raw.learning.storage === 'auto' ? 'auto' as 'qdrant' | 'memory' | 'auto'
        : raw.learning.storage
        : 'memory' as 'qdrant' | 'memory',
    },
  };
}

/**
 * Extract important parts of code (function signatures, type definitions, etc.)
 */
function extractImportantParts(text: string, maxLength: number): string[] {
  const lines = text.split('\n');
  const importantParts: string[] = [];
  const importantKeywords = ['export', 'function', 'class', 'interface', 'type', 'const', 'let', 'var', 'enum', 'namespace'];
  
  for (const line of lines) {
    const trimmed = line.trim();
    // Check if line contains important keywords
    if (importantKeywords.some(keyword => trimmed.startsWith(keyword) || trimmed.includes(` ${keyword} `))) {
      // Include the line if it's not too long
      if (trimmed.length <= maxLength * 0.3) {
        importantParts.push(line);
      }
    }
  }
  
  return importantParts;
}

/**
 * Smart truncation with context preservation
 */
function smartTruncate(
  text: string,
  maxLength: number,
  preserveStructure: boolean,
): string {
  if (text.length <= maxLength) {
    return text;
  }
  
  if (!preserveStructure) {
    // Simple truncation
    return text.slice(0, maxLength - 3) + '...';
  }
  
  // Preserve structure: beginning + important parts + end
  const lines = text.split('\n');
  const totalLines = lines.length;
  
  // Calculate how many lines we can keep
  const avgLineLength = text.length / totalLines;
  const maxLines = Math.floor(maxLength / avgLineLength);
  
  if (maxLines >= totalLines) {
    return text;
  }
  
  // Keep first 30% and last 30% of lines, plus important parts
  const keepStart = Math.floor(maxLines * 0.3);
  const keepEnd = Math.floor(maxLines * 0.3);
  const keepMiddle = maxLines - keepStart - keepEnd;
  
  const startLines = lines.slice(0, keepStart);
  const endLines = lines.slice(totalLines - keepEnd);
  
  // Extract important parts from the middle section
  const middleText = lines.slice(keepStart, totalLines - keepEnd).join('\n');
  const importantParts = extractImportantParts(middleText, maxLength);
  const importantLines = importantParts.slice(0, keepMiddle);
  
  const result = [
    ...startLines,
    ...(importantLines.length > 0 ? ['// ... important parts ...', ...importantLines] : []),
    '// ...',
    ...endLines,
  ].join('\n');
  
  // If still too long, truncate end
  if (result.length > maxLength) {
    return result.slice(0, maxLength - 3) + '...';
  }
  
  return result;
}

/**
 * Format chunk as metadata-only (for low-score chunks)
 */
function formatMetadataOnly(chunk: KnowledgeChunk): string {
  const parts: string[] = [];
  parts.push(`[metadata-only] ${chunk.path}`);
  
  if (chunk.metadata) {
    const functionName = chunk.metadata.functionName as string | undefined;
    const className = chunk.metadata.className as string | undefined;
    const typeName = chunk.metadata.typeName as string | undefined;
    
    const nameParts: string[] = [];
    if (className) nameParts.push(`class:${className}`);
    if (functionName) nameParts.push(`function:${functionName}`);
    if (typeName) nameParts.push(`type:${typeName}`);
    
    if (nameParts.length > 0) {
      parts.push(`  ${nameParts.join(', ')}`);
    }
    
    // Try to extract a brief description from comments
    const text = chunk.text;
    const commentMatch = text.match(/\/\*\*[\s\S]*?\*\//) || text.match(/\/\/.*/);
    if (commentMatch) {
      const comment = commentMatch[0]
        .replace(/\/\*\*|\*\//g, '')
        .replace(/\*\s*/g, '')
        .trim()
        .split('\n')[0]
        ?.trim();
      if (comment && comment.length < 100) {
        parts.push(`  ${comment}`);
      }
    }
  }
  
  parts.push(`  Lines: ${chunk.span.startLine}-${chunk.span.endLine}`);
  
  return parts.join('\n');
}

function formatChunkForContext(
  chunk: KnowledgeChunk,
  compressionOptions?: NormalizedOptions['search']['optimization']['compression'],
  score?: number,
): string {
  const parts: string[] = [];
  
  // File path and location
  parts.push(`File: ${chunk.path}`);
  parts.push(`Lines: ${chunk.span.startLine}-${chunk.span.endLine}`);
  
  // Add function/class context if available in metadata
  if (chunk.metadata) {
    const functionName = chunk.metadata.functionName as string | undefined;
    const className = chunk.metadata.className as string | undefined;
    const typeName = chunk.metadata.typeName as string | undefined;
    
    if (className) {
      parts.push(`Class: ${className}`);
    }
    if (functionName) {
      parts.push(`Function: ${functionName}`);
    }
    if (typeName) {
      parts.push(`Type: ${typeName}`);
    }
    
    // Add heading context for markdown
    const headingTitle = chunk.metadata.headingTitle as string | undefined;
    const headingLevel = chunk.metadata.headingLevel as number | undefined;
    if (headingTitle) {
      const headingPrefix = headingLevel ? '#'.repeat(headingLevel) + ' ' : '';
      parts.push(`Section: ${headingPrefix}${headingTitle}`);
    }
  }
  
  // Add chunk type if available
  const chunkType = chunk.metadata?.chunkType as string | undefined;
  if (chunkType) {
    parts.push(`Type: ${chunkType}`);
  }
  
  parts.push(''); // Empty line before content
  
  // Apply compression if enabled
  let chunkText = chunk.text;
  
  if (compressionOptions?.enabled) {
    // Metadata-only mode for low-score chunks
    if (
      compressionOptions.metadataOnly.enabled &&
      score !== undefined &&
      score < compressionOptions.metadataOnly.scoreThreshold
    ) {
      return formatMetadataOnly(chunk);
    }
    
    // Smart truncation
    if (compressionOptions.smartTruncation.enabled) {
      chunkText = smartTruncate(
        chunkText,
        compressionOptions.smartTruncation.maxLength,
        compressionOptions.smartTruncation.preserveStructure,
      );
    }
  }
  
  parts.push(chunkText);
  
  return parts.join('\n');
}

export function createMindKnowledgeEngineFactory(): KnowledgeEngineFactory {
  return (config: KnowledgeEngineConfig, context: KnowledgeEngineFactoryContext) => 
    new MindKnowledgeEngine(config, context);
}

export function registerMindKnowledgeEngine(
  registry: KnowledgeEngineRegistry,
): void {
  registry.register('mind', createMindKnowledgeEngineFactory());
}

// Export RuntimeAdapter for use in handlers
export type { RuntimeAdapter } from './adapters/runtime-adapter.js';
export { createRuntimeAdapter } from './adapters/runtime-adapter.js';

// Export compression types
export type { LLMCompressor } from './compression/llm-compressor.js';
export { NullLLMCompressor } from './compression/llm-compressor.js';

// Export compression options type
export type CompressionOptions = NormalizedOptions['search']['optimization']['compression'];
