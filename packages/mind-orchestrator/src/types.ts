/**
 * Mind Orchestrator Types
 *
 * Internal types for the orchestration pipeline.
 */

import type {
  AgentQueryMode,
  AgentResponse,
  AgentErrorResponse,
  AgentSource,
} from '@kb-labs/knowledge-contracts';
import type { KnowledgeChunk } from '@kb-labs/knowledge-contracts';

// === ORCHESTRATOR CONFIG ===

export interface OrchestratorModeConfig {
  instant: {
    maxChunks: number;
    skipLLM: boolean;
  };
  auto: {
    maxSubqueries: number;
    chunksPerQuery: number;
    maxIterations: number;
  };
  thinking: {
    maxSubqueries: number;
    chunksPerQuery: number;
    maxIterations: number;
    enableCrossReference: boolean;
  };
}

export interface OrchestratorLLMConfig {
  provider: 'openai' | 'sber' | 'local';
  model: string;
  temperature: number;
  apiKey?: string;
  baseUrl?: string;
}

export interface OrchestratorSynthesisConfig {
  maxSourceSnippets: number;
  snippetMaxLines: number;
}

export interface OrchestratorCompressionConfig {
  maxResponseTokens: number;
  maxSnippetLines: number;
  maxSources: number;
  compressionStrategy: 'truncate' | 'summarize' | 'smart';
}

export interface OrchestratorCacheConfig {
  enabled: boolean;
  l1TtlMs: number;
  l2TtlMs: number;
  cacheDir: string;
}

export interface OrchestratorConfig {
  mode: AgentQueryMode;
  autoDetectComplexity: boolean;
  deterministic: boolean;
  llm: OrchestratorLLMConfig;
  modes: OrchestratorModeConfig;
  synthesis: OrchestratorSynthesisConfig;
  compression: OrchestratorCompressionConfig;
  cache: OrchestratorCacheConfig;
}

// === QUERY OPTIONS ===

export interface OrchestratorQueryOptions {
  cwd: string;
  scopeId?: string;
  text: string;
  mode?: AgentQueryMode;
  sources?: string[];
  maxTokens?: number;
  noCache?: boolean;
  idempotencyKey?: string;
  debug?: boolean;
}

// === INTERNAL TYPES ===

export interface QueryComplexity {
  level: 'simple' | 'medium' | 'complex';
  reason: string;
  suggestedMode: AgentQueryMode;
}

export interface DecomposedQuery {
  original: string;
  subqueries: string[];
  reasoning?: string;
}

export interface GatheredChunks {
  chunks: KnowledgeChunk[];
  subqueryResults: Map<string, KnowledgeChunk[]>;
  totalMatches: number;
}

export interface CompletenessResult {
  complete: boolean;
  confidence: number;
  missing?: string[];
  sourcesChecked: string[];
  suggestSources?: Array<{
    source: string;
    reason: string;
    query?: string;
  }>;
}

export interface SynthesisResult {
  answer: string;
  sources: AgentSource[];
  confidence: number;
  complete: boolean;
  suggestions?: Array<{
    type: 'adr' | 'repo' | 'doc' | 'file' | 'next-question';
    label: string;
    ref: string;
  }>;
}

// === LLM STATS ===

export interface LLMStats {
  calls: number;
  tokensIn: number;
  tokensOut: number;
}

// === ORCHESTRATOR RESULT ===

export type OrchestratorResult = AgentResponse | AgentErrorResponse;

// === DEFAULT CONFIG ===

export const DEFAULT_ORCHESTRATOR_CONFIG: OrchestratorConfig = {
  mode: 'auto',
  autoDetectComplexity: true,
  deterministic: false,
  llm: {
    provider: 'openai',
    model: 'gpt-4o-mini',
    temperature: 0.2,
  },
  modes: {
    instant: {
      maxChunks: 5,
      skipLLM: true,
    },
    auto: {
      maxSubqueries: 3,
      chunksPerQuery: 8,
      maxIterations: 1,
    },
    thinking: {
      maxSubqueries: 5,
      chunksPerQuery: 12,
      maxIterations: 3,
      enableCrossReference: true,
    },
  },
  synthesis: {
    maxSourceSnippets: 5,
    snippetMaxLines: 20,
  },
  compression: {
    maxResponseTokens: 4000,
    maxSnippetLines: 30,
    maxSources: 5,
    compressionStrategy: 'smart',
  },
  cache: {
    enabled: true,
    l1TtlMs: 5 * 60 * 1000,     // 5 minutes
    l2TtlMs: 60 * 60 * 1000,    // 1 hour
    cacheDir: '.kb/mind/cache',
  },
};
