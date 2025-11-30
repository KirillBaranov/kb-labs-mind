/**
 * Basic test for mind-query functionality
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { executeQuery } from '../api/execute-query';
import { updateIndexes } from '@kb-labs/mind-indexer';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const fixturePath = join(__dirname, '../../../../fixtures/small-project');

describe('Mind Query', () => {
  beforeAll(async () => {
    // Update indexes to generate real data (structure already exists)
    await updateIndexes({
      cwd: fixturePath,
      timeBudgetMs: 5000
    });
  });

  it('should handle meta query', async () => {
    const result = await executeQuery('meta', {}, {
      cwd: fixturePath,
      aiMode: true
    });
    
    expect(result.ok).toBe(true);
    expect(result.query).toBe('meta');
    expect(result.result).toBeDefined();
    expect(result.schemaVersion).toBe('1.0');
  });
  
  it('should handle docs query', async () => {
    const result = await executeQuery('docs', {}, {
      cwd: fixturePath,
      aiMode: false
    });
    
    expect(result.ok).toBe(true);
    expect(result.query).toBe('docs');
    expect(result.result).toBeDefined();
    expect(result.schemaVersion).toBe('1.0');
  });

  it('should handle exports query', async () => {
    const result = await executeQuery('exports', { file: 'src/index.ts' }, {
      cwd: fixturePath,
      aiMode: true
    });
    
    expect(result.ok).toBe(true);
    expect(result.query).toBe('exports');
    expect(result.result).toBeDefined();
    // AI mode may provide summary if implemented
    if (result.summary) {
      expect(result.summary).toBeDefined();
    }
  });

  it('should handle error cases', async () => {
    const result = await executeQuery('meta', {}, {
      cwd: '/nonexistent/path',
      aiMode: false
    });
    
    expect(result.ok).toBe(false);
    expect(result.code).toBe('MIND_QUERY_ERROR');
  });
});
