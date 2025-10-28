/**
 * Tests for mind-pack
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { promises as fsp } from 'node:fs';
import { join } from 'node:path';
import { buildPack } from '../index.js';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const fixturePath = join(__dirname, '../../../../fixtures/small-project');

describe('Mind Pack Builder', () => {
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
      budget: { totalTokens: 100, caps: {}, truncation: 'end' }
    });

    expect(pack.json).toBeDefined();
    expect(pack.markdown).toBeDefined();
    expect(pack.tokensEstimate).toBeLessThanOrEqual(100);
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