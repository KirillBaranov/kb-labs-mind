/**
 * Mind pack command
 */

import { defineCommand, type CommandResult } from '@kb-labs/shared-command-kit';
import { buildPack } from '@kb-labs/mind-pack';
import { DEFAULT_BUDGET } from '@kb-labs/mind-core';
import { pluginContractsManifest } from '@kb-labs/mind-contracts';
import { parseNumberFlag } from '@kb-labs/shared-cli-ui';
import { MIND_ERROR_CODES } from '../../errors/error-codes';
import { writeFile } from 'node:fs/promises';
import { join, isAbsolute } from 'node:path';
import { ANALYTICS_EVENTS, ANALYTICS_ACTOR } from '../../infra/analytics/events';

const PACK_ARTIFACT_ID =
  pluginContractsManifest.artifacts['mind.pack.output']?.id ?? 'mind.pack.output';

type MindPackFlags = {
  cwd: { type: 'string'; description?: string };
  intent: { type: 'string'; description?: string; alias?: string; required: true };
  product: { type: 'string'; description?: string; alias?: string };
  preset: { type: 'string'; description?: string };
  budget: { type: 'number'; description?: string; alias?: string };
  'with-bundle': { type: 'boolean'; description?: string; default?: boolean };
  out: { type: 'string'; description?: string; alias?: string };
  seed: { type: 'number'; description?: string };
  json: { type: 'boolean'; description?: string; default?: boolean };
  verbose: { type: 'boolean'; description?: string; default?: boolean };
  quiet: { type: 'boolean'; description?: string; default?: boolean };
};

type MindPackResult = CommandResult & {
  pack?: unknown;
  artifactId?: string;
  outFile?: string;
};

