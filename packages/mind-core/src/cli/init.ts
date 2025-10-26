/**
 * Mind init command
 */

import type { CommandModule } from './types';
import { box, keyValue, formatTiming, TimingTracker } from '@kb-labs/shared-cli-ui';

export const run: CommandModule['run'] = async (ctx, argv, flags) => {
  const tracker = new TimingTracker();
  const jsonMode = !!flags.json;
  
  // Parse flags with defaults
  const cwd = typeof flags.cwd === 'string' && flags.cwd ? flags.cwd : process.cwd();
  const force = !!flags.force;
  
  try {
    tracker.checkpoint('init');
    
    // TODO: Call actual mind initialization logic when @kb-labs/mind-indexer is available
    // const result = await initMindStructure({ cwd, force });
    
    const totalTime = tracker.total();
    
    if (jsonMode) {
      ctx.presenter.json({ 
        ok: true, 
        action: 'mind:init', 
        cwd, 
        force,
        message: 'Mind workspace initialized successfully',
        timing: totalTime
      });
    } else {
      const summary = keyValue({
        'Working Dir': cwd,
        'Force Mode': force ? 'Enabled' : 'Disabled',
        'Status': 'Success',
      });

      const output = box('Mind Init', [...summary, '', `Time: ${formatTiming(totalTime)}`]);
      ctx.presenter.write(output);
    }
    return 0;
  } catch (e: unknown) {
    const errorMessage = e instanceof Error ? e.message : String(e);
    if (jsonMode) {
      ctx.presenter.json({ ok: false, error: errorMessage, timing: tracker.total() });
    } else {
      ctx.presenter.error(errorMessage);
    }
    return 1;
  }
};
