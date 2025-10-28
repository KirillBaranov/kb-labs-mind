/**
 * Centralized error handling for KB Labs Mind Query
 */

import type { MindErrorCode } from '@kb-labs/mind-types';

export interface MindError {
  ok: false;
  code: MindErrorCode;
  message: string;
  hint?: string;
  details?: any;
}

export interface MindSuccess<T = any> {
  ok: true;
  data: T;
}

export type MindResult<T = any> = MindSuccess<T> | MindError;

/**
 * Create a standardized error response
 */
export function createError(
  code: MindErrorCode,
  message: string,
  hint?: string,
  details?: any
): MindError {
  return {
    ok: false,
    code,
    message,
    hint,
    details
  };
}

/**
 * Create a standardized success response
 */
export function createSuccess<T>(data: T): MindSuccess<T> {
  return {
    ok: true,
    data
  };
}

/**
 * Common error messages with hints
 */
export const ErrorMessages = {
  QUERY_NOT_FOUND: {
    message: 'Query not found',
    hint: 'Available queries: impact, scope, exports, externals, chain, meta, docs'
  },
  
  INVALID_PARAMS: {
    message: 'Invalid query parameters',
    hint: 'Check required flags for this query type'
  },
  
  FILE_NOT_FOUND: {
    message: 'File not found',
    hint: 'Ensure the file path exists and is accessible'
  },
  
  INDEX_NOT_FOUND: {
    message: 'Mind index not found',
    hint: 'Run "kb mind init" to initialize the workspace'
  },
  
  INDEX_CORRUPTED: {
    message: 'Mind index is corrupted',
    hint: 'Run "kb mind update" to refresh indexes'
  },
  
  PERMISSION_DENIED: {
    message: 'Permission denied',
    hint: 'Check file permissions and workspace access'
  },
  
  TIMEOUT: {
    message: 'Operation timed out',
    hint: 'Try increasing time budget or reducing scope'
  },
  
  CACHE_ERROR: {
    message: 'Cache operation failed',
    hint: 'Cache is optional, operation will continue without caching'
  }
} as const;

/**
 * Create error from common error types
 */
export function createCommonError(
  type: keyof typeof ErrorMessages,
  code: MindErrorCode,
  details?: any
): MindError {
  const errorInfo = ErrorMessages[type];
  return createError(code, errorInfo.message, errorInfo.hint, details);
}

/**
 * Wrap async operations with error handling
 */
export async function withErrorHandling<T>(
  operation: () => Promise<T>,
  errorCode: MindErrorCode,
  context?: string
): Promise<MindResult<T>> {
  try {
    const data = await operation();
    return createSuccess(data);
  } catch (error: any) {
    const message = context ? `${context}: ${error.message}` : error.message;
    return createError(errorCode, message, undefined, { originalError: error.message });
  }
}

/**
 * Validate query parameters
 */
export function validateQueryParams(
  queryName: string,
  params: Record<string, any>,
  required: string[]
): MindError | null {
  const missing = required.filter(key => !params[key]);
  
  if (missing.length > 0) {
    return createError(
      'MIND_INVALID_FLAG',
      `Missing required parameters: ${missing.join(', ')}`,
      `Query '${queryName}' requires: ${required.join(', ')}`
    );
  }
  
  return null;
}

/**
 * Check if result is an error
 */
export function isError<T>(result: MindResult<T>): result is MindError {
  return !result.ok;
}

/**
 * Check if result is success
 */
export function isSuccess<T>(result: MindResult<T>): result is MindSuccess<T> {
  return result.ok;
}
