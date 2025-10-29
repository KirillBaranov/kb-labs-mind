/**
 * Mind query command
 */

import type { CommandModule } from './types.js';
import { executeQuery } from '@kb-labs/mind-query';
import type { QueryName } from '@kb-labs/mind-types';
import { TimingTracker, formatTiming, box, keyValue } from '@kb-labs/shared-cli-ui';
import { resolve, join } from 'node:path';
import { writeFileSync, mkdirSync } from 'node:fs';
import { toToxQueryResult } from '@kb-labs/tox-adapters';
import { TOX_JSON_CONTENT_TYPE } from '@kb-labs/tox-codec-json';

export const run: CommandModule['run'] = async (ctx, argv, flags) => {
  const jsonMode = !!flags.json;
  const quiet = !!flags.quiet;
  const compact = !!flags.compact;
  const toxMode = !!flags.tox;
  const toxSidecar = !!flags['tox-sidecar'];
  const toxPreset = typeof flags['tox-preset'] === 'string' ? flags['tox-preset'] : undefined;
  
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
    
    // Handle TOX output
    if (toxMode || toxSidecar) {
      const toxResult = toToxQueryResult(result, {
        preset: toxPreset || 'mind-v1',
        compact: compact,
        strict: false,
      });

      if (!toxResult.ok || !toxResult.result) {
        if (jsonMode) {
          ctx.presenter.json({
            ok: false,
            code: toxResult.code || 'TOX_ENCODE_ERROR',
            message: toxResult.message || 'TOX encoding failed',
          });
        } else {
          ctx.presenter.error(toxResult.message || 'TOX encoding failed');
        }
        return 1;
      }

      // Write sidecar file if requested
      if (toxSidecar) {
        const sidecarDir = join(cwd, '.kb', 'mind', 'query');
        mkdirSync(sidecarDir, { recursive: true });
        const sidecarPath = join(sidecarDir, `${result.meta.queryId || 'query'}.tox.json`);
        writeFileSync(sidecarPath, JSON.stringify(toxResult.result, null, 2), 'utf-8');
        
        if (!quiet && !jsonMode) {
          ctx.presenter.info(`Sidecar written: ${sidecarPath}`);
        }
      }

      // Output TOX JSON
      if (toxMode) {
        if (jsonMode) {
          // Output Content-Type header hint for TOX
          ctx.presenter.write(`// Content-Type: ${TOX_JSON_CONTENT_TYPE}\n`);
          const output = compact ? JSON.stringify(toxResult.result) : JSON.stringify(toxResult.result, null, 2);
          ctx.presenter.write(output);
        } else {
          if (!quiet) {
            const lines = keyValue({
              'Query': queryName,
              'Format': 'TOX JSON',
              'Content-Type': TOX_JSON_CONTENT_TYPE,
              'Time': formatTiming(tracker.total())
            });
            ctx.presenter.write(box('Mind Query (TOX)', lines));
          }
          ctx.presenter.write(JSON.stringify(toxResult.result, null, 2));
        }
        return 0;
      }

      // If only sidecar, continue with regular output
    }
    
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
