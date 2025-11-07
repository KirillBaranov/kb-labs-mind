/**
 * Mind feed command - One-shot command for AI tools
 */

import type { CommandModule } from './types';
import { updateIndexes } from '@kb-labs/mind-indexer';
import { buildPack } from '@kb-labs/mind-pack';
import { DEFAULT_BUDGET, createMindError, wrapError, getExitCode } from '@kb-labs/mind-core';
import { TimingTracker, box, keyValue, formatTiming, safeColors, parseNumberFlag } from '@kb-labs/shared-cli-ui';
import { promises as fs } from 'node:fs';
import { join, dirname, isAbsolute } from 'node:path';
import { runScope, type AnalyticsEventV1, type EmitResult } from '@kb-labs/analytics-sdk-node';
import { ANALYTICS_EVENTS, ANALYTICS_ACTOR } from '../analytics/events';

export const run: CommandModule['run'] = async (ctx, argv, flags): Promise<number | void> => {
  const jsonMode = !!flags.json;
  const quiet = !!flags.quiet;
  
  // Parse flags with defaults
  const cwd = typeof flags.cwd === 'string' && flags.cwd ? flags.cwd : ctx.cwd;

  return (await runScope(
    {
      actor: ANALYTICS_ACTOR,
      ctx: { workspace: cwd },
    },
    async (emit: (event: Partial<AnalyticsEventV1>) => Promise<EmitResult>) => {
      const tracker = new TimingTracker();
      
      try {
        tracker.checkpoint('start');
        
        const doUpdate = !flags['no-update'];
        const intent = typeof flags.intent === 'string' && flags.intent ? flags.intent : 'ad-hoc feed';
        const product = typeof flags.product === 'string' ? flags.product : undefined;
        const preset = typeof flags.preset === 'string' ? flags.preset : undefined;
        const budget = parseNumberFlag(flags.budget) ?? DEFAULT_BUDGET.totalTokens;
        const withBundle = !!flags['with-bundle'];
        const since = typeof flags.since === 'string' ? flags.since : undefined;
        const timeBudget = parseNumberFlag(flags['time-budget']);
        const outFile = typeof flags.out === 'string' && flags.out ? flags.out : undefined;
        const seed = parseNumberFlag(flags.seed);
        
        // Track command start
        await emit({
          type: ANALYTICS_EVENTS.FEED_STARTED,
          payload: {
            doUpdate,
            intent,
            product,
            preset,
            budget,
            withBundle,
            timeBudget,
          },
        });
        
        // Input validation
        const validationErrors: string[] = [];
        const ignoredFlags: string[] = [];
        
        if (budget <= 0) {
          validationErrors.push('Budget must be greater than 0');
        }
        
        if (!intent.trim()) {
          validationErrors.push('Intent cannot be empty');
        }
        
        if (timeBudget !== undefined && timeBudget <= 0) {
          validationErrors.push('Time budget must be greater than 0');
        }
        
        // Warning for ignored flags
        if (!doUpdate) {
          if (since !== undefined) {
            ignoredFlags.push('since');
          }
          if (timeBudget !== undefined) {
            ignoredFlags.push('time-budget');
          }
        }
        
        // Validate output path if provided
        if (outFile) {
          try {
            const absPath = isAbsolute(outFile) ? outFile : join(cwd, outFile);
            await fs.mkdir(dirname(absPath), { recursive: true });
            // Test write access
            await fs.writeFile(absPath, '', 'utf8');
          } catch (error: any) {
            validationErrors.push(`Invalid output path: ${error.message}`);
          }
        }
        
        // Return validation errors
        if (validationErrors.length > 0) {
          const error = createMindError('MIND_BAD_FLAGS', validationErrors.join('; '));
          const duration = tracker.total();
          
          await emit({
            type: ANALYTICS_EVENTS.FEED_FINISHED,
            payload: {
              doUpdate,
              durationMs: duration,
              result: 'failed',
              error: error.message,
            },
          });
          
          if (jsonMode) {
            ctx.presenter.json({
              ok: false,
              code: error.code,
              message: error.message,
              hint: error.hint,
              timing: duration
            });
          } else {
            ctx.presenter.error(error.message);
            if (!quiet && error.hint) {
              ctx.presenter.info(error.hint);
            }
          }
          return getExitCode(error);
        }
        let updateResult: any = null;
        
        // Step 1: Update indexes (optional)
        if (doUpdate) {
          tracker.checkpoint('update-start');
          const updateOptions: any = {
            cwd,
            log: (entry: any) => {
              if (!quiet && !jsonMode) {
                ctx.presenter.info(`Update: ${entry.msg || entry}`);
              }
            }
          };
          
          if (since) {updateOptions.since = since;}
          if (timeBudget) {updateOptions.timeBudgetMs = timeBudget;}
          
          updateResult = await updateIndexes(updateOptions);
          tracker.checkpoint('update-complete');
        }
        
        // Step 2: Build pack
        tracker.checkpoint('pack-start');
        const packOptions: any = {
          cwd,
          intent,
          budget: { totalTokens: budget, caps: {}, truncation: 'end' as const },
          log: (entry: any) => {
            if (!quiet && !jsonMode) {
              ctx.presenter.info(`Pack: ${entry.msg || entry}`);
            }
          }
        };
        
        if (product) {packOptions.product = product;}
        if (preset) {packOptions.preset = preset;}
        if (withBundle) {packOptions.withBundle = withBundle;}
        if (seed) {packOptions.seed = seed;}
        
        const packResult = await buildPack(packOptions);
        tracker.checkpoint('pack-complete');
        const duration = tracker.total();
        
        // Prepare data for artifacts (if not using --out flag)
        // If --out is specified, user wants explicit file location, so don't use artifacts
        const artifactData = !outFile ? {
          'pack-output': packResult.markdown,
        } : undefined;
        
        // Step 3: Handle output
        if (jsonMode) {
          const jsonOutput = {
            ok: true,
            mode: doUpdate ? 'update-and-pack' : 'pack-only',
            intent,
            product,
            tokensEstimate: packResult.tokensEstimate,
            out: outFile || null,
            update: updateResult ? {
              delta: updateResult.delta,
              budget: updateResult.budget
            } : null,
            pack: {
              sectionUsage: packResult.json?.sectionUsage || {},
              deterministic: !!seed
            },
            ignoredFlags: ignoredFlags.length > 0 ? ignoredFlags : undefined,
            timing: duration,
            ...(artifactData || {}),
          };
          
          ctx.presenter.json(jsonOutput);
        } else {
          // Handle output to file or stdout
          if (outFile) {
            const absPath = isAbsolute(outFile) ? outFile : join(cwd, outFile);
            await fs.writeFile(absPath, packResult.markdown, 'utf8');
            
            if (!quiet) {
              const summaryLines = keyValue({
                'Status': safeColors.success('✓ Pack saved'),
                'File': absPath,
                'Intent': intent,
                'Product': product || 'none',
                'Tokens': String(packResult.tokensEstimate),
                'Mode': doUpdate ? 'Update + Pack' : 'Pack Only',
              });
              
              if (ignoredFlags.length > 0) {
                summaryLines.push('', `${safeColors.warning('⚠')} Ignored flags: ${ignoredFlags.join(', ')}`);
              }
              
              summaryLines.push('', `Time: ${formatTiming(duration)}`);
              ctx.presenter.write(box('Mind Feed', summaryLines));
            }
          } else {
            // Default: stream Markdown to stdout
            // Show summary to stderr if not quiet
            if (!quiet) {
              const summaryLines = keyValue({
                'Intent': intent,
                'Product': product || 'none',
                'Tokens': String(packResult.tokensEstimate),
                'Mode': doUpdate ? 'Update + Pack' : 'Pack Only',
              });
              
              if (ignoredFlags.length > 0) {
                summaryLines.push('', `${safeColors.warning('⚠')} Ignored flags: ${ignoredFlags.join(', ')}`);
              }
              
              summaryLines.push('', `Time: ${formatTiming(duration)}`);
              ctx.presenter.write(box('Mind Feed', summaryLines));
            }
            // Stream markdown to stdout
            ctx.presenter.write(packResult.markdown);
          }
        }
        
        // Return data for artifacts if available
        if (artifactData) {
          return { exitCode: 0, ...artifactData } as any;
        }

        // Track command completion
        await emit({
          type: ANALYTICS_EVENTS.FEED_FINISHED,
          payload: {
            doUpdate,
            intent,
            product,
            preset,
            budget,
            tokensEstimate: packResult.tokensEstimate,
            durationMs: duration,
            result: 'success',
          },
        });
        
        return 0;
      } catch (e: unknown) {
        const error = wrapError(e, 'MIND_FEED_ERROR');
        const duration = tracker.total();

        // Track command failure
        await emit({
          type: ANALYTICS_EVENTS.FEED_FINISHED,
          payload: {
            doUpdate: !flags['no-update'],
            durationMs: duration,
            result: 'error',
            error: error.message,
          },
        });
        
        if (jsonMode) {
          ctx.presenter.json({
            ok: false,
            code: error.code,
            message: error.message,
            hint: error.hint,
            timing: duration
          });
        } else {
          ctx.presenter.error(error.message);
          if (!quiet) {
            ctx.presenter.info(`Code: ${error.code}`);
            if (error.hint) {
              ctx.presenter.info(error.hint);
            }
          }
        }
        return getExitCode(error);
      }
    }
  )) as number;
};