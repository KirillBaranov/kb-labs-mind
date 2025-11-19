/**
 * Mind update command
 */

import type { CommandModule } from '../types.js';
import { updateIndexes } from '@kb-labs/mind-indexer';
import { pluginContractsManifest } from '@kb-labs/mind-contracts';
import {
  TimingTracker,
  formatTiming,
  parseNumberFlag,
} from '@kb-labs/shared-cli-ui';
import { MIND_ERROR_CODES } from '../../errors/error-codes.js';
import { runScope, type AnalyticsEventV1, type EmitResult } from '@kb-labs/analytics-sdk-node';
import { ANALYTICS_EVENTS, ANALYTICS_ACTOR } from '../../infra/analytics/events.js';

const UPDATE_ARTIFACT_ID =
  pluginContractsManifest.artifacts['mind.update.report']?.id ?? 'mind.update.report';

export const run: CommandModule['run'] = async (ctx, argv, flags): Promise<number | void> => {
  // Parse flags with defaults
  const cwd = typeof flags.cwd === 'string' && flags.cwd ? flags.cwd : ctx.cwd;
  const since = typeof flags.since === 'string' ? flags.since : undefined;
  const noCache = !!flags['no-cache'];
  // Default to 5000ms for full indexing (instead of 800ms)
  const parsedTimeBudget = parseNumberFlag(flags['time-budget']);
  const timeBudget = parsedTimeBudget ?? 5000;

  return (await runScope(
    {
      actor: ANALYTICS_ACTOR,
      ctx: { workspace: cwd },
    },
    async (emit: (event: Partial<AnalyticsEventV1>) => Promise<EmitResult>) => {
      const tracker = new TimingTracker();
      const spinner = ctx.output.spinner('Indexing project');
      
      try {
        // Track command start
        await emit({
          type: ANALYTICS_EVENTS.UPDATE_STARTED,
          payload: {
            since,
            noCache,
            timeBudget,
          },
        });
        
        tracker.checkpoint('start');
        if (!ctx.output.isQuiet && !ctx.output.isJSON) {
          spinner.start();
        }
        
        const updateOptions: any = {
          cwd,
          log: (entry: any) => {
            if (!ctx.output.isQuiet && !ctx.output.isJSON) {
              ctx.output.info(`Update: ${entry.msg || entry}`);
            }
          }
        };
        
        if (since) {updateOptions.since = since;}
        if (timeBudget) {updateOptions.timeBudgetMs = timeBudget;}
        if (noCache) {updateOptions.noCache = noCache;}
        
        tracker.checkpoint('update-start');
        const result = await updateIndexes(updateOptions);
        tracker.checkpoint('update-complete');
        
        if (!ctx.output.isQuiet && !ctx.output.isJSON) {
          spinner.succeed('Indexing complete');
        }
        const duration = tracker.total();
        
        if (ctx.output.isJSON) {
          ctx.output.json({
            ok: true,
            delta: result,
            budget: result.budget,
            timing: duration,
            produces: [UPDATE_ARTIFACT_ID]
          });
        } else {
          if (!ctx.output.isQuiet) {
            const { ui } = ctx.output;
            const summaryLines: string[] = [];
            summaryLines.push(
              ...ui.keyValue({
                'API Changes': formatDelta(result.api?.added, result.api?.updated, result.api?.removed),
                'Dependencies': formatDelta(result.deps?.edgesAdded, undefined, result.deps?.edgesRemoved),
                'Diff Files': result.diff ? String(result.diff.files || 0) : 'none',
              }),
            );

            if (result.partial && result.budget) {
              summaryLines.push('');
              summaryLines.push(
                ui.colors.muted('Partial update due to time budget'),
                ui.colors.muted(`Budget: ${result.budget.usedMs}ms / ${result.budget.limitMs}ms`),
              );
            }

            const statusSymbol = result.partial ? ui.symbols.warning : ui.symbols.success;
            const statusColor = result.partial ? ui.colors.warn : ui.colors.success;
            const statusLabel = result.partial ? 'Partial update' : 'Update complete';
            summaryLines.push(
              '',
              `${statusSymbol} ${statusColor(statusLabel)} · ${ui.colors.muted(formatTiming(duration))}`,
            );

            ctx.output.write('\n' + ui.box('Mind Update', summaryLines));
          }
        }

        // Track command completion
        await emit({
          type: ANALYTICS_EVENTS.UPDATE_FINISHED,
          payload: {
            since,
            noCache,
            timeBudget,
            apiChanges: result.api ? result.api.added + result.api.updated + result.api.removed : 0,
            depsChanges: result.deps ? result.deps.edgesAdded + result.deps.edgesRemoved : 0,
            diffFiles: result.diff?.files || 0,
            partial: result.partial,
            durationMs: duration,
            result: 'success',
          },
        });
        
        return 0;
      } catch (e: unknown) {
        if (!ctx.output.isQuiet && !ctx.output.isJSON) {
          spinner.fail('Update failed');
        }
        
        const errorMessage = e instanceof Error ? e.message : String(e);
        const duration = tracker.total();

        // Track command failure
        await emit({
          type: ANALYTICS_EVENTS.UPDATE_FINISHED,
          payload: {
            since,
            noCache,
            timeBudget,
            durationMs: duration,
            result: 'error',
            error: errorMessage,
          },
        });
        
        ctx.output.error(e instanceof Error ? e : new Error(errorMessage), {
          code: MIND_ERROR_CODES.SYNC_FAILED,
          suggestions: [
            'Check your workspace and git status',
            'Verify that Mind is initialized',
            'Try: kb mind init',
          ],
        });
        return 1;
      }
    }
  )) as number;
};

function formatDelta(
  added?: number,
  updated?: number,
  removed?: number,
): string {
  const parts: string[] = [];

  if (typeof added === 'number' && added !== 0) {
    const prefix = added > 0 ? `+${added}` : String(added);
    parts.push(prefix);
  }

  if (typeof updated === 'number' && updated !== 0) {
    parts.push(`~${updated}`);
  }

  if (typeof removed === 'number' && removed !== 0) {
    const prefix = removed > 0 ? `-${removed}` : String(removed);
    parts.push(prefix);
  }

  if (parts.length === 0) {
    return '0';
  }

  return parts.join(' ');
}