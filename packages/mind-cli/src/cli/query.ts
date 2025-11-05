/**
 * Mind query command
 */

import type { CommandModule } from './types.js';
import { executeQuery } from '@kb-labs/mind-query';
import type { QueryName } from '@kb-labs/mind-types';
import { TimingTracker, formatTiming, box, keyValue } from '@kb-labs/shared-cli-ui';
import { resolve, join } from 'node:path';
import { writeFileSync, mkdirSync } from 'node:fs';
import { encode } from '@byjohann/toon';
import { runScope, type AnalyticsEventV1, type EmitResult } from '@kb-labs/analytics-sdk-node';
import { ANALYTICS_EVENTS, ANALYTICS_ACTOR } from '../analytics/events';

export const run: CommandModule['run'] = async (ctx, argv, flags) => {
  const startTime = Date.now();
  const jsonMode = !!flags.json;
  const quiet = !!flags.quiet;
  const compact = !!flags.compact;
  const toonMode = !!flags.toon;
  const toonSidecar = !!flags['toon-sidecar'];
  
  const cwd = typeof flags.cwd === 'string' ? flags.cwd : ctx.cwd;
  const queryName = flags.query;

  return (await runScope(
    {
      actor: ANALYTICS_ACTOR,
      ctx: { workspace: cwd },
    },
    async (emit: (event: Partial<AnalyticsEventV1>) => Promise<EmitResult>): Promise<number | void> => {
      try {
  
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
        
        // Track command start
        await emit({
          type: ANALYTICS_EVENTS.QUERY_STARTED,
          payload: {
            queryName,
            toonMode,
            toonSidecar,
            compact,
          },
        });
        
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
        
        const totalTime = Date.now() - startTime;
        
        // Handle TOON output (token-efficient LLM format)
        if (toonMode || toonSidecar) {
      const toonOutput = encode(result);

          // Prepare data for artifacts (if using --toon-sidecar)
          // If --toon-sidecar is specified, also write via artifacts system
          const artifactData = toonSidecar ? {
            'query-output': toonOutput,
          } : undefined;

          // Write sidecar file if requested (manual write for backward compatibility)
          if (toonSidecar) {
            const sidecarDir = join(cwd, '.kb', 'mind', 'query');
            mkdirSync(sidecarDir, { recursive: true });
            const sidecarPath = join(sidecarDir, `${result.meta.queryId || 'query'}.toon`);
            writeFileSync(sidecarPath, toonOutput, 'utf-8');
            
            if (!quiet && !jsonMode) {
              ctx.presenter.info(`TOON sidecar written: ${sidecarPath}`);
            }
          }

          // Output TOON format
          if (toonMode) {
            if (jsonMode) {
              // Output as JSON with toon content
              ctx.presenter.json({
                ok: true,
                format: 'toon',
                content: toonOutput
              });
            } else {
              if (!quiet) {
                const lines = keyValue({
                  'Query': queryName,
                  'Format': 'TOON',
                  'Time': formatTiming(tracker.total())
                });
                ctx.presenter.write(box('Mind Query (TOON)', lines));
              }
              ctx.presenter.write(toonOutput);
            }

            // Track command completion
            await emit({
              type: ANALYTICS_EVENTS.QUERY_FINISHED,
              payload: {
                queryName,
                toonMode,
                toonSidecar,
                cached: result.meta.cached,
                tokensEstimate: result.meta.tokensEstimate,
                durationMs: totalTime,
                result: 'success',
              },
            });
            
            // Return data for artifacts if using --toon-sidecar
            if (artifactData) {
              return { exitCode: 0, ...artifactData } as any;
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
              for (const suggestion of result.suggestNextQueries) {
                lines.push(`  • ${suggestion}`);
              }
            }
            
            ctx.presenter.write(box('Mind Query', lines));
          }
          
          // Show result preview
          if (result.result) {
            ctx.presenter.write(JSON.stringify(result.result, null, 2));
          }
        }

        // Track command completion
        await emit({
          type: ANALYTICS_EVENTS.QUERY_FINISHED,
          payload: {
            queryName,
            toonMode,
            toonSidecar,
            cached: result.meta.cached,
            tokensEstimate: result.meta.tokensEstimate,
            resultsCount: (result.result as any)?.count || 0,
            durationMs: totalTime,
            result: 'success',
          },
        });
        
        // Return exit code (0 for success)
        return 0;
      } catch (error: any) {
        const totalTime = Date.now() - startTime;

        // Track command failure
        await emit({
          type: ANALYTICS_EVENTS.QUERY_FINISHED,
          payload: {
            queryName: flags.query as string,
            toonMode,
            toonSidecar,
            durationMs: totalTime,
            result: 'error',
            error: error.message,
          },
        });

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
    }
  )) as number | void;
};
