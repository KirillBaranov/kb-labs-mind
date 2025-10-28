/**
 * Test helpers for KB Labs Mind
 */

import { promises as fsp } from 'node:fs';
import { join } from 'node:path';
import { exec } from 'node:child_process';
import { promisify } from 'node:util';

const execAsync = promisify(exec);

export interface TestProject {
  path: string;
  name: string;
}

export class TestHelper {
  static async createTestProject(fixtureName: string, basePath: string): Promise<TestProject> {
    const { createFixture } = await import('../fixtures/index.js');
    await createFixture(fixtureName, basePath);
    
    return {
      path: basePath,
      name: fixtureName
    };
  }

  static async runMindCommand(projectPath: string, command: string, args: string[] = []): Promise<{ stdout: string; stderr: string; exitCode: number }> {
    const fullCommand = `cd ${projectPath} && npx kb mind ${command} ${args.join(' ')}`;
    
    try {
      const { stdout, stderr } = await execAsync(fullCommand);
      return { stdout, stderr, exitCode: 0 };
    } catch (error: any) {
      return {
        stdout: error.stdout || '',
        stderr: error.stderr || '',
        exitCode: error.code || 1
      };
    }
  }

  static async readIndexFile(projectPath: string, filename: string): Promise<any> {
    const indexPath = join(projectPath, '.kb', 'mind', filename);
    const content = await fsp.readFile(indexPath, 'utf8');
    return JSON.parse(content);
  }

  static async indexExists(projectPath: string, filename: string): Promise<boolean> {
    try {
      const indexPath = join(projectPath, '.kb', 'mind', filename);
      await fsp.access(indexPath);
      return true;
    } catch {
      return false;
    }
  }

  static async getIndexFiles(projectPath: string): Promise<string[]> {
    try {
      const mindDir = join(projectPath, '.kb', 'mind');
      const files = await fsp.readdir(mindDir);
      return files.filter(f => f.endsWith('.json'));
    } catch {
      return [];
    }
  }

  static async waitForFile(filePath: string, timeoutMs: number = 5000): Promise<boolean> {
    const start = Date.now();
    
    while (Date.now() - start < timeoutMs) {
      try {
        await fsp.access(filePath);
        return true;
      } catch {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }
    
    return false;
  }

  static async compareFiles(file1: string, file2: string): Promise<boolean> {
    try {
      const content1 = await fsp.readFile(file1, 'utf8');
      const content2 = await fsp.readFile(file2, 'utf8');
      return content1 === content2;
    } catch {
      return false;
    }
  }

  static async measureTime<T>(fn: () => Promise<T>): Promise<{ result: T; duration: number }> {
    const start = Date.now();
    const result = await fn();
    const duration = Date.now() - start;
    return { result, duration };
  }
}
