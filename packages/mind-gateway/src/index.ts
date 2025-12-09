/**
 * Gateway handlers for KB Labs Mind V2 preparation
 */

export * from './handlers/query';
export * from './handlers/verify';
// verifyIndexes moved to @kb-labs/mind-core to break circular dependency (TASK-004)
export * from './types/request';

// Re-export types for convenience
export type {
  QueryRequest,
  QueryResponse,
  VerifyRequest,
  VerifyResponse,
  GatewayError,
} from './types/request';
