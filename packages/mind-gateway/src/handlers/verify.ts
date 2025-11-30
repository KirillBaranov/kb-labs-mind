/**
 * Gateway handler for /mind/verify endpoint
 */

import type { VerifyRequest, VerifyResponse, GatewayError } from '../types/request';
import { verifyIndexes as verifyIndexesUtil } from './verify-utils';

export async function handleVerify(req: VerifyRequest): Promise<VerifyResponse | GatewayError> {
  try {
    const cwd = req.cwd || '.';
    const result = await verifyIndexesUtil(cwd);
    return result;
  } catch (error: any) {
    return {
      ok: false,
      code: 'MIND_GATEWAY_ERROR',
      message: error.message,
      hint: 'Check workspace permissions and structure'
    };
  }
}

