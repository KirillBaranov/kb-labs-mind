/**
 * Mind pack command
 */

import type { CommandModule } from './types';
import { box, keyValue, formatTiming, TimingTracker } from '@kb-labs/shared-cli-ui';

export const run: CommandModule['run'] = async (ctx, argv, flags) => {
  const tracker = new TimingTracker();
  const jsonMode = !!flags.json;
  
  // Parse flags with defaults
  const cwd = typeof flags.cwd === 'string' && flags.cwd ? flags.cwd : process.cwd();
  const output = typeof flags.output === 'string' ? flags.output : undefined;
  
  try {
    tracker.checkpoint('pack');
    
    // TODO: Call actual mind packing logic when @kb-labs/mind-pack is available
    // const result = await packMindWorkspace({ cwd, output });
    
    const totalTime = tracker.total();
    
    if (jsonMode) {
      ctx.presenter.json({ 
        ok: true, 
        action: 'mind:pack', 
        cwd, 
        output: output || 'default',
        message: 'Mind workspace packed successfully',
        timing: totalTime
      });
    } else {
      const summary = keyValue({
        'Working Dir': cwd,
        'Output': output || 'default',
        'Status': 'Success',
      });

      const outputBox = box('Mind Pack', [...summary, '', `Time: ${formatTiming(totalTime)}`]);
      ctx.presenter.write(outputBox);
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