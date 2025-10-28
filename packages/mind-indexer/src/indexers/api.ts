/**
 * API indexer for KB Labs Mind
 */

import { promises as fsp } from 'node:fs';
import { join } from 'node:path';
import { TSExtractor } from '../adapters/ts-extractor.js';
import { sha256 } from '@kb-labs/mind-core';
import { ensureMindStructure } from '../fs/ensure.js';
import type { ApiIndex as _ApiIndex, ApiFile, ApiExport as _ApiExport } from '@kb-labs/mind-types';
import type { IndexerContext } from '../types/index.js';

/**
 * Recursively find TypeScript/JavaScript files
 */
async function findTsFiles(dir: string, files: string[]): Promise<void> {
  try {
    const entries = await fsp.readdir(dir, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = join(dir, entry.name);
      
      // Skip excluded directories
      if (entry.isDirectory()) {
        if (entry.name === 'node_modules' || 
            entry.name === '.git' || 
            entry.name === '.kb' ||
            entry.name === 'dist' ||
            entry.name === 'coverage' ||
            entry.name === 'fixtures' ||
            entry.name === '__tests__') {
          continue;
        }
        await findTsFiles(fullPath, files);
      } else if (entry.isFile()) {
        // Check if it's a TypeScript/JavaScript file
        if (entry.name.match(/\.(ts|tsx|js|jsx)$/) && 
            !entry.name.endsWith('.d.ts') && 
            !entry.name.endsWith('.map')) {
          files.push(fullPath);
        }
      }
    }
      } catch {
    // Skip directories we can't read
  }
}

/**
 * Index API exports from TypeScript/JavaScript files
 */
export async function indexApiFiles(
  ctx: IndexerContext,
  filePaths: string[]
): Promise<{ added: number; updated: number; removed: number }> {
  // Ensure mind structure exists
  await ensureMindStructure(ctx.cwd);
  
  const extractor = new TSExtractor();
  const added = 0;
  let updated = 0;
  let removed = 0;

  // If no file paths provided, find all TypeScript/JavaScript files
  let filesToProcess = filePaths;
  if (filesToProcess.length === 0) {
    const allFiles: string[] = [];
    await findTsFiles(ctx.cwd, allFiles);
    filesToProcess = allFiles.map(f => f.replace(ctx.cwd + '/', ''));
  }

  for (const filePath of filesToProcess) {
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

      // Update API index with this file
      ctx.apiIndex.files[filePath] = apiFile;
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

  // Sort exports deterministically by name for each file
  for (const [_filePath, apiFile] of Object.entries(ctx.apiIndex.files)) {
    if (apiFile.exports) {
      apiFile.exports.sort((a, b) => a.name.localeCompare(b.name));
    }
  }

  // Save API index to file with sorted keys
  const { writeJson } = await import('../fs/json.js');
  const { getGenerator } = await import('@kb-labs/mind-core');
  
  const generator = getGenerator();
  
  // Create sorted files object for deterministic output
  const sortedFiles: Record<string, any> = {};
  const sortedKeys = Object.keys(ctx.apiIndex.files).sort();
  for (const key of sortedKeys) {
    sortedFiles[key] = ctx.apiIndex.files[key];
  }
  
  const apiIndex = {
    schemaVersion: "1.0",
    generator,
    files: sortedFiles
  };
  await writeJson(`${ctx.cwd}/.kb/mind/api-index.json`, apiIndex);

  return { added, updated, removed };
}
