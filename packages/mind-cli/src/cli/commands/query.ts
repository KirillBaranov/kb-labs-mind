/**
 * Mind query command
 */

import { defineCommand, type CommandResult } from '@kb-labs/cli-command-kit';
import { pluginContractsManifest } from '@kb-labs/mind-contracts';
import {
  formatTiming,
  displayArtifacts,
} from '@kb-labs/shared-cli-ui';
import { MIND_ERROR_CODES } from '../../errors/error-codes.js';
import { resolve, join } from 'node:path';
import { mkdir, writeFile, stat } from 'node:fs/promises';
import { encode } from '@byjohann/toon';
import { ANALYTICS_EVENTS, ANALYTICS_ACTOR } from '../../infra/analytics/events.js';
import {
  runQueryCore,
  parseQueryFromCliFlags,
  parseQueryFromHttpRequest,
  type QueryRuntimeContext
} from '../../application/index.js';

const QUERY_ARTIFACT_ID =
  pluginContractsManifest.artifacts['mind.query.output']?.id ?? 'mind.query.output';

type StatusKind = 'success' | 'warning' | 'error';

function renderStatusLine(label: string, kind: StatusKind, durationMs: number, output: any): string {
  const { ui } = output;
  const symbol =
    kind === 'error' ? ui.symbols.error : kind === 'warning' ? ui.symbols.warning : ui.symbols.success;
  const color =
    kind === 'error' ? ui.colors.error : kind === 'warning' ? ui.colors.warn : ui.colors.success;

  return `${symbol} ${color(label)} · ${ui.colors.muted(formatTiming(durationMs))}`;
}

type MindQueryFlags = {
  cwd: { type: 'string'; description?: string };
  json: { type: 'boolean'; description?: string; default?: boolean };
  compact: { type: 'boolean'; description?: string; default?: boolean };
  'ai-mode': { type: 'boolean'; description?: string; default?: boolean };
  limit: { type: 'number'; description?: string; default?: number };
  depth: { type: 'number'; description?: string; default?: number };
  'cache-mode': { type: 'string'; description?: string; choices?: readonly string[]; default?: string };
  'cache-ttl': { type: 'number'; description?: string; default?: number };
  'no-cache': { type: 'boolean'; description?: string; default?: boolean };
  paths: { type: 'string'; description?: string; choices?: readonly string[]; default?: string };
  quiet: { type: 'boolean'; description?: string; default?: boolean };
  filter: { type: 'string'; description?: string };
  tag: { type: 'string'; description?: string };
  type: { type: 'string'; description?: string };
  product: { type: 'string'; description?: string };
  query: { type: 'string'; description?: string; required: true };
  file: { type: 'string'; description?: string };
  path: { type: 'string'; description?: string };
  scope: { type: 'string'; description?: string };
  toon: { type: 'boolean'; description?: string; default?: boolean };
  'toon-sidecar': { type: 'boolean'; description?: string; default?: boolean };
};

type MindQueryResult = CommandResult & {
  query?: string;
  result?: unknown;
  artifactId?: string;
};

