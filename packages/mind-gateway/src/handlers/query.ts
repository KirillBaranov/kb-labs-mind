/**
 * Gateway handler for /mind/query endpoint
 */

import type { QueryRequest, QueryResponse, GatewayError } from '../types/request';
import { executeQuery } from '@kb-labs/mind-query';

export async function handleQuery(req: QueryRequest): Promise<QueryResponse | GatewayError> {
  try {
    // Validate request
    if (!req.query) {
      return {
        ok: false,
        code: 'MIND_BAD_REQUEST',
        message: 'Missing query parameter',
        hint: 'Provide a valid query name'
      };
    }

    if (!req.params) {
      return {
        ok: false,
        code: 'MIND_BAD_REQUEST',
        message: 'Missing params parameter',
        hint: 'Provide query parameters'
      };
    }

    // Execute query
    const result = await executeQuery(
      req.query as any,
      req.params,
      {
        cwd: req.options?.cwd || '.',
        limit: req.options?.limit || 500,
        depth: req.options?.depth || 5,
        cacheTtl: req.options?.cacheTtl || 60,
        noCache: req.options?.noCache || false,
        pathMode: req.options?.pathMode || 'id',
        aiMode: req.options?.aiMode || false
      }
    );

    return result;
  } catch (error: any) {
    return {
      ok: false,
      code: 'MIND_GATEWAY_ERROR',
      message: error.message,
      hint: 'Check query parameters and workspace state'
    };
  }
}
