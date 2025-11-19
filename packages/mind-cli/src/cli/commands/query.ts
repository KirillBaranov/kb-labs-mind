/**
 * Mind query command
 */

import type { CommandModule } from '../types.js';
import { executeQuery } from '@kb-labs/mind-query';
import type { QueryName } from '@kb-labs/mind-types';
import { pluginContractsManifest } from '@kb-labs/mind-contracts';
import {
  TimingTracker,
  formatTiming,
  displayArtifacts,
} from '@kb-labs/shared-cli-ui';
import { MIND_ERROR_CODES } from '../../errors/error-codes.js';
import { resolve, join } from 'node:path';
import { mkdir, writeFile, stat } from 'node:fs/promises';
import { encode } from '@byjohann/toon';
import { runScope, type AnalyticsEventV1, type EmitResult } from '@kb-labs/analytics-sdk-node';
import { ANALYTICS_EVENTS, ANALYTICS_ACTOR } from '../../infra/analytics/events.js';
import {
  runQueryCore,
  parseQueryFromCliFlags,
  parseQueryFromHttpRequest,
  type QueryRuntimeContext
} from '../../application/index.js';

const QUERY_ARTIFACT_ID =
  pluginContractsManifest.artifacts['mind.query.output']?.id ?? 'mind.query.output';

