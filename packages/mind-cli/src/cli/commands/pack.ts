/**
 * Mind pack command
 */

import type { CommandModule } from '../types.js';
import { buildPack } from '@kb-labs/mind-pack';
import { DEFAULT_BUDGET } from '@kb-labs/mind-core';
import { pluginContractsManifest } from '@kb-labs/mind-contracts';
import {
  TimingTracker,
  box,
  keyValue,
  formatTiming,
  safeColors,
  safeSymbols,
  parseNumberFlag,
  displayArtifacts,
} from '@kb-labs/shared-cli-ui';
import { writeFile } from 'node:fs/promises';
import { join, isAbsolute } from 'node:path';
import { runScope, type AnalyticsEventV1, type EmitResult } from '@kb-labs/analytics-sdk-node';
import { ANALYTICS_EVENTS, ANALYTICS_ACTOR } from '../../infra/analytics/events.js';

const PACK_ARTIFACT_ID =
  pluginContractsManifest.artifacts['mind.pack.output']?.id ?? 'mind.pack.output';

export const run: CommandModule['run'] = async (ctx, argv, flags): Promise<number | void> => {
  const jsonMode = !!flags.json;
  const quiet = !!flags.quiet;
  
  // Parse flags with defaults
  const cwd = typeof flags.cwd === 'string' && flags.cwd ? flags.cwd : ctx.cwd;
  const intent = typeof flags.intent === 'string' && flags.intent ? flags.intent : undefined;
  const product = typeof flags.product === 'string' ? flags.product : undefined;
  const preset = typeof flags.preset === 'string' ? flags.preset : undefined;
  const budget = parseNumberFlag(flags.budget) ?? DEFAULT_BUDGET.totalTokens;
  const withBundle = !!flags['with-bundle'];
  const outFile = typeof flags.out === 'string' && flags.out ? flags.out : undefined;
  const seed = parseNumberFlag(flags.seed);

  return (await runScope(
    {
      actor: ANALYTICS_ACTOR,
      ctx: { workspace: cwd },
    },
    async (emit: (event: Partial<AnalyticsEventV1>) => Promise<EmitResult>) => {
      const tracker = new TimingTracker();
      
      try {
        tracker.checkpoint('start');
        
        // Input validation
        if (!intent) {
          const errorData = {
            ok: false,
            code: 'MIND_BAD_FLAGS',
            message: 'Intent is required',
            hint: 'Use --intent flag to specify the context intent',
            timing: tracker.total()
          };
          
          await emit({
            type: ANALYTICS_EVENTS.PACK_FINISHED,
            payload: {
              durationMs: tracker.total(),
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
            hint: 'Use --budget flag with a positive number',
            timing: tracker.total()
          };
          
          await emit({
            type: ANALYTICS_EVENTS.PACK_FINISHED,
            payload: {
              durationMs: tracker.total(),
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
        
        const result = await buildPack(packOptions);
        tracker.checkpoint('pack-complete');
        const duration = tracker.total();
        
        // Prepare data for artifacts (if not using --out flag)
        // If --out is specified, user wants explicit file location, so don't use artifacts
        const artifactData = !outFile
          ? {
              [PACK_ARTIFACT_ID]: result.markdown,
            }
          : undefined;
        
        if (jsonMode) {
          ctx.presenter.json({
            ok: true,
            intent,
            product,
            tokensEstimate: result.tokensEstimate,
            sectionUsage: result.json?.sectionUsage || {},
            withBundle,
            seed,
            deterministic: !!seed,
            timing: duration,
            produces: [PACK_ARTIFACT_ID],
            ...(artifactData || {}),
          });
        } else {
          // Handle output to file or stdout
          if (outFile) {
            const absPath = isAbsolute(outFile) ? outFile : join(cwd, outFile);
            try {
              await writeFile(absPath, result.markdown, 'utf8');
              
              if (!quiet) {
                const summaryLines: string[] = [];
                summaryLines.push(
                  ...keyValue({
                    File: absPath,
                    Intent: intent,
                    Product: product || 'none',
                    Tokens: String(result.tokensEstimate),
                  }),
                );

                summaryLines.push('');
                summaryLines.push(
                  ...displayArtifacts(
                    [
                      {
                        name: 'Mind Pack',
                        path: absPath,
                        size: Buffer.byteLength(result.markdown, 'utf8'),
                        modified: new Date(),
                        description: 'Markdown bundle saved to disk',
                      },
                    ],
                    {
                      title: 'Artifacts',
                      showDescription: true,
                      showTime: false,
                      maxItems: 1,
                    },
                  ),
                );

                summaryLines.push('', renderStatusLine('Pack saved', 'success', duration));
                ctx.presenter.write('\n' + box('Mind Pack', summaryLines));
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
                  durationMs: duration,
                  result: 'error',
                  error: errorMessage,
                },
              });
              
              const errorData = {
                ok: false,
                code: errorCode,
                message: errorMessage,
                hint: 'Check file permissions and path',
                timing: duration
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
            // Show summary if not quiet
            if (!quiet) {
              const summaryLines: string[] = [];
              summaryLines.push(
                ...keyValue({
                  Intent: intent,
                  Product: product || 'none',
                  Tokens: String(result.tokensEstimate),
                }),
              );

              summaryLines.push('', renderStatusLine('Pack ready', 'success', duration));
              ctx.presenter.write('\n' + box('Mind Pack', summaryLines));
            }
            // Also return data for artifacts
            ctx.presenter.write(result.markdown);
          }
        }
        
        // Return data for artifacts (will be wrapped in ExecuteResult by runner)
        // Return object with exit code and artifact data
        if (artifactData) {
          return { exitCode: 0, produces: [PACK_ARTIFACT_ID], ...artifactData } as any;
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
            durationMs: duration,
            result: 'success',
          },
        });
        
        // Return exit code (0 for success)
        // If artifactData was set, it will be returned above
        return 0;
      } catch (e: unknown) {
        const errorMessage = e instanceof Error ? e.message : String(e);
        const errorCode = e instanceof Error && 'code' in e ? (e as any).code : 'MIND_PACK_ERROR';
        const duration = tracker.total();

        // Track command failure
        await emit({
          type: ANALYTICS_EVENTS.PACK_FINISHED,
          payload: {
            intent,
            product,
            budget,
            durationMs: duration,
            result: 'error',
            error: errorMessage,
          },
        });
        
        const errorData = {
          ok: false,
          code: errorCode,
          message: errorMessage,
          hint: 'Check your workspace and indexes',
          timing: duration
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
  )) as number;
};

type StatusKind = 'success' | 'warning' | 'error';

function renderStatusLine(label: string, kind: StatusKind, durationMs: number): string {
  const symbol =
    kind === 'error' ? safeSymbols.error : kind === 'warning' ? safeSymbols.warning : safeSymbols.success;
  const color =
    kind === 'error' ? safeColors.error : kind === 'warning' ? safeColors.warning : safeColors.success;

  return `${symbol} ${color(label)} · ${safeColors.muted(formatTiming(durationMs))}`;
}