/**
 * Analytics event payload types for Mind orchestrator
 */

import type { AgentQueryMode } from '@kb-labs/knowledge-contracts';

// === EVENT TYPES ===

export type MindEventType =
  // Query lifecycle
  | 'mind.query.started'
  | 'mind.query.completed'
  | 'mind.query.failed'
  // Pipeline stages (optional detailed tracking)
  | 'mind.decompose.completed'
  | 'mind.gather.completed'
  | 'mind.check.completed'
  | 'mind.synthesize.completed'
  // Index operations
  | 'mind.index.started'
  | 'mind.index.completed'
  | 'mind.index.failed';

// === PAYLOAD SCHEMAS ===

export interface QueryStartedPayload {
  queryId: string;
  text: string;
  textHash: string;
  mode: AgentQueryMode;
  scopeId: string;
  agentMode: boolean;
}

export interface QueryCompletedPayload {
  queryId: string;

  // Timing
  durationMs: number;

  // Quality metrics
  confidence: number;
  complete: boolean;
  sourcesCount: number;
  sourcesBreakdown: {
    code: number;
    docs: number;
    external: Record<string, number>;
  };

  // LLM metrics
  llmCalls: number;
  tokensIn: number;
  tokensOut: number;
  llmProvider: string;
  llmModel: string;

  // Cost (USD)
  costLlm: number;
  costEmbedding: number;
  costTotal: number;

  // Cache
  cached: boolean;
  cacheLevel?: 'l1' | 'l2' | 'l3';

  // Performance
  mode: AgentQueryMode;
  subqueriesCount: number;
  iterationsCount: number;
  compressionApplied: boolean;
}

export interface QueryFailedPayload {
  queryId: string;
  durationMs: number;
  errorCode: string;
  errorMessage: string;
  recoverable: boolean;
}

export interface StageCompletedPayload {
  queryId: string;
  stage: string;
  durationMs: number;
  [key: string]: unknown;
}

// === ANALYTICS CONTEXT ===

export interface MindAnalyticsContext {
  queryId: string;
  scopeId: string;
  mode: AgentQueryMode;
  startTime: number;

  // Accumulated metrics
  llmCalls: number;
  tokensIn: number;
  tokensOut: number;
  subqueries: string[];
  iterations: number;
  compressionApplied: boolean;
}

// === LLM COST CONFIGURATION ===

export interface LLMCostConfig {
  provider: string;
  model: string;
  inputCostPerMillion: number;
  outputCostPerMillion: number;
}

export const DEFAULT_LLM_COSTS: Record<string, LLMCostConfig> = {
  'gpt-4o-mini': {
    provider: 'openai',
    model: 'gpt-4o-mini',
    inputCostPerMillion: 0.15,
    outputCostPerMillion: 0.60,
  },
  'gpt-4o': {
    provider: 'openai',
    model: 'gpt-4o',
    inputCostPerMillion: 2.50,
    outputCostPerMillion: 10.00,
  },
  'gpt-4-turbo': {
    provider: 'openai',
    model: 'gpt-4-turbo',
    inputCostPerMillion: 10.00,
    outputCostPerMillion: 30.00,
  },
};

export function calculateLLMCost(
  tokensIn: number,
  tokensOut: number,
  model: string = 'gpt-4o-mini',
): number {
  const config = DEFAULT_LLM_COSTS[model] ?? DEFAULT_LLM_COSTS['gpt-4o-mini'];
  const inputCost = (tokensIn / 1_000_000) * config.inputCostPerMillion;
  const outputCost = (tokensOut / 1_000_000) * config.outputCostPerMillion;
  return inputCost + outputCost;
}
