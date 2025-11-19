/**
 * Mind verify command
 */

import { defineCommand, type CommandResult } from '@kb-labs/cli-command-kit';
import { promises as fsp } from 'node:fs';
import { join } from 'node:path';
import { sha256 } from '@kb-labs/mind-core';
import type { MindIndex, ApiIndex, DepsGraph, RecentDiff } from '@kb-labs/mind-types';
import {
  formatTiming,
} from '@kb-labs/shared-cli-ui';
import { MIND_ERROR_CODES } from '../../errors/error-codes.js';
import { ANALYTICS_EVENTS, ANALYTICS_ACTOR } from '../../infra/analytics/events.js';

type MindVerifyFlags = {
  cwd: { type: 'string'; description?: string };
  json: { type: 'boolean'; description?: string; default?: boolean };
  quiet: { type: 'boolean'; description?: string; default?: boolean };
};

interface VerifyResult {
  ok: boolean;
  code: string | null;
  inconsistencies: Array<{
    file: string;
    expected: string;
    actual: string;
    type: 'hash' | 'checksum';
  }>;
  hint?: string;
  schemaVersion: string;
  meta: {
    cwd: string;
    filesChecked: number;
    timingMs: number;
  };
}

type MindVerifyResult = CommandResult & VerifyResult;

/**
 * Read JSON file safely
 */
async function readJsonSafely<T>(path: string): Promise<T | null> {
  try {
    const content = await fsp.readFile(path, 'utf8');
    return JSON.parse(content) as T;
  } catch {
    return null;
  }
}

/**
 * Compute hash of JSON object
 */
function computeJsonHash(obj: any): string {
  return sha256(JSON.stringify(obj));
}

type StatusKind = 'success' | 'warning' | 'error';

function renderStatusLine(label: string, kind: StatusKind, durationMs: number, output: any): string {
  const { ui } = output;
  const symbol =
    kind === 'error' ? ui.symbols.error : kind === 'warning' ? ui.symbols.warning : ui.symbols.success;
  const color =
    kind === 'error' ? ui.colors.error : kind === 'warning' ? ui.colors.warn : ui.colors.success;

  return `${symbol} ${color(label)} · ${ui.colors.muted(formatTiming(durationMs))}`;
}

/**
 * Verify mind workspace consistency
 */
