/**
 * Gateway handler for /mind/verify endpoint
 */

import type { VerifyRequest, VerifyResponse, GatewayError } from '../types/request';
import { verifyIndexes as verifyIndexesUtil } from '@kb-labs/mind-core';

export async function handleVerify(req: VerifyRequest): Promise<VerifyResponse | GatewayError> {
  try {
    const cwd = req.cwd || '.';
    return await verifyIndexesUtil(cwd);
  } catch (error: any) {
    return {
      ok: false,
      code: 'MIND_GATEWAY_ERROR',
      message: error.message,
      hint: 'Check workspace permissions and structure'
    };
  }
}

