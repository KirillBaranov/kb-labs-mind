/**
 * Mind init command
 */

import { defineCommand, type CommandResult } from '@kb-labs/shared-command-kit';
import { initMindStructure } from '@kb-labs/mind-indexer';
import { MIND_ERROR_CODES } from '../../errors/error-codes';
import { ANALYTICS_EVENTS, ANALYTICS_ACTOR } from '../../infra/analytics/events';
import { join } from 'node:path';
import { promises as fsp } from 'node:fs';

type MindInitFlags = {
  cwd: { type: 'string'; description?: string };
  force: { type: 'boolean'; description?: string; default?: boolean };
  json: { type: 'boolean'; description?: string; default?: boolean };
  verbose: { type: 'boolean'; description?: string; default?: boolean };
  quiet: { type: 'boolean'; description?: string; default?: boolean };
};

type MindInitResult = CommandResult & {
  mindDir?: string;
};

export const run = defineCommand<MindInitFlags, MindInitResult>({
  name: 'mind:init',
  flags: {
    cwd: {
      type: 'string',
      description: 'Working directory',
    },
    force: {
      type: 'boolean',
      description: 'Force initialization even if already exists',
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
    startEvent: ANALYTICS_EVENTS.INIT_STARTED,
    finishEvent: ANALYTICS_EVENTS.INIT_FINISHED,
    actor: ANALYTICS_ACTOR.id,
    includeFlags: true,
  },
  async handler(ctx, argv, flags) {
    const cwd = flags.cwd || ctx.cwd;
    
    ctx.tracker.checkpoint('start');

    ctx.logger?.info('Mind init started', {
      cwd,
      command: 'mind:init',
      force: flags.force,
    });

    ctx.logger?.debug('Initializing mind structure', { cwd, force: flags.force });

    // Initialize Mind structure
    const mindDir = await initMindStructure({
      cwd,
      force: flags.force,
      log: (entry: any) => {
        if (!flags.quiet && !flags.json) {
          ctx.output?.info(`Init: ${entry.msg || entry}`);
        }
        // Also log via logger
        ctx.logger?.debug(`Init: ${entry.msg || entry}`, { step: 'init-structure' });
      },
    });

    ctx.tracker.checkpoint('init-complete');

    ctx.logger?.info('Mind structure initialized', {
      mindDir,
      cwd,
    });

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

    ctx.tracker.checkpoint('complete');

    ctx.logger?.info('Mind init completed', {
      mindDir,
      artifactsCount: artifacts.length,
    });

    // Output result
    if (flags.json) {
      ctx.output?.json({
        ok: true,
        summary: {
          Workspace: mindDir,
          Status: 'Initialized',
        },
        artifacts,
        timingMs: ctx.tracker.total(),
        data: {
          mindDir,
          cwd,
        },
      });
    } else if (!flags.quiet) {
      const { ui } = ctx.output!;

      const sections: Array<{ header?: string; items: string[] }> = [
        {
          header: 'Summary',
          items: [
            `Workspace: ${mindDir}`,
            `Status: Initialized`,
          ],
        },
      ];

      if (artifacts.length > 0) {
        const artifactItems: string[] = [];
        for (const artifact of artifacts) {
          artifactItems.push(`${ui.symbols.success} ${artifact.name}: ${artifact.description}`);
        }
        sections.push({
          header: 'Created Artifacts',
          items: artifactItems,
        });
      }

      const outputText = ui.sideBox({
        title: 'Mind Init',
        sections,
        status: 'success',
        timing: ctx.tracker.total(),
      });
      ctx.output?.write(outputText);
    }

    return { ok: true, mindDir, artifacts };
  },
  // TODO: onError handler was removed as it's no longer supported in CommandConfig
  // Error handling is done by the command framework automatically
});
