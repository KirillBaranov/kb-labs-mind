/**
 * Mind init command
 */

import type { CommandModule } from '../types.js';
import { initMindStructure } from '@kb-labs/mind-indexer';
import {
  TimingTracker,
  displayArtifacts,
} from '@kb-labs/shared-cli-ui';
import { MIND_ERROR_CODES } from '../../errors/error-codes.js';
import { runScope, type AnalyticsEventV1, type EmitResult } from '@kb-labs/analytics-sdk-node';
import { ANALYTICS_EVENTS, ANALYTICS_ACTOR } from '../../infra/analytics/events.js';
import { join } from 'node:path';
import { promises as fsp } from 'node:fs';

export const run: CommandModule['run'] = async (ctx, argv, flags): Promise<number | void> => {
  const cwd = typeof flags.cwd === 'string' && flags.cwd ? flags.cwd : ctx.cwd;
  const force = !!flags.force;

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
          type: ANALYTICS_EVENTS.INIT_STARTED,
          payload: {
            force,
          },
        });

        // Initialize Mind structure
        const mindDir = await initMindStructure({
          cwd,
          force,
          log: (entry: any) => {
            if (!ctx.output.isQuiet && !ctx.output.isJSON) {
              ctx.output.info(`Init: ${entry.msg || entry}`);
            }
          },
        });

        tracker.checkpoint('init-complete');

        // Discover created artifacts
        const artifacts: Array<{
          name: string;
          path: string;
          size: number;
          modified: Date;
          description: string;
        }> = [];

        const artifactPatterns = [
          { name: 'Index', pattern: 'index.json', description: 'Main Mind index' },
          { name: 'API Index', pattern: 'api-index.json', description: 'API index' },
          { name: 'Dependencies', pattern: 'deps.json', description: 'Dependencies graph' },
          { name: 'Recent Diff', pattern: 'recent-diff.json', description: 'Recent changes diff' },
        ];

        for (const { name, pattern, description } of artifactPatterns) {
          const artifactPath = join(mindDir, pattern);
          try {
            const stats = await fsp.stat(artifactPath);
            artifacts.push({
              name,
              path: artifactPath,
              size: stats.size,
              modified: stats.mtime,
              description,
            });
          } catch {
            // Artifact doesn't exist, skip
          }
        }

        const duration = tracker.total();

        // Track command completion
        await emit({
          type: ANALYTICS_EVENTS.INIT_FINISHED,
          payload: {
            force,
            durationMs: duration,
            result: 'success',
            artifactsCount: artifacts.length,
          },
        });

        // Output result
        if (ctx.output.isJSON) {
          ctx.output.json({
            ok: true,
            summary: {
              Workspace: mindDir,
              Status: 'Initialized',
            },
            artifacts,
            timing: duration,
            data: {
              mindDir,
              cwd,
            },
          });
        } else if (!ctx.output.isQuiet) {
          const { ui } = ctx.output;
          const summaryLines: string[] = [];
          summaryLines.push(
            ...ui.keyValue({
              Workspace: mindDir,
              Status: 'Initialized',
            }),
          );

          if (artifacts.length > 0) {
            summaryLines.push('');
            summaryLines.push(
              ...displayArtifacts(artifacts, {
                title: 'Created Artifacts',
                showDescription: true,
                showTime: false,
              }),
            );
          }

          ctx.output.write('\n' + ui.box(`${ui.symbols.success} Mind Init`, summaryLines));
        }

        return 0;
      } catch (error: unknown) {
        const duration = tracker.total();
        const errorMessage = error instanceof Error ? error.message : String(error);

        // Track command failure
        await emit({
          type: ANALYTICS_EVENTS.INIT_FINISHED,
          payload: {
            force,
            durationMs: duration,
            result: 'error',
            error: errorMessage,
          },
        });

        ctx.output.error(error instanceof Error ? error : new Error(errorMessage), {
          code: MIND_ERROR_CODES.INIT_FAILED,
          suggestions: [
            'Check file permissions',
            'Verify workspace is writable',
            'Try with --force flag to overwrite existing structure',
          ],
        });

        return 1;
      }
    }
  )) as number | void;
};