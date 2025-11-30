/**
 * Mind update command
 */

import { defineCommand, type CommandResult } from '@kb-labs/shared-command-kit';
import { updateIndexes } from '@kb-labs/mind-indexer';
import { pluginContractsManifest } from '@kb-labs/mind-contracts';
import { parseNumberFlag } from '@kb-labs/shared-cli-ui';
import { MIND_ERROR_CODES } from '../../errors/error-codes';
import { ANALYTICS_EVENTS, ANALYTICS_ACTOR } from '../../infra/analytics/events';

const UPDATE_ARTIFACT_ID =
  pluginContractsManifest.artifacts['mind.update.report']?.id ?? 'mind.update.report';

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

type MindUpdateFlags = {
  cwd: { type: 'string'; description?: string };
  since: { type: 'string'; description?: string };
  'time-budget': { type: 'number'; description?: string };
  'no-cache': { type: 'boolean'; description?: string; default?: boolean };
  json: { type: 'boolean'; description?: string; default?: boolean };
  verbose: { type: 'boolean'; description?: string; default?: boolean };
  quiet: { type: 'boolean'; description?: string; default?: boolean };
};

type MindUpdateResult = CommandResult & {
  added?: number;
  updated?: number;
  removed?: number;
  artifactId?: string;
};

export const run = defineCommand<MindUpdateFlags, MindUpdateResult>({
  name: 'mind:update',
  flags: {
    cwd: {
      type: 'string',
      description: 'Working directory',
    },
    since: {
      type: 'string',
      description: 'Git reference to update since',
    },
    'time-budget': {
      type: 'number',
      description: 'Time budget in milliseconds',
    },
    'no-cache': {
      type: 'boolean',
      description: 'Disable cache',
      default: false,
    },
    json: {
      type: 'boolean',
      description: 'Output in JSON format',
      default: false,
    },
    verbose: {
      type: 'boolean',
      description: 'Verbose output',
      default: false,
    },
    quiet: {
      type: 'boolean',
      description: 'Quiet output',
      default: false,
    },
  },
  analytics: {
    startEvent: ANALYTICS_EVENTS.UPDATE_STARTED,
    finishEvent: ANALYTICS_EVENTS.UPDATE_FINISHED,
    actor: ANALYTICS_ACTOR.id,
    includeFlags: true,
  },
  async handler(ctx, argv, flags) {
    const cwd = flags.cwd || ctx.cwd;
    const since = flags.since;
    const noCache = flags['no-cache'];
    const parsedTimeBudget = parseNumberFlag(flags['time-budget']);
    const timeBudget = parsedTimeBudget ?? 5000;
    
    const spinner = ctx.output?.spinner('Indexing project');
    
    ctx.tracker.checkpoint('start');
    if (!flags.quiet && !flags.json) {
      spinner?.start();
    }
    
    const updateOptions: any = {
      cwd,
      log: (entry: any) => {
        if (!flags.quiet && !flags.json) {
          ctx.output?.info(`Update: ${entry.msg || entry}`);
        }
      }
    };
    
    if (since) {updateOptions.since = since;}
    if (timeBudget) {updateOptions.timeBudgetMs = timeBudget;}
    if (noCache) {updateOptions.noCache = noCache;}
    
    ctx.tracker.checkpoint('update-start');
    const result = await updateIndexes(updateOptions);
    ctx.tracker.checkpoint('update-complete');
    
    if (!flags.quiet && !flags.json) {
      spinner?.succeed('Indexing complete');
    }
    
    if (flags.json) {
      ctx.output?.json({
        ok: true,
        delta: result,
        budget: result.budget,
        timingMs: ctx.tracker.total(),
        produces: [UPDATE_ARTIFACT_ID]
      });
    } else {
      if (!flags.quiet) {
        const { ui } = ctx.output!;

        const sections: Array<{ header?: string; items: string[] }> = [
          {
            header: 'Changes',
            items: [
              `API Changes: ${formatDelta(result.api?.added, result.api?.updated, result.api?.removed)}`,
              `Dependencies: ${formatDelta(result.deps?.edgesAdded, undefined, result.deps?.edgesRemoved)}`,
              `Diff Files: ${result.diff ? String(result.diff.files || 0) : 'none'}`,
            ],
          },
        ];

        if (result.partial && result.budget) {
          sections.push({
            header: 'Budget',
            items: [
              `Partial update due to time budget`,
              `Used: ${result.budget.usedMs}ms / ${result.budget.limitMs}ms`,
            ],
          });
        }

        const status = result.partial ? 'warning' : 'success';

        const outputText = ui.sideBox({
          title: 'Mind Update',
          sections,
          status,
          timing: ctx.tracker.total(),
        });
        ctx.output?.write(outputText);
      }
    }

    ctx.logger?.info('Mind update completed', {
      apiChanges: result.api ? result.api.added + result.api.updated + result.api.removed : 0,
      depsChanges: result.deps ? result.deps.edgesAdded + result.deps.edgesRemoved : 0,
      diffFiles: result.diff?.files || 0,
      partial: result.partial,
    });

    return { ok: true, delta: result, budget: result.budget };
  },
  async onError(error, ctx, flags) {
    const spinner = ctx.output?.spinner('Indexing project');
    if (!flags.quiet && !flags.json) {
      spinner?.fail('Update failed');
    }
    
    const errorMessage = error instanceof Error ? error.message : String(error);

    ctx.logger?.error('Mind update failed', {
      error: errorMessage,
      cwd: flags.cwd || ctx.cwd,
    });

    ctx.output?.error(error instanceof Error ? error : new Error(errorMessage), {
      code: MIND_ERROR_CODES.SYNC_FAILED,
      suggestions: [
        'Check your workspace and git status',
        'Verify that Mind is initialized',
        'Try: kb mind init',
      ],
    });

    return { ok: false, exitCode: 1, error: errorMessage };
  },
});
