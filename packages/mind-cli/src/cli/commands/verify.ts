/**
 * Mind verify command
 */

import type { CommandModule } from '../types.js';
import { promises as fsp } from 'node:fs';
import { join } from 'node:path';
import { sha256 } from '@kb-labs/mind-core';
import type { MindIndex, ApiIndex, DepsGraph, RecentDiff } from '@kb-labs/mind-types';
import {
  TimingTracker,
  formatTiming,
} from '@kb-labs/shared-cli-ui';
import { MIND_ERROR_CODES } from '../../errors/error-codes.js';
import { runScope, type AnalyticsEventV1, type EmitResult } from '@kb-labs/analytics-sdk-node';
import { ANALYTICS_EVENTS, ANALYTICS_ACTOR } from '../../infra/analytics/events.js';

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

/**
 * Verify mind workspace consistency
 */
export const run: CommandModule['run'] = async (ctx, argv, flags): Promise<number | void> => {
  const cwd = typeof flags.cwd === 'string' && flags.cwd ? flags.cwd : ctx.cwd;

  return (await runScope(
    {
      actor: ANALYTICS_ACTOR,
      ctx: { workspace: cwd },
    },
    async (emit: (event: Partial<AnalyticsEventV1>) => Promise<EmitResult>) => {
      const tracker = new TimingTracker();
      
      try {
        tracker.checkpoint('start');
        
        // Track command start
        await emit({
          type: ANALYTICS_EVENTS.VERIFY_STARTED,
          payload: {},
        });
        
        const mindDir = join(cwd, '.kb', 'mind');
        
        // Check if mind directory exists
        try {
          await fsp.access(mindDir);
        } catch {
          const duration = tracker.total();
          await emit({
            type: ANALYTICS_EVENTS.VERIFY_FINISHED,
            payload: {
              ok: false,
              filesChecked: 0,
              inconsistenciesCount: 0,
              durationMs: duration,
              result: 'failed',
              error: 'Mind structure not initialized',
            },
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
              timingMs: duration
            }
          };
          
          ctx.output.error(new Error('Mind structure not initialized'), {
            code: MIND_ERROR_CODES.VERIFY_FAILED,
            suggestions: ['Run: kb mind init'],
          });
          return 1;
        }

        tracker.checkpoint('load-start');
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
        tracker.checkpoint('load-complete');

        tracker.checkpoint('verify-start');
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
              inconsistencies.push({
                file: 'index.json',
                expected: index.indexChecksum,
                actual: actualChecksum,
                type: 'checksum'
              });
            }
          }
        }
        tracker.checkpoint('verify-complete');
        
        const duration = tracker.total();
        const result: VerifyResult = {
          ok: inconsistencies.length === 0,
          code: inconsistencies.length > 0 ? 'MIND_INDEX_INCONSISTENT' : null,
          inconsistencies,
          hint: inconsistencies.length > 0 ? 'Run: kb mind update' : undefined,
          schemaVersion: '1.0',
          meta: {
            cwd,
            filesChecked,
            timingMs: duration
          }
        };

        if (ctx.output.isJSON) {
          ctx.output.json(result);
        } else {
          if (!ctx.output.isQuiet) {
            const { ui } = ctx.output;
            if (result.ok) {
              const summaryLines: string[] = [];
              summaryLines.push(
                ...ui.keyValue({
                  'Files Checked': String(filesChecked),
                }),
              );
              summaryLines.push('', renderStatusLine('Workspace consistent', 'success', duration, ctx.output));
              ctx.output.write('\n' + ui.box('Mind Verify', summaryLines));
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
              summaryLines.push('', renderStatusLine('Inconsistencies found', 'warning', duration, ctx.output));
              ctx.output.write('\n' + ui.box('Mind Verify', summaryLines));
            }
          }
        }

        // Track command completion
        await emit({
          type: ANALYTICS_EVENTS.VERIFY_FINISHED,
          payload: {
            ok: result.ok,
            filesChecked,
            inconsistenciesCount: inconsistencies.length,
            durationMs: duration,
            result: result.ok ? 'success' : 'failed',
          },
        });

        // Return appropriate code
        return inconsistencies.length > 0 ? 1 : 0;

      } catch (error: any) {
        const duration = tracker.total();
        const errorResult: VerifyResult = {
          ok: false,
          code: 'MIND_VERIFY_ERROR',
          inconsistencies: [],
          hint: 'Check file permissions and try again',
          schemaVersion: '1.0',
          meta: {
            cwd,
            filesChecked: 0,
            timingMs: duration
          }
        };

        // Track command failure
        await emit({
          type: ANALYTICS_EVENTS.VERIFY_FINISHED,
          payload: {
            ok: false,
            filesChecked: 0,
            inconsistenciesCount: 0,
            durationMs: duration,
            result: 'error',
            error: error.message,
          },
        });

        ctx.output.error(error instanceof Error ? error : new Error(error.message || 'Verification failed'), {
          code: MIND_ERROR_CODES.VERIFY_FAILED,
          suggestions: ['Check file permissions and try again'],
        });

        return 1;
      }
    }
  )) as number | void;
};

type StatusKind = 'success' | 'warning' | 'error';

function renderStatusLine(label: string, kind: StatusKind, durationMs: number, output: any): string {
  const { ui } = output;
  const symbol =
    kind === 'error' ? ui.symbols.error : kind === 'warning' ? ui.symbols.warning : ui.symbols.success;
  const color =
    kind === 'error' ? ui.colors.error : kind === 'warning' ? ui.colors.warn : ui.colors.success;

  return `${symbol} ${color(label)} · ${ui.colors.muted(formatTiming(durationMs))}`;
}