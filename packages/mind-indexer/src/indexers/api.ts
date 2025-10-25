/**
 * API indexer for KB Labs Mind
 */

import { promises as fsp } from 'node:fs';
import { join } from 'node:path';
import { TSExtractor } from '../adapters/ts-extractor.js';
import { sha256 } from '@kb-labs/mind-core';
import type { ApiIndex, ApiFile, ApiExport } from '@kb-labs/mind-core';
import type { IndexerContext } from '../types/index.js';

/**
 * Index API exports from TypeScript/JavaScript files
 */
export async function indexApiFiles(
  ctx: IndexerContext,
  filePaths: string[]
): Promise<{ added: number; updated: number; removed: number }> {
  const extractor = new TSExtractor();
  let added = 0;
  let updated = 0;
  let removed = 0;

  for (const filePath of filePaths) {
    try {
      // Check if file exists
      const fullPath = join(ctx.cwd, filePath);
      const exists = await fsp.access(fullPath).then(() => true).catch(() => false);
      
      if (!exists) {
        // File was deleted
        removed++;
        continue;
      }

      // Read file content
      const content = await fsp.readFile(fullPath, 'utf8');
      const size = content.length;
      const sha = sha256(content);

      // Extract exports
      const exports = await extractor.extractExports(filePath, content);

      // Create API file entry
      const apiFile: ApiFile = {
        exports,
        size,
        sha256: sha
      };

      // TODO: Update API index with this file
      // For now, just count as updated
      updated++;

    } catch (error: any) {
      // Fail-open: log warning but continue
      ctx.log({ 
        level: 'warn', 
        code: 'MIND_PARSE_ERROR', 
        msg: `Failed to parse ${filePath}`, 
        error: error.message 
      });
    }
  }

  return { added, updated, removed };
}
