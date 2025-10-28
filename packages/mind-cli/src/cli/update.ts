/**
 * Mind update command
 */

import type { CommandModule } from './types';
import { updateIndexes } from '@kb-labs/mind-indexer';
import { createSpinner, box, keyValue, safeColors, TimingTracker, formatTiming } from '@kb-labs/shared-cli-ui';

export const run: CommandModule['run'] = async (ctx, argv, flags) => {
  const jsonMode = !!flags.json;
  const quiet = !!flags.quiet;
  
  // Parse flags with defaults
  const cwd = typeof flags.cwd === 'string' && flags.cwd ? flags.cwd : ctx.cwd;
  const since = typeof flags.since === 'string' ? flags.since : undefined;
  const noCache = !!flags['no-cache'];
  // Default to 5000ms for full indexing (instead of 800ms)
  const timeBudget = Number.isFinite(flags['time-budget']) ? Number(flags['time-budget']) : 5000;
  
  // Create loader and timing tracker
  const loader = createSpinner('Indexing project', jsonMode);
  const tracker = new TimingTracker();
  
  try {
    loader.start();
    tracker.checkpoint('start');
    
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
    
    const result = await updateIndexes(updateOptions);
    
    loader.stop();
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
        // Show final summary box
        const summaryLines = keyValue({
          'API Changes': result.api ? `${result.api.added > 0 ? '+' : ''}${result.api.added} ~${result.api.updated} -${result.api.removed}` : 'N/A',
          'Dependencies': result.deps ? `${result.deps.edgesAdded > 0 ? '+' : ''}${result.deps.edgesAdded} -${result.deps.edgesRemoved}` : 'N/A',
          'Diff Files': result.diff ? String(result.diff.files || 0) : 'none',
          'Status': result.partial ? safeColors.warning('⚠ Partial') : safeColors.success('✓ Complete')
        });
        
        if (result.partial && result.budget) {
          summaryLines.push(
            '',
            `${safeColors.warning('⚠')} Partial update due to time budget`,
            `Budget: ${result.budget.usedMs}ms / ${result.budget.limitMs}ms`
          );
        }
        
        summaryLines.push('', `Time: ${formatTiming(duration)}`);
        
        // Add empty line before box for separation
        ctx.presenter.write('\n' + box('Mind Update', summaryLines));
      }
    }
    
    return 0;
  } catch (e: unknown) {
    loader.stop();
    
    const errorMessage = e instanceof Error ? e.message : String(e);
    const errorCode = e instanceof Error && 'code' in e ? (e as any).code : 'MIND_UPDATE_ERROR';
    
    const errorData = {
      ok: false,
      code: errorCode,
      message: errorMessage,
      hint: 'Check your workspace and git status'
    };
    
    if (jsonMode) {
      ctx.presenter.json(errorData);
    } else {
      loader.fail('Update failed');
      ctx.presenter.error(errorMessage);
      if (!quiet) {
        ctx.presenter.info(`Code: ${errorCode}`);
      }
    }
    return 1;
  }
};