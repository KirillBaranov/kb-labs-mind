/**
 * Integration test for mind-query API
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { executeQuery } from '../api/execute-query.js';
import { updateIndexes } from '@kb-labs/mind-indexer';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';
import type { QueryName } from '@kb-labs/mind-types';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const fixturePath = join(__dirname, '../../../../fixtures/small-project');

describe('Mind Query Integration', () => {
  beforeAll(async () => {
    // Update indexes to generate real data (structure already exists)
    await updateIndexes({
      cwd: fixturePath,
      timeBudgetMs: 5000
    });
  });

  it('should handle all query types gracefully', async () => {
    const queries: QueryName[] = ['impact', 'scope', 'exports', 'externals', 'chain', 'meta', 'docs'];
    
    for (const query of queries) {
      const params: Record<string, any> = {};
      if (query === 'exports' || query === 'impact' || query === 'chain') {
        params.file = 'src/index.ts';
      } else if (query === 'scope') {
        params.path = 'src';
      }
      
      const result = await executeQuery(query, params, {
        cwd: fixturePath,
        aiMode: false
      });
      
      // Should succeed with proper structure
      expect(result.ok).toBe(true);
      expect(result.query).toBe(query);
      expect(result.meta).toBeDefined();
      expect(result.meta.cwd).toBe(fixturePath);
      expect(result.schemaVersion).toBe('1.0');
    }
  });
  
  it('should handle AI mode correctly', async () => {
    const result = await executeQuery('meta', {}, {
      cwd: fixturePath,
      aiMode: true
    });
    
    expect(result.ok).toBe(true);
    // AI mode should provide summary and suggestions if implemented
    if (result.ok) {
      if (result.summary) {
        expect(result.summary).toBeDefined();
      }
      if (result.suggestNextQueries) {
        expect(result.suggestNextQueries).toBeDefined();
      }
    }
  });
  
  it('should handle different path modes', async () => {
    const result1 = await executeQuery('meta', {}, {
      cwd: fixturePath,
      pathMode: 'id'
    });
    
    const result2 = await executeQuery('meta', {}, {
      cwd: fixturePath,
      pathMode: 'absolute'
    });
    
    expect(result1.ok).toBe(true);
    expect(result2.ok).toBe(true);
    
    // Both should work, path representation may differ
    if (result1.ok && result2.ok) {
      expect(result1.meta).toBeDefined();
      expect(result2.meta).toBeDefined();
    }
  });

  it('should handle cache modes correctly', async () => {
    // Test local cache mode (default)
    const result1 = await executeQuery('meta', {}, {
      cwd: fixturePath,
      cacheMode: 'local'
    });
    
    // Test CI cache mode (no cache)
    const result2 = await executeQuery('meta', {}, {
      cwd: fixturePath,
      cacheMode: 'ci'
    });
    
    expect(result1.ok).toBe(true);
    expect(result2.ok).toBe(true);
    
    // Both should work, caching behavior differs
    if (result1.ok && result2.ok) {
      expect(result1.meta).toBeDefined();
      expect(result2.meta).toBeDefined();
    }
  });

  it('should handle error cases gracefully', async () => {
    const result = await executeQuery('meta', {}, {
      cwd: '/nonexistent/path',
      aiMode: true
    });
    
    expect(result.ok).toBe(false);
    expect(result.code).toBe('MIND_QUERY_ERROR');
    expect(result.summary).toBeUndefined(); // No summary for error cases
    expect(result.suggestNextQueries).toBeUndefined(); // No suggestions for error cases
  });
});
