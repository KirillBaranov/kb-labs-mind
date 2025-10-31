/**
 * Mind pack command
 */

import type { CommandModule } from './types';
import { buildPack } from '@kb-labs/mind-pack';
import { DEFAULT_BUDGET } from '@kb-labs/mind-core';
import { promises as fs } from 'node:fs';
import { join, isAbsolute } from 'node:path';
import { runScope, type AnalyticsEventV1, type EmitResult } from '@kb-labs/analytics-sdk-node';
import { ANALYTICS_EVENTS, ANALYTICS_ACTOR } from '../analytics/events';

export const run: CommandModule['run'] = async (ctx, argv, flags) => {
  const startTime = Date.now();
  const jsonMode = !!flags.json;
  const quiet = !!flags.quiet;
  
  // Parse flags with defaults
  const cwd = typeof flags.cwd === 'string' && flags.cwd ? flags.cwd : ctx.cwd;
  const intent = typeof flags.intent === 'string' && flags.intent ? flags.intent : undefined;
  const product = typeof flags.product === 'string' ? flags.product : undefined;
  const preset = typeof flags.preset === 'string' ? flags.preset : undefined;
  const budget = Number.isFinite(flags.budget) ? Number(flags.budget) : DEFAULT_BUDGET.totalTokens;
  const withBundle = !!flags['with-bundle'];
  const outFile = typeof flags.out === 'string' && flags.out ? flags.out : undefined;
  const seed = Number.isFinite(flags.seed) ? Number(flags.seed) : undefined;

  return await runScope(
    {
      actor: ANALYTICS_ACTOR,
      ctx: { workspace: cwd },
    },
    async (emit: (event: Partial<AnalyticsEventV1>) => Promise<EmitResult>) => {
      try {
        // Input validation
        if (!intent) {
          const errorData = {
            ok: false,
            code: 'MIND_BAD_FLAGS',
            message: 'Intent is required',
            hint: 'Use --intent flag to specify the context intent'
          };
          
          const totalTime = Date.now() - startTime;
          await emit({
            type: ANALYTICS_EVENTS.PACK_FINISHED,
            payload: {
              durationMs: totalTime,
              result: 'failed',
              error: errorData.message,
            },
          });
          
          if (jsonMode) {
            ctx.presenter.json(errorData);
          } else {
            ctx.presenter.error(errorData.message);
            if (!quiet) {
              ctx.presenter.info(errorData.hint);
            }
          }
          return 1;
        }
        
        if (budget <= 0) {
          const errorData = {
            ok: false,
            code: 'MIND_BAD_FLAGS',
            message: 'Budget must be greater than 0',
            hint: 'Use --budget flag with a positive number'
          };
          
          const totalTime = Date.now() - startTime;
          await emit({
            type: ANALYTICS_EVENTS.PACK_FINISHED,
            payload: {
              durationMs: totalTime,
              result: 'failed',
              error: errorData.message,
            },
          });
          
          if (jsonMode) {
            ctx.presenter.json(errorData);
          } else {
            ctx.presenter.error(errorData.message);
            if (!quiet) {
              ctx.presenter.info(errorData.hint);
            }
          }
          return 1;
        }

        // Track command start
        await emit({
          type: ANALYTICS_EVENTS.PACK_STARTED,
          payload: {
            intent,
            product,
            preset,
            budget,
            withBundle,
            seed: !!seed,
          },
        });
        const packOptions: any = {
          cwd,
          intent,
          budget: { totalTokens: budget, caps: {}, truncation: 'end' as const },
          log: (entry: any) => {
            if (!quiet && !jsonMode) {
              console.log('Pack:', entry);
            }
          }
        };
        
        if (product) {packOptions.product = product;}
        if (preset) {packOptions.preset = preset;}
        if (withBundle) {packOptions.withBundle = withBundle;}
        if (seed) {packOptions.seed = seed;}
        
        const result = await buildPack(packOptions);
        
        const totalTime = Date.now() - startTime;
        
        if (jsonMode) {
          ctx.presenter.json({
            ok: true,
            intent,
            product,
            tokensEstimate: result.tokensEstimate,
            sectionUsage: result.json?.sectionUsage || {},
            withBundle,
            seed,
            deterministic: !!seed
          });
        } else {
          // Handle output to file or stdout
          if (outFile) {
            const absPath = isAbsolute(outFile) ? outFile : join(cwd, outFile);
            try {
              await fs.writeFile(absPath, result.markdown, 'utf8');
              
              if (!quiet) {
                console.log(`✓ Pack saved: ${absPath}`);
              }
            } catch (writeError: any) {
              const errorMessage = writeError instanceof Error ? writeError.message : String(writeError);
              const errorCode = writeError instanceof Error && 'code' in writeError ? (writeError as any).code : 'MIND_PACK_ERROR';
              
              await emit({
                type: ANALYTICS_EVENTS.PACK_FINISHED,
                payload: {
                  intent,
                  product,
                  budget,
                  durationMs: totalTime,
                  result: 'error',
                  error: errorMessage,
                },
              });
              
              const errorData = {
                ok: false,
                code: errorCode,
                message: errorMessage,
                hint: 'Check file permissions and path'
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
          } else {
            // Default: stream Markdown to stdout
            ctx.presenter.write(result.markdown);
          }
        }

        // Track command completion
        await emit({
          type: ANALYTICS_EVENTS.PACK_FINISHED,
          payload: {
            intent,
            product,
            preset,
            budget,
            tokensEstimate: result.tokensEstimate,
            withBundle,
            deterministic: !!seed,
            durationMs: totalTime,
            result: 'success',
          },
        });
        
        return 0;
      } catch (e: unknown) {
        const errorMessage = e instanceof Error ? e.message : String(e);
        const errorCode = e instanceof Error && 'code' in e ? (e as any).code : 'MIND_PACK_ERROR';
        const totalTime = Date.now() - startTime;

        // Track command failure
        await emit({
          type: ANALYTICS_EVENTS.PACK_FINISHED,
          payload: {
            intent,
            product,
            budget,
            durationMs: totalTime,
            result: 'error',
            error: errorMessage,
          },
        });
        
        const errorData = {
          ok: false,
          code: errorCode,
          message: errorMessage,
          hint: 'Check your workspace and indexes'
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
  );
};