export const run = defineCommand({
  name: 'mind:verify',
  flags: {
    cwd: {
      type: 'string',
      description: 'Working directory',
    },
    json: {
      type: 'boolean',
      description: 'Output in JSON format',
      default: false,
    },
    quiet: {
      type: 'boolean',
      description: 'Quiet output',
      default: false,
    },
  },
  analytics: {
    startEvent: ANALYTICS_EVENTS.VERIFY_STARTED,
    finishEvent: ANALYTICS_EVENTS.VERIFY_FINISHED,
    actor: ANALYTICS_ACTOR.id,
  },
  async handler(ctx, argv, flags) {
    const cwd = flags.cwd || ctx.cwd;
    
    ctx.tracker.checkpoint('start');
    
    ctx.logger?.info('Mind verify started', {
      cwd,
      command: 'mind:verify',
    });
    
    const mindDir = join(cwd, '.kb', 'mind');
    
    // Check if mind directory exists
    try {
      await fsp.access(mindDir);
      ctx.logger?.debug('Mind directory found', { mindDir });
    } catch {
      ctx.logger?.warn('Mind structure not initialized', {
        cwd,
        mindDir,
        hint: 'Run: kb mind init',
      });
      
      const error: VerifyResult = {
        ok: false,
        code: 'MIND_NO_INDEX',
        inconsistencies: [],
        hint: 'Run: kb mind init',
        schemaVersion: '1.0',
        meta: {
          cwd,
          filesChecked: 0,
          timingMs: ctx.tracker.total()
        }
      };
      
      if (flags.json) {
        ctx.output?.json(error);
      } else {
        ctx.output?.error(new Error('Mind structure not initialized'), {
          code: MIND_ERROR_CODES.VERIFY_FAILED,
          suggestions: ['Run: kb mind init'],
        });
      }
      return { ok: false, exitCode: 1, result: error };
    }

    ctx.tracker.checkpoint('load-start');
    ctx.logger?.debug('Loading index files', { mindDir });
    
    // Load all index files
    const [index, apiIndex, depsGraph, recentDiff, meta, docsPrimary, docsLegacy] = await Promise.all([
      readJsonSafely<MindIndex>(join(mindDir, 'index.json')),
      readJsonSafely<ApiIndex>(join(mindDir, 'api-index.json')),
      readJsonSafely<DepsGraph>(join(mindDir, 'deps.json')),
      readJsonSafely<RecentDiff>(join(mindDir, 'recent-diff.json')),
      readJsonSafely<any>(join(mindDir, 'meta.json')),
      readJsonSafely<any>(join(mindDir, 'docs.json')),
      readJsonSafely<any>(join(mindDir, 'docs-index.json'))
    ]);
    const docs = docsPrimary ?? docsLegacy ?? null;
    ctx.tracker.checkpoint('load-complete');
    
    ctx.logger?.info('Index files loaded', {
      hasIndex: !!index,
      hasApiIndex: !!apiIndex,
      hasDepsGraph: !!depsGraph,
      hasRecentDiff: !!recentDiff,
      hasMeta: !!meta,
      hasDocs: !!docs,
    });

    ctx.tracker.checkpoint('verify-start');
    ctx.logger?.debug('Starting verification', {});
    
    const inconsistencies: Array<{
      file: string;
      expected: string;
      actual: string;
      type: 'hash' | 'checksum';
    }> = [];

    let filesChecked = 0;

    // Verify individual file hashes
    if (index) {
      filesChecked++;
      
      // Check API index hash
      if (apiIndex && index.apiIndexHash) {
        const actualHash = computeJsonHash(apiIndex);
        if (actualHash !== index.apiIndexHash) {
          ctx.logger?.warn('API index hash mismatch', {
            file: 'api-index.json',
            expected: index.apiIndexHash,
            actual: actualHash,
          });
          inconsistencies.push({
            file: 'api-index.json',
            expected: index.apiIndexHash,
            actual: actualHash,
            type: 'hash'
          });
        }
      }

      // Check deps hash
      if (depsGraph && index.depsHash) {
        const actualHash = computeJsonHash(depsGraph);
        if (actualHash !== index.depsHash) {
          inconsistencies.push({
            file: 'deps.json',
            expected: index.depsHash,
            actual: actualHash,
            type: 'hash'
          });
        }
      }

      // Check recentDiff hash (only if it exists)
      if (recentDiff && index.recentDiffHash && recentDiff.files?.length > 0) {
        const actualHash = computeJsonHash(recentDiff);
        if (actualHash !== index.recentDiffHash) {
          inconsistencies.push({
            file: 'recent-diff.json',
            expected: index.recentDiffHash,
            actual: actualHash,
            type: 'hash'
          });
        }
      }

      // Check combined checksum
      if (index.indexChecksum) {
        interface ChecksumInput {
          apiIndex: ApiIndex;
          deps: DepsGraph;
          meta: any;
          docs: any;
          recentDiff?: RecentDiff;
        }

        const hashInputs: ChecksumInput = {
          apiIndex: apiIndex || { schemaVersion: '1.0', generator: '', files: {} },
          deps: depsGraph || { schemaVersion: '1.0', generator: '', root: '', packages: {}, edges: [] },
          meta: meta || {},
          docs: docs || {}
        };

        // Only include recentDiff if present (same logic as update.ts)
        if (recentDiff?.files && recentDiff.files.length > 0) {
          hashInputs.recentDiff = recentDiff;
        }

        const actualChecksum = sha256(JSON.stringify(hashInputs));
        if (actualChecksum !== index.indexChecksum) {
          ctx.logger?.warn('Index checksum mismatch', {
            file: 'index.json',
            expected: index.indexChecksum,
            actual: actualChecksum,
          });
          inconsistencies.push({
            file: 'index.json',
            expected: index.indexChecksum,
            actual: actualChecksum,
            type: 'checksum'
          });
        }
      }
    }
    ctx.tracker.checkpoint('verify-complete');
    
    ctx.logger?.info('Verification completed', {
      filesChecked,
      inconsistenciesCount: inconsistencies.length,
      ok: inconsistencies.length === 0,
    });
    
    const result: VerifyResult = {
      ok: inconsistencies.length === 0,
      code: inconsistencies.length > 0 ? 'MIND_INDEX_INCONSISTENT' : null,
      inconsistencies,
      hint: inconsistencies.length > 0 ? 'Run: kb mind update' : undefined,
      schemaVersion: '1.0',
      meta: {
        cwd,
        filesChecked,
        timingMs: ctx.tracker.total()
      }
    };

    if (flags.json) {
      ctx.output?.json(result);
    } else {
      if (!flags.quiet) {
        const { ui } = ctx.output!;
        if (result.ok) {
          const summaryLines: string[] = [];
          summaryLines.push(
            ...ui.keyValue({
              'Files Checked': String(filesChecked),
            }),
          );
          summaryLines.push('', renderStatusLine('Workspace consistent', 'success', ctx.tracker.total(), ctx.output));
          ctx.output?.write('\n' + ui.box('Mind Verify', summaryLines));
        } else {
          const summaryLines: string[] = [];
          summaryLines.push(
            ...ui.keyValue({
              'Files Checked': String(filesChecked),
              Inconsistencies: String(inconsistencies.length),
            }),
          );

          if (inconsistencies.length > 0) {
            summaryLines.push('');
            summaryLines.push(ui.colors.bold('Details'));
            for (const inc of inconsistencies) {
              summaryLines.push(ui.colors.muted(`- ${inc.file} (${inc.type} mismatch)`));
            }
          }

          summaryLines.push('');
          summaryLines.push(ui.colors.muted('Hint: Run kb mind update'));
          summaryLines.push('', renderStatusLine('Inconsistencies found', 'warning', ctx.tracker.total(), ctx.output));
          ctx.output?.write('\n' + ui.box('Mind Verify', summaryLines));
        }
      }
    }

    // Return appropriate code
    return inconsistencies.length > 0 ? { ok: false, exitCode: 1, result } : { ok: true, result };
  },
  async onError(error, ctx, flags) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    
    ctx.logger?.error('Verification failed', {
      error: errorMessage,
      cwd: flags.cwd || ctx.cwd,
    });
    
    const errorResult: VerifyResult = {
      ok: false,
      code: 'MIND_VERIFY_ERROR',
      inconsistencies: [],
      hint: 'Check file permissions and try again',
      schemaVersion: '1.0',
      meta: {
        cwd: flags.cwd || ctx.cwd,
        filesChecked: 0,
        timingMs: ctx.tracker.total()
      }
    };

    if (flags.json) {
      ctx.output?.json(errorResult);
    } else {
      ctx.output?.error(error instanceof Error ? error : new Error(errorMessage), {
        code: MIND_ERROR_CODES.VERIFY_FAILED,
        suggestions: ['Check file permissions and try again'],
      });
    }

    return { ok: false, exitCode: 1, result: errorResult };
  },
});
