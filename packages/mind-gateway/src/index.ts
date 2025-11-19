/**
 * Gateway handlers for KB Labs Mind V2 preparation
 */

export * from './handlers/query.js';
export * from './handlers/verify.js';
// Sync handlers moved to mind-cli to avoid circular dependency
export { verifyIndexes } from './handlers/verify-utils.js';
export * from './types/request.js';

// Re-export types for convenience
export type {
  QueryRequest,
  QueryResponse,
  VerifyRequest,
  VerifyResponse,
  GatewayError,
} from './types/request.js';
