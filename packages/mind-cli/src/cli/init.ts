/**
 * Mind init command
 */

import type { CommandModule } from './types';
import { initMindStructure } from '@kb-labs/mind-indexer';

export const run: CommandModule['run'] = async (ctx, argv, flags) => {
  const jsonMode = !!flags.json;
  const quiet = !!flags.quiet;
  
  // Parse flags with defaults
  const cwd = typeof flags.cwd === 'string' && flags.cwd ? flags.cwd : ctx.cwd;
  const force = !!flags.force;
  
  try {
    const mindDir = await initMindStructure({ cwd, force, log: (entry: any) => {
      if (!quiet && !jsonMode) {
        console.log('Init:', entry);
      }
    }});
    
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
    
    return 0;
  } catch (e: unknown) {
    const errorMessage = e instanceof Error ? e.message : String(e);
    const errorCode = e instanceof Error && 'code' in e ? (e as any).code : 'MIND_INIT_ERROR';
    
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
};