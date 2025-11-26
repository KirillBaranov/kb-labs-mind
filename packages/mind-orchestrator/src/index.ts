/**
 * @kb-labs/mind-orchestrator
 *
 * Agent-optimized RAG query orchestration for KB Labs Mind.
 *
 * Features:
 * - Query decomposition into sub-queries
 * - Completeness checking with retry
 * - Response synthesis with sources
 * - Token budget compression
 * - instant/auto/thinking modes
 */

// Main orchestrator
export {
  AgentQueryOrchestrator,
  createAgentQueryOrchestrator,
} from './orchestrator.js';
export type { AgentQueryOrchestratorOptions } from './orchestrator.js';

// Types
export * from './types.js';

// Components
export { QueryDecomposer, createQueryDecomposer } from './decomposer/index.js';
export { ChunkGatherer, createChunkGatherer } from './gatherer/index.js';
export { CompletenessChecker, createCompletenessChecker } from './checker/index.js';
export { ResponseSynthesizer, createResponseSynthesizer } from './synthesizer/index.js';
export { ResponseCompressor, createResponseCompressor } from './compressor/index.js';

// LLM
export { createLLMProvider, type LLMProvider } from './llm/index.js';

// Analytics
export {
  createMindAnalytics,
  type MindAnalytics,
  type MindAnalyticsOptions,
  type MindAnalyticsContext,
  type MindEventType,
  type QueryStartedPayload,
  type QueryCompletedPayload,
  type QueryFailedPayload,
  calculateLLMCost,
  DEFAULT_LLM_COSTS,
} from './analytics/index.js';

// Re-export agent response types from knowledge-contracts
export {
  type AgentResponse,
  type AgentErrorResponse,
  type AgentSource,
  type AgentMeta,
  type AgentQueryMode,
  type AgentSourceKind,
  type AgentSuggestion,
  type AgentDebugInfo,
  type AgentErrorCode,
  isAgentError,
  isAgentSuccess,
  AGENT_RESPONSE_SCHEMA_VERSION,
  CONFIDENCE_THRESHOLDS,
} from '@kb-labs/knowledge-contracts';
