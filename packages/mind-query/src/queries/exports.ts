/**
 * Exports query for KB Labs Mind Query
 */

import type { ApiIndex, ExportsResult } from '@kb-labs/mind-types';
import { toPosix } from '@kb-labs/mind-core';

export function queryExports(file: string, api: ApiIndex): ExportsResult {
  const normalizedFile = toPosix(file);
  const fileData = api.files[normalizedFile];
  
  if (!fileData) {
    return { exports: [], count: 0 };
  }
  
  return { exports: fileData.exports, count: fileData.exports.length };
}
