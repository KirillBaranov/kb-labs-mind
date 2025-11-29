import type { KnowledgeIntent, KnowledgeResult, AgentQueryMode } from '@kb-labs/knowledge-contracts';
import type { AgentResponse, AgentErrorResponse } from '@kb-labs/knowledge-contracts';
import type { KnowledgeLogger } from '@kb-labs/knowledge-core';
import {
  MIND_PRODUCT_ID,
  createMindKnowledgeRuntime,
} from '../shared/knowledge.js';
import {
  createAgentQueryOrchestrator,
  isAgentError,
  type AgentQueryOrchestrator,
} from '@kb-labs/mind-orchestrator';
import { createOpenAILLMEngine } from '@kb-labs/mind-llm';

/**
 * Global orchestrator instance for cache persistence across queries
 */
let globalOrchestrator: AgentQueryOrchestrator | null = null;

export interface RagIndexOptions {
  cwd: string;
  scopeId?: string;
}

export interface RagIndexResult {
  scopeIds: string[];
}

export interface RagIndexOptionsWithRuntime extends RagIndexOptions {
  runtime?: Parameters<typeof createMindKnowledgeRuntime>[0]['runtime'];
}

export async function runRagIndex(
  options: RagIndexOptions | RagIndexOptionsWithRuntime,
): Promise<RagIndexResult> {
  const runtime = await createMindKnowledgeRuntime({
    cwd: options.cwd,
    runtime: 'runtime' in options ? options.runtime : undefined,
  });
  const allScopeIds = runtime.config.scopes?.map((scope: any) => scope.id) ?? [];
  if (!allScopeIds.length) {
    throw new Error('No knowledge scopes found. Update kb.config.json first.');
  }

  const scopeIds = options.scopeId
    ? allScopeIds.filter((scopeId: string) => scopeId === options.scopeId)
    : allScopeIds;

  if (!scopeIds.length) {
    throw new Error(
      `Scope "${options.scopeId}" is not defined in knowledge.scopes.`,
    );
  }

  for (const scopeId of scopeIds) {
    await runtime.service.index(scopeId);
  }

  // Invalidate query cache after re-indexing
  // This ensures fresh results after index update
  if (globalOrchestrator) {
    globalOrchestrator.invalidateCache(scopeIds);
  }

  return { scopeIds };
}

export interface RagQueryOptions {
  cwd: string;
  scopeId?: string;
  text: string;
  intent?: KnowledgeIntent;
  limit?: number;
  profileId?: string;
  runtime?: Parameters<typeof createMindKnowledgeRuntime>[0]['runtime'];
  onProgress?: (stage: string, details?: string) => void;
}

export interface RagQueryResult {
  scopeId: string;
  knowledge: KnowledgeResult;
}

export async function runRagQuery(
  options: RagQueryOptions,
): Promise<RagQueryResult> {
  // Convert onProgress from (stage, details) to ProgressEvent format
  const onProgressEvent = options.onProgress
    ? (event: { stage: string; details?: string; metadata?: Record<string, unknown>; timestamp: number }) => {
        try {
          // Map engine stage names to human-readable messages
          const stageMap: Record<string, string> = {
            'using_reasoning_engine': 'Using reasoning engine',
            'reasoning_completed': 'Reasoning completed',
            'analyzing_query_complexity': 'Analyzing query complexity',
            'query_is_simple': 'Query is simple',
            'planning_query': 'Planning query',
            'query_plan_generated': 'Query plan generated',
            'executing_subqueries': 'Executing subqueries',
            'subqueries_completed': 'Subqueries completed',
            'synthesizing_context': 'Synthesizing context',
            'context_synthesis_completed': 'Context synthesis completed',
            'generating_embedding': 'Generating embeddings',
            'performing_hybrid_search': 'Performing hybrid search',
            'searching_vector_store': 'Searching vector store',
            'search_completed': 'Search completed',
            'applying_popularity_boost': 'Applying popularity boost',
            'applying_query_pattern_boost': 'Applying query pattern boost',
            're_ranking_results': 'Re-ranking results',
            're_ranking_completed': 'Re-ranking completed',
            'compression_applied': 'Compression applied',
            'saving_query_history': 'Saving query history',
          };
          
          const humanReadableStage = stageMap[event.stage] || event.stage;

          // Extract interesting details from metadata
          let enhancedDetails = event.details;
          if (event.metadata) {
            // Show subqueries if available
            if (event.metadata.subqueries && Array.isArray(event.metadata.subqueries)) {
              const subqueryList = event.metadata.subqueries.slice(0, 3).join(', ');
              const count = event.metadata.subqueries.length;
              enhancedDetails = `${count} subqueries: ${subqueryList}${count > 3 ? '...' : ''}`;
            }
            // Show result count if available
            else if (typeof event.metadata.resultCount === 'number') {
              enhancedDetails = `${event.metadata.resultCount} results`;
            }
            // Show chunk count if available
            else if (typeof event.metadata.chunkCount === 'number') {
              enhancedDetails = `${event.metadata.chunkCount} chunks`;
            }
          }

          if (options.onProgress) {
            options.onProgress(humanReadableStage, enhancedDetails);
          }
        } catch (error) {
          // Don't break query if progress callback fails
          // Error is silently ignored
        }
      }
    : undefined;

  // Wrap runtime to suppress INFO logs but allow WARN/ERROR
  const originalRuntime = options.runtime;
  
  const wrappedRuntime = originalRuntime ? {
    ...originalRuntime,
    log: (level: 'debug' | 'info' | 'warn' | 'error', message: string, meta?: any) => {
      // Suppress INFO and DEBUG logs - progress comes from explicit API now
      if (level === 'info' || level === 'debug') {
        return; // Don't output INFO/DEBUG logs
      }
      
      // Call original logger for warnings and errors only
      if (originalRuntime.log && (level === 'warn' || level === 'error')) {
        originalRuntime.log(level, message, meta);
      }
    },
  } : undefined;

  // Create a logger that suppresses INFO logs
  const silentLogger: KnowledgeLogger = {
    debug: () => {}, // Suppress debug
    info: () => {}, // Suppress info - progress comes from explicit API
    warn: (msg: string, meta?: Record<string, unknown>) => {
      if (originalRuntime?.log) {
        originalRuntime.log('warn', msg, meta);
      }
    },
    error: (msg: string, meta?: Record<string, unknown>) => {
      if (originalRuntime?.log) {
        originalRuntime.log('error', msg, meta);
      }
    },
  };

  const runtime = await createMindKnowledgeRuntime({
    cwd: options.cwd,
    runtime: wrappedRuntime,
    logger: silentLogger,
    onProgress: onProgressEvent,
  });
  
  options.onProgress?.('Initializing Mind runtime');

  const defaultScopeId = runtime.config.scopes?.[0]?.id;
  const scopeId = options.scopeId ?? defaultScopeId;
  if (!scopeId) {
    throw new Error(
      'No knowledge scopes configured. Provide at least one scope in kb.config.json.',
    );
  }

  options.onProgress?.('Preparing query', `scope: ${scopeId}`);

  options.onProgress?.('Searching knowledge base');

  const knowledge = await runtime.service.query({
    productId: MIND_PRODUCT_ID,
    intent: options.intent ?? 'summary',
    scopeId,
    text: options.text,
    limit: options.limit,
    profileId: options.profileId,
  });

  options.onProgress?.('Processing results', `${knowledge.chunks.length} chunks found`);

  return {
    scopeId,
    knowledge,
  };
}

