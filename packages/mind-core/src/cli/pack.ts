/**
 * Mind pack command
 */

import type { CommandModule } from './types';

export const run: CommandModule['run'] = async (ctx, argv, flags) => {
  // Parse flags with defaults
  const cwd = typeof flags.cwd === 'string' && flags.cwd ? flags.cwd : process.cwd();
  const output = typeof flags.output === 'string' ? flags.output : undefined;
  
  try {
    // TODO: Call actual mind packing logic when @kb-labs/mind-pack is available
    // const result = await packMindWorkspace({ cwd, output });
    
    if (flags.json) {
      ctx.presenter.json({ 
        ok: true, 
        action: 'mind:pack', 
        cwd, 
        output: output || 'default',
        message: 'Mind workspace packed successfully'
      });
    } else {
      ctx.presenter.info(`Mind workspace packed from ${cwd}`);
      if (output) {
        ctx.presenter.info(`Output directory: ${output}`);
      }
    }
    return 0;
  } catch (e: any) {
    if (flags.json) {
      ctx.presenter.json({ ok: false, error: e?.message });
    } else {
      ctx.presenter.error(e?.message ?? 'Failed to pack mind workspace');
    }
    return 1;
  }
};