export const run = defineCommand<MindPackFlags, MindPackResult>({
  name: 'mind:pack',
  flags: {
    cwd: {
      type: 'string',
      description: 'Working directory',
    },
    intent: {
      type: 'string',
      description: 'Intent description for context',
      alias: 'i',
      required: true,
    },
    product: {
      type: 'string',
      description: 'Product name',
      alias: 'p',
    },
    preset: {
      type: 'string',
      description: 'Context preset name',
    },
    budget: {
      type: 'number',
      description: 'Token budget',
      alias: 'b',
    },
    'with-bundle': {
      type: 'boolean',
      description: 'Include bundle information',
      default: false,
    },
    out: {
      type: 'string',
      description: 'Output file path',
      alias: 'o',
    },
    seed: {
      type: 'number',
      description: 'Random seed for deterministic output',
    },
    json: {
      type: 'boolean',
      description: 'Output in JSON format',
      default: false,
    },
    verbose: {
      type: 'boolean',
      description: 'Verbose output',
      default: false,
    },
    quiet: {
      type: 'boolean',
      description: 'Quiet output',
      default: false,
    },
  },
  analytics: {
    startEvent: ANALYTICS_EVENTS.PACK_STARTED,
    finishEvent: ANALYTICS_EVENTS.PACK_FINISHED,
    actor: ANALYTICS_ACTOR.id,
    includeFlags: true,
  },
  async handler(ctx, argv, flags) {
    const cwd = flags.cwd || ctx.cwd;
    const intent = flags.intent;
    const product = flags.product;
    const preset = flags.preset;
    const budget = parseNumberFlag(flags.budget) ?? DEFAULT_BUDGET.totalTokens;
    const withBundle = flags['with-bundle'];
    const outFile = flags.out;
    const seed = parseNumberFlag(flags.seed);

    // Input validation
    if (!intent) {
      ctx.output?.error(new Error('Intent is required'), {
        code: MIND_ERROR_CODES.PACK_MISSING_SOURCE,
        suggestions: ['Use --intent flag to specify the context intent'],
      });
      return { ok: false, exitCode: 1 };
    }
    
    if (budget <= 0) {
      ctx.output?.error(new Error('Budget must be greater than 0'), {
        code: MIND_ERROR_CODES.PACK_MISSING_SOURCE,
        suggestions: ['Use --budget flag with a positive number'],
      });
      return { ok: false, exitCode: 1 };
    }

    ctx.tracker.checkpoint('pack-start');
    const packOptions: any = {
      cwd,
      intent,
      budget: { totalTokens: budget, caps: {}, truncation: 'end' as const },
      log: (entry: any) => {
        if (!flags.quiet && !flags.json) {
          ctx.output?.info(`Pack: ${entry.msg || entry}`);
        }
      }
    };
    
    if (product) {packOptions.product = product;}
    if (preset) {packOptions.preset = preset;}
    if (withBundle) {packOptions.withBundle = withBundle;}
    if (seed) {packOptions.seed = seed;}
    
    const result = await buildPack(packOptions);
    ctx.tracker.checkpoint('pack-complete');
    
    // Prepare data for artifacts (if not using --out flag)
    // If --out is specified, user wants explicit file location, so don't use artifacts
    const artifactData = !outFile
      ? {
          [PACK_ARTIFACT_ID]: result.markdown,
        }
      : undefined;
    
    if (flags.json) {
      ctx.output?.json({
        ok: true,
        intent,
        product,
        tokensEstimate: result.tokensEstimate,
        sectionUsage: result.json?.sectionUsage || {},
        withBundle,
        seed,
        deterministic: !!seed,
        timingMs: ctx.tracker.total(),
        produces: [PACK_ARTIFACT_ID],
        ...(artifactData || {}),
      });
    } else {
      const { ui } = ctx.output!;
      // Handle output to file or stdout
      if (outFile) {
        const absPath = isAbsolute(outFile) ? outFile : join(cwd, outFile);
        try {
          await writeFile(absPath, result.markdown, 'utf8');
          
          if (!flags.quiet) {
            const sections: Array<{ header?: string; items: string[] }> = [
              {
                header: 'Summary',
                items: [
                  `File: ${absPath}`,
                  `Intent: ${intent}`,
                  `Product: ${product || 'none'}`,
                  `Tokens: ${result.tokensEstimate}`,
                ],
              },
              {
                header: 'Artifacts',
                items: [
                  `${ui.symbols.success} Mind Pack: Markdown bundle saved to disk`,
                ],
              },
            ];

            const outputText = ui.sideBox({
              title: 'Mind Pack',
              sections,
              status: 'success',
              timing: ctx.tracker.total(),
            });
            ctx.output?.write(outputText);
          }
        } catch (writeError: any) {
          const errorMessage = writeError instanceof Error ? writeError.message : String(writeError);
          
          ctx.output?.error(writeError instanceof Error ? writeError : new Error(errorMessage), {
            code: MIND_ERROR_CODES.PACK_FAILED,
            suggestions: ['Check file permissions and path'],
          });
          return { ok: false, exitCode: 1, error: errorMessage };
        }
      } else {
        // Default: stream Markdown to stdout
        // Show summary if not quiet
        if (!flags.quiet) {
          const sections: Array<{ header?: string; items: string[] }> = [
            {
              items: [
                `Intent: ${intent}`,
                `Product: ${product || 'none'}`,
                `Tokens: ${result.tokensEstimate}`,
              ],
            },
          ];

          const outputText = ui.sideBox({
            title: 'Mind Pack',
            sections,
            status: 'success',
            timing: ctx.tracker.total(),
          });
          ctx.output?.write(outputText);
        }
        // Also return data for artifacts
        ctx.output?.write(result.markdown);
      }
    }
    
    ctx.logger?.info('Mind pack completed', {
      intent,
      product,
      tokensEstimate: result.tokensEstimate,
      withBundle,
      deterministic: !!seed,
    });

    // Return data for artifacts (will be wrapped in ExecuteResult by runner)
    if (artifactData) {
      return { ok: true, produces: [PACK_ARTIFACT_ID], ...artifactData };
    }

    return { ok: true, result };
  },
  async onError(error, ctx, flags) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorCode = error instanceof Error && 'code' in error ? (error as any).code : 'MIND_PACK_ERROR';

    ctx.logger?.error('Mind pack failed', {
      error: errorMessage,
      cwd: flags.cwd || ctx.cwd,
    });

    ctx.output?.error(error instanceof Error ? error : new Error(errorMessage), {
      code: MIND_ERROR_CODES.PACK_FAILED,
      suggestions: ['Check your workspace and indexes'],
    });

    return { ok: false, exitCode: 1, error: errorMessage };
  },
});