// === Agent-optimized RAG Query ===

export interface AgentRagQueryOptions {
  cwd: string;
  scopeId?: string;
  text: string;
  mode?: AgentQueryMode;
  debug?: boolean;
  runtime?: Parameters<typeof createMindKnowledgeRuntime>[0]['runtime'];
}

export type AgentRagQueryResult = AgentResponse | AgentErrorResponse;

/**
 * Run agent-optimized RAG query with orchestration.
 *
 * This function uses the orchestrator pipeline:
 * 1. Detect query complexity
 * 2. Decompose into sub-queries (auto/thinking modes)
 * 3. Gather chunks from mind-engine
 * 4. Check completeness (with retry in thinking mode)
 * 5. Synthesize agent-friendly response
 * 6. Compress if needed
 *
 * @returns AgentResponse | AgentErrorResponse - clean JSON for agents
 */
export async function runAgentRagQuery(
  options: AgentRagQueryOptions,
): Promise<AgentRagQueryResult> {
  // Get OpenAI API key from environment
  const apiKey = process.env.OPENAI_API_KEY;

  // Create LLM engine if API key available
  const llmEngine = apiKey
    ? createOpenAILLMEngine({
        apiKey,
        model: 'gpt-4o-mini',
      })
    : undefined;

  // Reuse or create global orchestrator for cache persistence
  if (!globalOrchestrator) {
    globalOrchestrator = createAgentQueryOrchestrator({
      llmEngine,
      config: {
        mode: options.mode ?? 'auto',
        autoDetectComplexity: true,
      },
    });
  }

  const orchestrator = globalOrchestrator;

  // Create silent logger to suppress all output
  const silentLogger: KnowledgeLogger = {
    debug: () => {},
    info: () => {},
    warn: () => {},
    error: () => {},
  };

  // Create runtime
  const runtime = await createMindKnowledgeRuntime({
    cwd: options.cwd,
    runtime: options.runtime,
    logger: silentLogger,
  });

  // Get scope ID
  const defaultScopeId = runtime.config.scopes?.[0]?.id;
  const scopeId = options.scopeId ?? defaultScopeId;

  if (!scopeId) {
    return {
      error: {
        code: 'KNOWLEDGE_SCOPE_NOT_FOUND',
        message: 'No knowledge scopes configured. Provide at least one scope in kb.config.json.',
        recoverable: false,
      },
      meta: {
        schemaVersion: 'agent-response-v1',
        requestId: `rq-${Date.now()}`,
        mode: options.mode ?? 'auto',
        timingMs: 0,
        cached: false,
      },
    };
  }

  // Create query function for orchestrator with adaptive weights support
  const queryFn = async (queryOptions: {
    text: string;
    intent?: KnowledgeIntent;
    limit?: number;
    vectorWeight?: number;
    keywordWeight?: number;
  }) => {
    const result = await runtime.service.query({
      productId: MIND_PRODUCT_ID,
      intent: queryOptions.intent ?? 'search',
      scopeId,
      text: queryOptions.text,
      limit: queryOptions.limit,
      // Pass adaptive weights via metadata for mind-engine to use
      metadata: queryOptions.vectorWeight !== undefined && queryOptions.keywordWeight !== undefined
        ? {
            vectorWeight: queryOptions.vectorWeight,
            keywordWeight: queryOptions.keywordWeight,
          }
        : undefined,
    });

    return {
      chunks: result.chunks,
    };
  };

  // Execute orchestrated query
  const result = await orchestrator.query(
    {
      cwd: options.cwd,
      scopeId,
      text: options.text,
      mode: options.mode,
      debug: options.debug,
    },
    queryFn,
  );

  return result;
}
