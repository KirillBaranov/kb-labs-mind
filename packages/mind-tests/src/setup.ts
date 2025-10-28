/**
 * Test setup for KB Labs Mind Tests
 */

import { beforeAll, afterAll } from 'vitest';
import { promises as fsp } from 'node:fs';
import { join } from 'node:path';

// Global test setup
beforeAll(async () => {
  // Ensure test fixtures are clean
  const fixturesDir = join(process.cwd(), 'fixtures');
  try {
    await fsp.rm(fixturesDir, { recursive: true, force: true });
  } catch {
    // Ignore if fixtures don't exist
  }
});

afterAll(async () => {
  // Cleanup test artifacts
  const testDirs = [
    join(process.cwd(), 'fixtures'),
    join(process.cwd(), '.kb')
  ];
  
  for (const dir of testDirs) {
    try {
      await fsp.rm(dir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  }
});

// Test utilities
export const testUtils = {
  async createTestProject(structure: Record<string, any>, basePath: string) {
    for (const [path, content] of Object.entries(structure)) {
      const fullPath = join(basePath, path);
      await fsp.mkdir(join(fullPath, '..'), { recursive: true });
      
      if (typeof content === 'string') {
        await fsp.writeFile(fullPath, content, 'utf8');
      } else {
        await fsp.mkdir(fullPath, { recursive: true });
        await this.createTestProject(content, fullPath);
      }
    }
  },
  
  async readJsonFile(path: string) {
    const content = await fsp.readFile(path, 'utf8');
    return JSON.parse(content);
  },
  
  async fileExists(path: string): Promise<boolean> {
    try {
      await fsp.access(path);
      return true;
    } catch {
      return false;
    }
  }
};