export const run = defineCommand<MindQueryFlags, MindQueryResult>({
  name: 'mind:query',
  flags: {
    cwd: {
      type: 'string',
      description: 'Working directory',
    },
    json: {
      type: 'boolean',
      description: 'JSON output',
      default: false,
    },
    compact: {
      type: 'boolean',
      description: 'Compact JSON',
      default: false,
    },
    'ai-mode': {
      type: 'boolean',
      description: 'AI-optimized mode (summary, suggestions, path compression)',
      default: false,
    },
    limit: {
      type: 'number',
      description: 'Max results',
      default: 500,
    },
    depth: {
      type: 'number',
      description: 'Max depth',
      default: 5,
    },
    'cache-mode': {
      type: 'string',
      description: 'Cache behavior: ci (disabled), local (enabled)',
      choices: ['ci', 'local'] as const,
      default: 'local',
    },
    'cache-ttl': {
      type: 'number',
      description: 'Cache TTL (s)',
      default: 60,
    },
    'no-cache': {
      type: 'boolean',
      description: 'Disable cache (shorthand for cache-mode=ci)',
      default: false,
    },
    paths: {
      type: 'string',
      description: 'Path mode',
      choices: ['id', 'absolute'] as const,
      default: 'id',
    },
    quiet: {
      type: 'boolean',
      description: 'Quiet',
      default: false,
    },
    filter: {
      type: 'string',
      description: 'Filter param (docs query)',
    },
    tag: {
      type: 'string',
      description: 'Tag filter (docs query)',
    },
    type: {
      type: 'string',
      description: 'Type filter (docs query)',
    },
    product: {
      type: 'string',
      description: 'Product ID (meta query)',
    },
    query: {
      type: 'string',
      description: 'Query name (impact, scope, exports, externals, chain, meta, docs)',
      required: true,
    },
    file: {
      type: 'string',
      description: 'File path (for impact, exports, chain queries)',
    },
    path: {
      type: 'string',
      description: 'Path (for scope query)',
    },
    scope: {
      type: 'string',
      description: 'Scope path (for externals query)',
    },
    toon: {
      type: 'boolean',
      description: 'Output in TOON format (token-efficient LLM format)',
      default: false,
    },
    'toon-sidecar': {
      type: 'boolean',
      description: 'Write TOON sidecar file (.kb/mind/query/<queryId>.toon)',
      default: false,
    },
  },
  analytics: {
    startEvent: ANALYTICS_EVENTS.QUERY_STARTED,
    finishEvent: ANALYTICS_EVENTS.QUERY_FINISHED,
    actor: ANALYTICS_ACTOR.id,
    includeFlags: true,
  },
  async handler(ctx, argv, flags) {
    const compact = flags.compact;
    const toonMode = flags.toon;
    const toonSidecar = flags['toon-sidecar'];
    
    const cwd = flags.cwd || ctx.cwd;
    const queryName = flags.query;

    if (!queryName || !['impact', 'scope', 'exports', 'externals', 'chain', 'meta', 'docs'].includes(queryName)) {
      ctx.output?.error(new Error('Invalid query name'), {
        code: MIND_ERROR_CODES.QUERY_INVALID_NAME,
        suggestions: [
          'Available queries: impact, scope, exports, externals, chain, meta, docs',
          'Use: kb mind query <query-name> --help for more info',
        ],
      });
      return { ok: false, exitCode: 1 };
    }
    
    ctx.tracker.checkpoint('start');
    
    // Parse params based on query type
    const params: Record<string, any> = {};
    if (queryName === 'impact' || queryName === 'exports' || queryName === 'chain') {
      if (!flags.file) {
        ctx.output?.error(new Error(`Query '${queryName}' requires --file flag`), {
          code: MIND_ERROR_CODES.QUERY_MISSING_FILE,
          suggestions: [
            `Use: kb mind query ${queryName} --file <path>`,
          ],
        });
        return { ok: false, exitCode: 1 };
      }
      params.file = resolve(cwd, flags.file);
    } else if (queryName === 'scope') {
      if (!flags.path) {
        ctx.output?.error(new Error(`Query 'scope' requires --path flag`), {
          code: MIND_ERROR_CODES.QUERY_MISSING_PATH,
          suggestions: [
            'Use: kb mind query scope --path <path>',
          ],
        });
        return { ok: false, exitCode: 1 };
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
    
    ctx.tracker.checkpoint('query-start');

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
        if (!flags.quiet && !flags.json) {
          ctx.output?.debug(message, { level });
        }
      },
    };

    const queryResult = await runQueryCore(queryInput, runtimeContext);
    ctx.tracker.checkpoint('query-complete');
    
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
        if (flags.json) {
          // Output as JSON with toon content
          ctx.output?.json({
            ok: true,
            format: 'toon',
            content: toonOutput,
            produces: [QUERY_ARTIFACT_ID],
          });
        } else {
          if (!flags.quiet) {
            const { ui } = ctx.output!;
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

            summaryLines.push('', renderStatusLine('Query ready', 'success', ctx.tracker.total(), ctx.output));
            ctx.output?.write('\n' + ui.box('Mind Query (TOON)', summaryLines));
          }
          ctx.output?.write(toonOutput);
        }

        ctx.logger?.info('Mind query completed', {
          queryName,
          toonMode,
          toonSidecar,
          cached: queryResult.meta?.cached,
          tokensEstimate: queryResult.meta?.tokensEstimate,
        });

        // Return data for artifacts if using --toon-sidecar
        if (artifactData) {
          return { ok: true, produces: [QUERY_ARTIFACT_ID], ...artifactData };
        }
        return { ok: true };
      }

      // Non-TOON mode but sidecar requested -> just record artifact info
      if (artifactData) {
        if (sidecarArtifact) {
          ctx.output?.info(`TOON sidecar written to ${sidecarArtifact.path}`);
        }
      }
    }

    const { meta, result: queryData } = queryResult;
    
    if (flags.json) {
      ctx.output?.json({
        ok: true,
        query: queryName,
        params,
        result: queryData,
        meta,
      });
    } else {
      if (!flags.quiet) {
        const { ui } = ctx.output!;
        const summaryLines: string[] = [];
        summaryLines.push(
          ...ui.keyValue({
            Query: queryName,
            Duration: formatTiming(ctx.tracker.total()),
            Cached: meta?.cached ? 'Yes' : 'No',
          }),
        );

        if (meta?.tokensEstimate !== undefined) {
          summaryLines.push(`Token Estimate: ${meta.tokensEstimate}`);
        }

        if (meta?.filesScanned !== undefined) {
          summaryLines.push(`Files Scanned: ${meta.filesScanned}`);
        }

        ctx.output?.write('\n' + ui.box('Mind Query', summaryLines));
      }

      if (compact) {
        ctx.output?.write(JSON.stringify(queryData, null, 2));
      } else {
        ctx.output?.write(JSON.stringify(queryData, null, 2));
      }
    }

    ctx.logger?.info('Mind query completed', {
      queryName,
      cached: meta?.cached,
      tokensEstimate: meta?.tokensEstimate,
    });

    return { ok: true, result: queryData, meta };
  },
  async onError(error, ctx, flags) {
    const errorMessage = error instanceof Error ? error.message : String(error);

    ctx.logger?.error('Mind query failed', {
      error: errorMessage,
      queryName: flags.query,
    });

    ctx.output?.error(error, {
      code: MIND_ERROR_CODES.QUERY_EXECUTION_FAILED,
      suggestions: [
        'Check that Mind is initialized',
        'Verify query parameters are correct',
        'Try: kb mind verify to check workspace consistency',
      ],
    });

    return { ok: false, exitCode: 1, error: errorMessage };
  },
});
