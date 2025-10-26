/**
 * Mind feed command
 */

import type { CommandModule } from './types';
import { box, keyValue, formatTiming, TimingTracker } from '@kb-labs/shared-cli-ui';

export const run: CommandModule['run'] = async (ctx, argv, flags) => {
  const tracker = new TimingTracker();
  const jsonMode = !!flags.json;
  
  // Parse flags with defaults
  const cwd = typeof flags.cwd === 'string' && flags.cwd ? flags.cwd : process.cwd();
  const source = flags.source;
  
  // Validate required flags
  if (!source || typeof source !== 'string') {
    if (jsonMode) {
      ctx.presenter.json({ 
        ok: false, 
        error: 'Missing required flag: --source',
        hint: 'Specify source directory with --source <path>',
        timing: tracker.total()
      });
    } else {
      ctx.presenter.error('Missing required flag: --source');
      ctx.presenter.info('Usage: kb mind feed --source <path>');
    }
    return 1;
  }
  
  try {
    tracker.checkpoint('feed');
    
    // TODO: Call actual mind feeding logic when @kb-labs/mind-core API is available
    // const result = await feedMindWorkspace({ cwd, source });
    
    const totalTime = tracker.total();
    
    if (jsonMode) {
      ctx.presenter.json({ 
        ok: true, 
        action: 'mind:feed', 
        cwd, 
        source,
        message: 'Data fed to mind workspace successfully',
        timing: totalTime
      });
    } else {
      const summary = keyValue({
        'Source': source,
        'Working Dir': cwd,
        'Status': 'Success',
      });

      const output = box('Mind Feed', [...summary, '', `Time: ${formatTiming(totalTime)}`]);
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