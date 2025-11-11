/**
 * Mind init command
 */

import type { CommandModule, CommandContext as MindCommandContext } from './types';
import { initMindStructure } from '@kb-labs/mind-indexer';
import {
  createCommandRunner,
  discoverArtifacts,
  type CommandContext as SharedCommandContext,
} from '@kb-labs/shared-cli-ui';
import { TimingTracker } from '@kb-labs/shared-cli-ui';
import { ANALYTICS_EVENTS, ANALYTICS_ACTOR } from '../analytics/events';

// Create command runner
const commandRunner = createCommandRunner({
  title: 'Mind Init',
  analytics: {
    actor: ANALYTICS_ACTOR.id,
    started: ANALYTICS_EVENTS.INIT_STARTED,
    finished: ANALYTICS_EVENTS.INIT_FINISHED,
    getPayload: (flags: Record<string, unknown>) => ({
      force: !!flags.force,
    }),
  },
  async execute(ctx: SharedCommandContext, flags: Record<string, unknown>, tracker: TimingTracker) {
    // Parse flags with defaults
    const cwd = typeof flags.cwd === 'string' && flags.cwd ? flags.cwd : ctx.cwd;
    const force = !!flags.force;

    tracker.checkpoint('start');

    // Initialize Mind structure
    const mindDir = await initMindStructure({
      cwd,
      force,
      log: (entry: any) => {
        // Log entries are collected but not displayed here
        // They will be shown via artifacts discovery
      },
    });

    tracker.checkpoint('init-complete');

    // Discover created artifacts
    const artifacts = await discoverArtifacts(mindDir, [
      {
        name: 'Index',
        pattern: 'index.json',
        description: 'Main Mind index',
      },
      {
        name: 'API Index',
        pattern: 'api-index.json',
        description: 'API index',
      },
      {
        name: 'Dependencies',
        pattern: 'deps.json',
        description: 'Dependencies graph',
      },
      {
        name: 'Recent Diff',
        pattern: 'recent-diff.json',
        description: 'Recent changes diff',
      },
    ]);

    return {
      summary: {
        Workspace: mindDir,
        Status: 'Initialized',
      },
      artifacts,
      data: {
        mindDir,
        cwd,
      },
    };
  },
});

// Adapt mind CommandContext to shared CommandContext and call runner
export const run: CommandModule['run'] = async (ctx: MindCommandContext, argv: string[], flags: Record<string, unknown>) => {
  const sharedCtx: SharedCommandContext = {
    cwd: ctx.cwd,
    presenter: ctx.presenter,
  };

  return commandRunner(sharedCtx, argv, flags);
};