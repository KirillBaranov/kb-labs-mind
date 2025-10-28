/**
 * Gateway utilities
 */

import { readJson, computeJsonHash } from '@kb-labs/mind-indexer';
import { sha256 } from '@kb-labs/mind-core';
import { promises as fsp } from 'node:fs';

export interface VerifyResult {
  ok: boolean;
  code: string | null;
  inconsistencies: string[];
  hint: string;
}

export async function verifyIndexes(cwd: string): Promise<VerifyResult> {
  const inconsistencies: string[] = [];
  
  try {
    // Load main index
    const index = await readJson(`${cwd}/.kb/mind/index.json`);
    if (!index) {
      return {
        ok: false,
        code: 'MIND_NO_INDEX',
        inconsistencies: ['Main index file not found'],
        hint: 'Run "kb mind init" to initialize the workspace'
      };
    }
    
    // Load all index files
    const [apiIndex, depsGraph, recentDiff, meta, docs] = await Promise.all([
      readJson(`${cwd}/.kb/mind/api-index.json`),
      readJson(`${cwd}/.kb/mind/deps.json`),
      readJson(`${cwd}/.kb/mind/recent-diff.json`),
      readJson(`${cwd}/.kb/mind/meta.json`),
      readJson(`${cwd}/.kb/mind/docs.json`)
    ]);
    
    // Verify individual file hashes
    if (apiIndex) {
      const computedHash = computeJsonHash(apiIndex);
      if (computedHash !== index.apiIndexHash) {
        inconsistencies.push(`API index hash mismatch: expected ${index.apiIndexHash}, got ${computedHash}`);
      }
    } else if (index.apiIndexHash) {
      inconsistencies.push('API index file missing but hash is present');
    }
    
    if (depsGraph) {
      const computedHash = computeJsonHash(depsGraph);
      if (computedHash !== index.depsHash) {
        inconsistencies.push(`Dependencies hash mismatch: expected ${index.depsHash}, got ${computedHash}`);
      }
    } else if (index.depsHash) {
      inconsistencies.push('Dependencies file missing but hash is present');
    }
    
    if (recentDiff) {
      const computedHash = computeJsonHash(recentDiff);
      if (computedHash !== index.recentDiffHash) {
        inconsistencies.push(`Recent diff hash mismatch: expected ${index.recentDiffHash}, got ${computedHash}`);
      }
    } else if (index.recentDiffHash) {
      inconsistencies.push('Recent diff file missing but hash is present');
    }
    
    // Verify combined index checksum
    const combinedContent = JSON.stringify({
      apiIndex: apiIndex || {},
      deps: depsGraph || {},
      recentDiff: recentDiff || {},
      meta: meta || {},
      docs: docs || {}
    });
    const computedChecksum = sha256(combinedContent);
    
    if (computedChecksum !== index.indexChecksum) {
      inconsistencies.push(`Index checksum mismatch: expected ${index.indexChecksum}, got ${computedChecksum}`);
    }
    
    // Check for missing files that should exist
    const expectedFiles = ['api-index.json', 'deps.json', 'recent-diff.json'];
    for (const file of expectedFiles) {
      try {
        await fsp.access(`${cwd}/.kb/mind/${file}`);
      } catch {
        inconsistencies.push(`Required index file missing: ${file}`);
      }
    }
    
    const ok = inconsistencies.length === 0;
    const code = ok ? null : 'MIND_INDEX_INCONSISTENT';
    const hint = ok 
      ? 'All indexes are consistent and up to date'
      : 'Run "kb mind update" to refresh indexes';
    
    return { ok, code, inconsistencies, hint };
  } catch (error: any) {
    return {
      ok: false,
      code: 'MIND_VERIFY_ERROR',
      inconsistencies: [`Verification failed: ${error.message}`],
      hint: 'Check file permissions and workspace structure'
    };
  }
}
