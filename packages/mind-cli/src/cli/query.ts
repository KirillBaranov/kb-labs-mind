/**
 * Mind query command
 */

import type { CommandModule } from './types.js';
import { executeQuery } from '@kb-labs/mind-query';
import type { QueryName } from '@kb-labs/mind-types';
import { TimingTracker, formatTiming, box, keyValue } from '@kb-labs/shared-cli-ui';
import { resolve } from 'node:path';

export const run: CommandModule['run'] = async (ctx, argv, flags) => {
  const jsonMode = !!flags.json;
  const quiet = !!flags.quiet;
  const compact = !!flags.compact;
  
  const cwd = typeof flags.cwd === 'string' ? flags.cwd : ctx.cwd;
  const queryName = flags.query;
  
  if (!queryName || !['impact', 'scope', 'exports', 'externals', 'chain', 'meta', 'docs'].includes(queryName)) {
    if (jsonMode) {
      ctx.presenter.json({
        ok: false,
        code: 'MIND_BAD_FLAGS',
        message: 'Invalid query name. Use: impact, scope, exports, externals, chain, meta, docs'
      });
    } else {
      ctx.presenter.error('Invalid query name');
      ctx.presenter.info('Available queries: impact, scope, exports, externals, chain, meta, docs');
    }
    return 1;
  }
  
  // Parse params based on query type
  const params: Record<string, any> = {};
  if (queryName === 'impact' || queryName === 'exports' || queryName === 'chain') {
    if (!flags.file) {
      ctx.presenter.error(`Query '${queryName}' requires --file flag`);
      return 1;
    }
    params.file = resolve(cwd, flags.file);
  } else if (queryName === 'scope') {
    if (!flags.path) {
      ctx.presenter.error(`Query 'scope' requires --path flag`);
      return 1;
    }
    params.path = resolve(cwd, flags.path);
  } else if (queryName === 'externals') {
    if (flags.scope) {
      params.scope = resolve(cwd, flags.scope);
    }
  } else if (queryName === 'meta') {
    if (flags.product) {
      params.product = flags.product;
    }
  } else if (queryName === 'docs') {
    if (flags.tag) {params.tag = flags.tag;}
    if (flags.type) {params.type = flags.type;}
    if (flags.filter) {params.search = flags.filter;}
  }
  
  const tracker = new TimingTracker();
  tracker.checkpoint('start');
  
  try {
    const result = await executeQuery(queryName as QueryName, params, {
      cwd,
      limit: Number(flags.limit) || 500,
      depth: Number(flags.depth) || 5,
      cacheTtl: Number(flags['cache-ttl']) || 60,
      cacheMode: (flags['cache-mode'] as 'ci' | 'local') || 'local',
      noCache: !!flags['no-cache'],
      pathMode: (flags.paths as 'id' | 'absolute') || 'id',
      aiMode: !!flags['ai-mode']
    });
    
    if (jsonMode) {
      const output = compact ? JSON.stringify(result) : JSON.stringify(result, null, 2);
      ctx.presenter.write(output);
    } else {
      if (!quiet) {
        const lines = keyValue({
          'Query': queryName,
          'Results': String((result.result as any)?.count || 0),
          'Cached': result.meta.cached ? 'Yes' : 'No',
          'Tokens': String(result.meta.tokensEstimate),
          'Time': formatTiming(tracker.total())
        });
        
        if (result.summary) {
          lines.push('', `Summary: ${result.summary}`);
        }
        
        if (result.suggestNextQueries && result.suggestNextQueries.length > 0) {
          lines.push('', 'Suggestions:');
          result.suggestNextQueries.forEach((suggestion: string) => {
            lines.push(`  • ${suggestion}`);
          });
        }
        
        ctx.presenter.write(box('Mind Query', lines));
      }
      
      // Show result preview
      if (result.result) {
        ctx.presenter.write(JSON.stringify(result.result, null, 2));
      }
    }
    
    return 0;
  } catch (error: any) {
    if (jsonMode) {
      ctx.presenter.json({
        ok: false,
        code: 'MIND_QUERY_ERROR',
        message: error.message
      });
    } else {
      ctx.presenter.error(error.message);
    }
    return 1;
  }
};