export const run: CommandModule['run'] = async (ctx, argv, flags) => {
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
      const tracker = new TimingTracker();
      try {
  
        if (!queryName || !['impact', 'scope', 'exports', 'externals', 'chain', 'meta', 'docs'].includes(queryName)) {
          ctx.output.error(new Error('Invalid query name'), {
            code: MIND_ERROR_CODES.QUERY_INVALID_NAME,
            suggestions: [
              'Available queries: impact, scope, exports, externals, chain, meta, docs',
              'Use: kb mind query <query-name> --help for more info',
            ],
          });
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
        
        tracker.checkpoint('start');
        
        // Parse params based on query type
        const params: Record<string, any> = {};
        if (queryName === 'impact' || queryName === 'exports' || queryName === 'chain') {
          if (!flags.file) {
            ctx.output.error(new Error(`Query '${queryName}' requires --file flag`), {
              code: MIND_ERROR_CODES.QUERY_MISSING_FILE,
              suggestions: [
                `Use: kb mind query ${queryName} --file <path>`,
              ],
            });
            return 1;
          }
          params.file = resolve(cwd, flags.file);
        } else if (queryName === 'scope') {
          if (!flags.path) {
            ctx.output.error(new Error(`Query 'scope' requires --path flag`), {
              code: MIND_ERROR_CODES.QUERY_MISSING_PATH,
              suggestions: [
                'Use: kb mind query scope --path <path>',
              ],
            });
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
        
        tracker.checkpoint('query-start');

        const queryInput = {
          query: queryName as string,
          params,
          options: {
            cwd,
            limit: Number(flags.limit) || 500,
            depth: Number(flags.depth) || 5,
            cacheTtl: Number(flags['cache-ttl']) || 60,
            cacheMode: (flags['cache-mode'] as 'ci' | 'local') || 'local',
            noCache: !!flags['no-cache'],
            pathMode: (flags.paths as 'id' | 'absolute') || 'id',
            aiMode: !!flags['ai-mode'],
          },
          output: toonSidecar
            ? {
                toonSidecar: true,
                toonPath:
                  typeof flags['toon-path'] === 'string' ? resolve(cwd, flags['toon-path']) : undefined,
              }
            : undefined,
        };

        const runtimeContext: QueryRuntimeContext = {
          workdir: cwd,
          outdir: join(cwd, '.kb', 'mind'),
          fs: {
            mkdir: async (path, options) => {
              await mkdir(path, { recursive: options?.recursive ?? false });
            },
            writeFile: async (path, data, encoding = 'utf8') => {
              await writeFile(path, data, { encoding: encoding as BufferEncoding });
            },
          },
          log: (level, message) => {
            if (!ctx.output.isQuiet && !ctx.output.isJSON) {
              ctx.output.debug(message, { level });
            }
          },
        };

        const queryResult = await runQueryCore(queryInput, runtimeContext);
        tracker.checkpoint('query-complete');
        
        // Handle TOON output (token-efficient LLM format)
        let sidecarArtifact: {
          name: string;
          path: string;
          size: number;
          modified: Date;
          description: string;
        } | null = null;

        if (toonMode || toonSidecar) {
          const toonOutput = encode(queryResult.result);

          // Prepare data for artifacts (if using --toon-sidecar)
          // If --toon-sidecar is specified, also write via artifacts system
          const artifactData = toonSidecar
            ? {
                [QUERY_ARTIFACT_ID]: toonOutput,
              }
            : undefined;

          // Write sidecar file if requested (manual write for backward compatibility)
          let sidecarPath: string | undefined;
          if (queryResult.toonPath) {
            sidecarPath = queryResult.toonPath;
          } else if (toonSidecar) {
            sidecarPath = join(cwd, '.kb', 'mind', 'query', `${queryResult.meta?.queryId || 'query'}.toon`);
          }

          if (sidecarPath) {
            try {
              const stats = await stat(sidecarPath);
              sidecarArtifact = {
                name: 'Query TOON',
                path: sidecarPath,
                size: stats.size,
                modified: stats.mtime,
                description: 'Serialized query output',
              };
            } catch {
              // ignore missing stats
            }
          }

          // Output TOON format
          if (toonMode) {
            if (ctx.output.isJSON) {
              // Output as JSON with toon content
              ctx.output.json({
                ok: true,
                format: 'toon',
                content: toonOutput,
                produces: [QUERY_ARTIFACT_ID],
              });
            } else {
              if (!ctx.output.isQuiet) {
                const { ui } = ctx.output;
                const summaryLines: string[] = [];
                summaryLines.push(
                  ...ui.keyValue({
                    Query: queryName,
                    Format: 'TOON',
                  }),
                );

                if (sidecarArtifact) {
                  summaryLines.push('');
                  summaryLines.push(
                    ...displayArtifacts([sidecarArtifact], {
                      title: 'Artifacts',
                      showDescription: true,
                      showTime: false,
                      maxItems: 1,
                    }),
                  );
                }

                summaryLines.push('', renderStatusLine('Query ready', 'success', tracker.total(), ctx.output));
                ctx.output.write('\n' + ui.box('Mind Query (TOON)', summaryLines));
              }
              ctx.output.write(toonOutput);
            }

            // Track command completion
            await emit({
              type: ANALYTICS_EVENTS.QUERY_FINISHED,
              payload: {
                queryName,
                toonMode,
                toonSidecar,
                cached: queryResult.meta?.cached,
                tokensEstimate: queryResult.meta?.tokensEstimate,
                durationMs: tracker.total(),
                result: 'success',
              },
            });

            // Return data for artifacts if using --toon-sidecar
            if (artifactData) {
              return { exitCode: 0, produces: [QUERY_ARTIFACT_ID], ...artifactData } as any;
            }
            return 0;
          }

          // Non-TOON mode but sidecar requested -> just record artifact info
          if (artifactData) {
            if (sidecarArtifact) {
              ctx.output.info(`TOON sidecar written to ${sidecarArtifact.path}`);
            }
          }
        }

        const { meta, result: queryData } = queryResult;
        
        if (ctx.output.isJSON) {
          ctx.output.json({
            ok: true,
            query: queryName,
            params,
            result: queryData,
            meta,
          });
        } else {
          if (!ctx.output.isQuiet) {
            const { ui } = ctx.output;
            const summaryLines: string[] = [];
            summaryLines.push(
              ...ui.keyValue({
                Query: queryName,
                Duration: formatTiming(tracker.total()),
                Cached: meta?.cached ? 'Yes' : 'No',
              }),
            );

            if (meta?.tokensEstimate !== undefined) {
              summaryLines.push(`Token Estimate: ${meta.tokensEstimate}`);
            }

            if (meta?.filesScanned !== undefined) {
              summaryLines.push(`Files Scanned: ${meta.filesScanned}`);
            }

            ctx.output.write('\n' + ui.box('Mind Query', summaryLines));
          }

          if (compact) {
            ctx.output.write(JSON.stringify(queryData, null, 2));
          } else {
            ctx.output.write(JSON.stringify(queryData, null, 2));
          }
        }

        // Track command completion
        await emit({
          type: ANALYTICS_EVENTS.QUERY_FINISHED,
          payload: {
            queryName,
            toonMode,
            toonSidecar,
            cached: meta?.cached,
            tokensEstimate: meta?.tokensEstimate,
            durationMs: tracker.total(),
            result: 'success',
          },
        });
        
        return 0;
      } catch (error: any) {
        const duration = tracker.total();

        // Track command failure
        await emit({
          type: ANALYTICS_EVENTS.QUERY_FINISHED,
          payload: {
            queryName: flags.query as string,
            toonMode,
            toonSidecar,
            durationMs: duration,
            result: 'error',
            error: error.message,
          },
        });

        ctx.output.error(error, {
          code: MIND_ERROR_CODES.QUERY_EXECUTION_FAILED,
          suggestions: [
            'Check that Mind is initialized',
            'Verify query parameters are correct',
            'Try: kb mind verify to check workspace consistency',
          ],
        });
        return 1;
      }
    }
  )) as number | void;
};

type StatusKind = 'success' | 'warning' | 'error';

function renderStatusLine(label: string, kind: StatusKind, durationMs: number, output: any): string {
  const { ui } = output;
  const symbol =
    kind === 'error' ? ui.symbols.error : kind === 'warning' ? ui.symbols.warning : ui.symbols.success;
  const color =
    kind === 'error' ? ui.colors.error : kind === 'warning' ? ui.colors.warn : ui.colors.success;

  return `${symbol} ${color(label)} · ${ui.colors.muted(formatTiming(durationMs))}`;
}

