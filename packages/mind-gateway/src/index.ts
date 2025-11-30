/**
 * Gateway handlers for KB Labs Mind V2 preparation
 */

export * from './handlers/query';
export * from './handlers/verify';
// Sync handlers moved to mind-cli to avoid circular dependency
export { verifyIndexes } from './handlers/verify-utils';
export * from './types/request';

// Re-export types for convenience
export type {
  QueryRequest,
  QueryResponse,
  VerifyRequest,
  VerifyResponse,
  GatewayError,
} from './types/request';
