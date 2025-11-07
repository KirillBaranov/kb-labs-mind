/**
 * Mind verify command
 */

import type { CommandModule } from './types';
import { promises as fsp } from 'node:fs';
import { join } from 'node:path';
import { sha256 } from '@kb-labs/mind-core';
import type { MindIndex, ApiIndex, DepsGraph, RecentDiff } from '@kb-labs/mind-types';
import { TimingTracker, box, keyValue, formatTiming, safeColors } from '@kb-labs/shared-cli-ui';
import { runScope, type AnalyticsEventV1, type EmitResult } from '@kb-labs/analytics-sdk-node';
import { ANALYTICS_EVENTS, ANALYTICS_ACTOR } from '../analytics/events';

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
  const json = !!flags.json;
  const quiet = !!flags.quiet;

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
          
          if (json) {
            ctx.presenter.json(error);
          } else {
            ctx.presenter.error('Mind structure not initialized');
            if (!quiet) {
              ctx.presenter.info('Run: kb mind init');
            }
          }
          return 1;
        }

        tracker.checkpoint('load-start');
        // Load all index files
        const [index, apiIndex, depsGraph, recentDiff, meta, docs] = await Promise.all([
          readJsonSafely<MindIndex>(join(mindDir, 'index.json')),
          readJsonSafely<ApiIndex>(join(mindDir, 'api-index.json')),
          readJsonSafely<DepsGraph>(join(mindDir, 'deps.json')),
          readJsonSafely<RecentDiff>(join(mindDir, 'recent-diff.json')),
          readJsonSafely<any>(join(mindDir, 'meta.json')),
          readJsonSafely<any>(join(mindDir, 'docs.json'))
        ]);
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

        if (json) {
          ctx.presenter.json(result);
        } else {
          if (result.ok) {
            if (!quiet) {
              const summaryLines = keyValue({
                'Status': safeColors.success('✓ Consistent'),
                'Files Checked': String(filesChecked),
              });
              
              summaryLines.push('', `Time: ${formatTiming(duration)}`);
              ctx.presenter.write(box('Mind Verify', summaryLines));
            }
          } else {
            const summaryLines = keyValue({
              'Status': safeColors.warning('✗ Inconsistent'),
              'Files Checked': String(filesChecked),
              'Inconsistencies': String(inconsistencies.length),
            });
            
            summaryLines.push('');
            for (const inc of inconsistencies) {
              summaryLines.push(`  • ${inc.file}: ${inc.type} mismatch`);
            }
            
            summaryLines.push('', 'Run: kb mind update');
            summaryLines.push('', `Time: ${formatTiming(duration)}`);
            ctx.presenter.write(box('Mind Verify', summaryLines));
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

        if (json) {
          ctx.presenter.json(errorResult);
        } else {
          ctx.presenter.error('Verification failed');
          ctx.presenter.error(error.message);
          if (!quiet) {
            ctx.presenter.info('Check file permissions and try again');
          }
        }

        return 1;
      }
    }
  )) as number | void;
};