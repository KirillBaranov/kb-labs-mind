/**
 * Mind update command
 */

import type { CommandModule } from './types';
import { updateIndexes } from '@kb-labs/mind-indexer';
import {
  createSpinner,
  box,
  keyValue,
  safeColors,
  safeSymbols,
  TimingTracker,
  formatTiming,
  parseNumberFlag,
} from '@kb-labs/shared-cli-ui';
import { runScope, type AnalyticsEventV1, type EmitResult } from '@kb-labs/analytics-sdk-node';
import { ANALYTICS_EVENTS, ANALYTICS_ACTOR } from '../analytics/events';

export const run: CommandModule['run'] = async (ctx, argv, flags): Promise<number | void> => {
  const jsonMode = !!flags.json;
  const quiet = !!flags.quiet;
  
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
      // Create loader and timing tracker outside try block for use in catch
      const loader = createSpinner('Indexing project', jsonMode);
      const tracker = new TimingTracker();
      
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
        if (!jsonMode && !quiet) {
          loader.start();
        }
        
        const updateOptions: any = {
          cwd,
          log: (entry: any) => {
            if (!quiet && !jsonMode) {
              ctx.presenter.info(`Update: ${entry.msg || entry}`);
            }
          }
        };
        
        if (since) {updateOptions.since = since;}
        if (timeBudget) {updateOptions.timeBudgetMs = timeBudget;}
        if (noCache) {updateOptions.noCache = noCache;}
        
        tracker.checkpoint('update-start');
        const result = await updateIndexes(updateOptions);
        tracker.checkpoint('update-complete');
        
        if (!jsonMode && !quiet) {
          loader.stop();
        }
        const duration = tracker.total();
        
        if (jsonMode) {
          ctx.presenter.json({
            ok: true,
            delta: result,
            budget: result.budget,
            timing: duration
          });
        } else {
          if (!quiet) {
            const summaryLines: string[] = [];
            summaryLines.push(
              ...keyValue({
                'API Changes': formatDelta(result.api?.added, result.api?.updated, result.api?.removed),
                'Dependencies': formatDelta(result.deps?.edgesAdded, undefined, result.deps?.edgesRemoved),
                'Diff Files': result.diff ? String(result.diff.files || 0) : 'none',
              }),
            );

            if (result.partial && result.budget) {
              summaryLines.push('');
              summaryLines.push(
                safeColors.muted('Partial update due to time budget'),
                safeColors.muted(`Budget: ${result.budget.usedMs}ms / ${result.budget.limitMs}ms`),
              );
            }

            const statusSymbol = result.partial ? safeSymbols.warning : safeSymbols.success;
            const statusColor = result.partial ? safeColors.warning : safeColors.success;
            const statusLabel = result.partial ? 'Partial update' : 'Update complete';
            summaryLines.push(
              '',
              `${statusSymbol} ${statusColor(statusLabel)} · ${safeColors.muted(formatTiming(duration))}`,
            );

            ctx.presenter.write('\n' + box('Mind Update', summaryLines));
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
        if (!jsonMode && !quiet) {
          loader.stop();
        }
        
        const errorMessage = e instanceof Error ? e.message : String(e);
        const errorCode = e instanceof Error && 'code' in e ? (e as any).code : 'MIND_UPDATE_ERROR';
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
        
        const errorData = {
          ok: false,
          code: errorCode,
          message: errorMessage,
          hint: 'Check your workspace and git status',
          timing: duration
        };
        
        if (jsonMode) {
          ctx.presenter.json(errorData);
        } else {
          if (!quiet) {
            loader.fail('Update failed');
          }
          ctx.presenter.error(errorMessage);
          if (!quiet) {
            ctx.presenter.info(`Code: ${errorCode}`);
          }
        }
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