/**
 * Tests for git adapters
 */

import { describe, it, expect, vi } from 'vitest';
import { gitDiffSince, listStagedFiles } from '../index.js';

// Mock child_process
vi.mock('node:child_process', () => ({
  spawn: vi.fn()
}));

describe('Git Adapters', () => {
  it('should handle git diff since revision', async () => {
    const { spawn } = await import('node:child_process');
    const mockSpawn = vi.mocked(spawn);
    
    // Mock successful git diff
    mockSpawn.mockImplementation((cmd, args, opts) => {
      const mockProcess = {
        on: vi.fn((event, callback) => {
          if (event === 'close') {
            setTimeout(() => callback(0), 10);
          }
        }),
        stdout: {
          on: vi.fn((event, callback) => {
            if (event === 'data') {
              setTimeout(() => callback('M\tfile1.ts\nA\tfile2.ts'), 10);
            }
          })
        }
      } as any;
      return mockProcess;
    });

    const result = await gitDiffSince('/test', 'HEAD~1');
    
    expect(result.schemaVersion).toBe('1.0');
    expect(result.since).toBe('HEAD~1');
    expect(result.files).toHaveLength(2);
    expect(result.files[0]).toEqual({ path: 'file1.ts', status: 'M' });
    expect(result.files[1]).toEqual({ path: 'file2.ts', status: 'A' });
  });

  it('should handle git staged files', async () => {
    const { spawn } = await import('node:child_process');
    const mockSpawn = vi.mocked(spawn);
    
    // Mock successful git status
    mockSpawn.mockImplementation((cmd, args, opts) => {
      const mockProcess = {
        on: vi.fn((event, callback) => {
          if (event === 'close') {
            setTimeout(() => callback(0), 10);
          }
        }),
        stdout: {
          on: vi.fn((event, callback) => {
            if (event === 'data') {
              setTimeout(() => callback('file1.ts\nfile2.ts\n'), 10);
            }
          })
        }
      } as any;
      return mockProcess;
    });

    const result = await listStagedFiles('/test');
    
    expect(result).toEqual(['file1.ts', 'file2.ts']);
  });
});
