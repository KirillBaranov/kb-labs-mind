/**
 * Mind init command
 */

import type { CommandModule } from './types';
import { initMindStructure } from '@kb-labs/mind-indexer';
import { runScope, type AnalyticsEventV1, type EmitResult } from '@kb-labs/analytics-sdk-node';
import { ANALYTICS_EVENTS, ANALYTICS_ACTOR } from '../analytics/events';

export const run: CommandModule['run'] = async (ctx, argv, flags): Promise<number | void> => {
  const startTime = Date.now();
  const jsonMode = !!flags.json;
  const quiet = !!flags.quiet;
  
  // Parse flags with defaults
  const cwd = typeof flags.cwd === 'string' && flags.cwd ? flags.cwd : ctx.cwd;
  const force = !!flags.force;

  return (await runScope(
    {
      actor: ANALYTICS_ACTOR,
      ctx: { workspace: cwd },
    },
    async (emit: (event: Partial<AnalyticsEventV1>) => Promise<EmitResult>) => {
      try {
        // Track command start
        await emit({
          type: ANALYTICS_EVENTS.INIT_STARTED,
          payload: {
            force,
          },
        });
        const mindDir = await initMindStructure({ cwd, force, log: (entry: any) => {
          if (!quiet && !jsonMode) {
            console.log('Init:', entry);
          }
        }});
        
        const totalTime = Date.now() - startTime;
        
        if (jsonMode) {
          ctx.presenter.json({
            ok: true,
            mindDir,
            cwd
          });
        } else {
          if (!quiet) {
            console.log(`✓ Mind workspace initialized: ${mindDir}`);
          }
        }

        // Track command completion
        await emit({
          type: ANALYTICS_EVENTS.INIT_FINISHED,
          payload: {
            force,
            durationMs: totalTime,
            result: 'success',
          },
        });
        
        return 0;
      } catch (e: unknown) {
        const errorMessage = e instanceof Error ? e.message : String(e);
        const errorCode = e instanceof Error && 'code' in e ? (e as any).code : 'MIND_INIT_ERROR';
        const totalTime = Date.now() - startTime;

        // Track command failure
        await emit({
          type: ANALYTICS_EVENTS.INIT_FINISHED,
          payload: {
            force,
            durationMs: totalTime,
            result: 'error',
            error: errorMessage,
          },
        });
        
        const errorData = {
          ok: false,
          code: errorCode,
          message: errorMessage,
          hint: 'Check your workspace permissions and try again'
        };
        
        if (jsonMode) {
          ctx.presenter.json(errorData);
        } else {
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