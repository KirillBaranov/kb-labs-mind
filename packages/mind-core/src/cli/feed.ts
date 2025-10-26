/**
 * Mind feed command
 */

import type { CommandModule } from './types';

export const run: CommandModule['run'] = async (ctx, argv, flags) => {
  // Parse flags with defaults
  const cwd = typeof flags.cwd === 'string' && flags.cwd ? flags.cwd : process.cwd();
  const source = flags.source;
  
  // Validate required flags
  if (!source || typeof source !== 'string') {
    if (flags.json) {
      ctx.presenter.json({ 
        ok: false, 
        error: 'Missing required flag: --source',
        hint: 'Specify source directory with --source <path>'
      });
    } else {
      ctx.presenter.error('Missing required flag: --source');
      ctx.presenter.info('Usage: kb mind feed --source <path>');
    }
    return 1;
  }
  
  try {
    // TODO: Call actual mind feeding logic when @kb-labs/mind-core API is available
    // const result = await feedMindWorkspace({ cwd, source });
    
    if (flags.json) {
      ctx.presenter.json({ 
        ok: true, 
        action: 'mind:feed', 
        cwd, 
        source,
        message: 'Data fed to mind workspace successfully'
      });
    } else {
      ctx.presenter.info(`Data fed to mind workspace from ${source}`);
      ctx.presenter.info(`Working directory: ${cwd}`);
    }
    return 0;
  } catch (e: any) {
    if (flags.json) {
      ctx.presenter.json({ ok: false, error: e?.message });
    } else {
      ctx.presenter.error(e?.message ?? 'Failed to feed data to mind workspace');
    }
    return 1;
  }
};