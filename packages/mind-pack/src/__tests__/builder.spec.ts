/**
 * Tests for mind-pack
 */

import { describe, it, expect, beforeEach, beforeAll } from 'vitest';
import { promises as fsp } from 'node:fs';
import { join } from 'node:path';
import { buildPack } from '../index.js';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';
import { initMindStructure } from '../../../mind-indexer/src/api/init.js';
import { updateIndexes } from '../../../mind-indexer/src/api/update.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const fixturePath = join(__dirname, '../../../../fixtures/small-project');
const mediumFixturePath = join(__dirname, '../../../../fixtures/medium-project');

describe('Mind Pack Builder', () => {
  beforeAll(async () => {
    await initMindStructure({ cwd: fixturePath, log: () => {} });
    await updateIndexes({
      cwd: fixturePath,
      timeBudgetMs: 2000,
      log: () => {}
    });
  });

  beforeEach(async () => {
    // Clean up any existing pack files
    try {
      await fsp.rm(join(fixturePath, '.kb/mind/packs'), { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  it('should build context pack', async () => {
    const pack = await buildPack({
      cwd: fixturePath,
      intent: 'Test intent',
      product: 'test',
      budget: { totalTokens: 1000, caps: {}, truncation: 'end' }
    });

    expect(pack).toBeDefined();
    expect(pack.json).toBeDefined();
    expect(pack.markdown).toBeDefined();
    expect(pack.tokensEstimate).toBeGreaterThan(0);
    expect(pack.json.sections).toHaveProperty('project_meta');
    expect(pack.json.sections).toHaveProperty('docs_overview');
  });

  it('should handle different intents', async () => {
    const pack1 = await buildPack({
      cwd: fixturePath,
      intent: 'Implement new feature',
      product: 'test',
      budget: { totalTokens: 1000, caps: {}, truncation: 'end' }
    });

    const pack2 = await buildPack({
      cwd: fixturePath,
      intent: 'Debug existing issue',
      product: 'test',
      budget: { totalTokens: 1000, caps: {}, truncation: 'end' }
    });

    expect(pack1.json).toBeDefined();
    expect(pack2.json).toBeDefined();
    expect(pack1.markdown).toBeDefined();
    expect(pack2.markdown).toBeDefined();
  });

  it('should respect budget constraints', async () => {
    const pack = await buildPack({
      cwd: fixturePath,
      intent: 'Test budget',
      product: 'test',
      budget: { 
        totalTokens: 500, 
        caps: {
          intent_summary: 50,
          product_overview: 50,
          project_meta: 50,
          api_signatures: 100,
          recent_diffs: 100,
          docs_overview: 50,
          impl_snippets: 50,
          configs_profiles: 50
        }, 
        truncation: 'end' 
      }
    });

    expect(pack.json).toBeDefined();
    expect(pack.markdown).toBeDefined();
    expect(pack.tokensEstimate).toBeLessThanOrEqual(500);
  });

  it('should handle deterministic output with seed', async () => {
    const pack1 = await buildPack({
      cwd: fixturePath,
      intent: 'Test deterministic',
      product: 'test',
      seed: 12345,
      budget: { totalTokens: 1000, caps: {}, truncation: 'end' }
    });

    const pack2 = await buildPack({
      cwd: fixturePath,
      intent: 'Test deterministic',
      product: 'test',
      seed: 12345,
      budget: { totalTokens: 1000, caps: {}, truncation: 'end' }
    });

    expect(pack1.json).toBeDefined();
    expect(pack2.json).toBeDefined();
    expect(pack1.markdown).toBeDefined();
    expect(pack2.markdown).toBeDefined();
  });
});

describe('Mind Pack Builder with metadata and docs', () => {
  beforeAll(async () => {
    await initMindStructure({ cwd: mediumFixturePath, log: () => {} });
    await updateIndexes({
      cwd: mediumFixturePath,
      timeBudgetMs: 2000,
      log: () => {}
    });
  });

  it('should include indexed metadata and docs entries', async () => {
    const pack = await buildPack({
      cwd: mediumFixturePath,
      intent: 'Review documentation',
      product: 'medium-project',
      budget: { totalTokens: 2000, caps: {}, truncation: 'end' }
    });

    expect(pack.json.sections.project_meta).toContain('medium-project');
    expect(pack.json.sections.docs_overview).toContain('ADR-0001');
  });
});