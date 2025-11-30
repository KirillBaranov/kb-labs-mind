/**
 * Mind feed command - One-shot command for AI tools
 */

import { defineCommand, type CommandResult } from '@kb-labs/shared-command-kit';
import { updateIndexes } from '@kb-labs/mind-indexer';
import { buildPack } from '@kb-labs/mind-pack';
import { DEFAULT_BUDGET, createMindError, wrapError, getExitCode } from '@kb-labs/mind-core';
import { pluginContractsManifest } from '@kb-labs/mind-contracts';
import { parseNumberFlag } from '@kb-labs/shared-cli-ui';
import { MIND_ERROR_CODES } from '../../errors/error-codes';
import { mkdir, writeFile } from 'node:fs/promises';
import { join, dirname, isAbsolute } from 'node:path';
import { ANALYTICS_EVENTS, ANALYTICS_ACTOR } from '../../infra/analytics/events';

const PACK_ARTIFACT_ID =
  pluginContractsManifest.artifacts['mind.pack.output']?.id ?? 'mind.pack.output';
const UPDATE_ARTIFACT_ID =
  pluginContractsManifest.artifacts['mind.update.report']?.id ?? 'mind.update.report';

type MindFeedFlags = {
  cwd: { type: 'string'; description?: string };
  intent: { type: 'string'; description?: string; alias?: string };
  product: { type: 'string'; description?: string; alias?: string };
  preset: { type: 'string'; description?: string };
  budget: { type: 'number'; description?: string; alias?: string };
  'with-bundle': { type: 'boolean'; description?: string; default?: boolean };
  since: { type: 'string'; description?: string };
  'time-budget': { type: 'number'; description?: string };
  'no-update': { type: 'boolean'; description?: string; default?: boolean };
  out: { type: 'string'; description?: string; alias?: string };
  seed: { type: 'number'; description?: string };
  json: { type: 'boolean'; description?: string; default?: boolean };
  verbose: { type: 'boolean'; description?: string; default?: boolean };
  quiet: { type: 'boolean'; description?: string; default?: boolean };
};

type MindFeedResult = CommandResult & {
  pack?: unknown;
  update?: { added?: number; updated?: number; removed?: number };
  artifactIds?: string[];
  outFile?: string;
};

export const run = defineCommand<MindFeedFlags, MindFeedResult>({
  name: 'mind:feed',
  flags: {
    cwd: {
      type: 'string',
      description: 'Working directory',
    },
    intent: {
      type: 'string',
      description: 'Intent description for context',
      alias: 'i',
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
    since: {
      type: 'string',
      description: 'Git reference to update since',
    },
    'time-budget': {
      type: 'number',
      description: 'Time budget in milliseconds',
    },
    'no-update': {
      type: 'boolean',
      description: 'Skip index update, only build pack',
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
    startEvent: ANALYTICS_EVENTS.FEED_STARTED,
    finishEvent: ANALYTICS_EVENTS.FEED_FINISHED,
    actor: ANALYTICS_ACTOR.id,
    includeFlags: true,
  },
  async handler(ctx, argv, flags) {
    const cwd = flags.cwd || ctx.cwd;
    const doUpdate = !flags['no-update'];
    const intent = flags.intent || 'ad-hoc feed';
    const product = flags.product;
    const preset = flags.preset;
    const budget = parseNumberFlag(flags.budget) ?? DEFAULT_BUDGET.totalTokens;
    const withBundle = flags['with-bundle'];
    const since = flags.since;
    const timeBudget = parseNumberFlag(flags['time-budget']);
    const outFile = flags.out;
    const seed = parseNumberFlag(flags.seed);
    
    ctx.tracker.checkpoint('start');
    
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
        await mkdir(dirname(absPath), { recursive: true });
        // Test write access
        await writeFile(absPath, '', 'utf8');
      } catch (error: any) {
        validationErrors.push(`Invalid output path: ${error.message}`);
      }
    }
    
    // Return validation errors
    if (validationErrors.length > 0) {
      const error = createMindError('MIND_BAD_FLAGS', validationErrors.join('; '));
      ctx.output?.error(error instanceof Error ? error : new Error(error.message), {
        code: MIND_ERROR_CODES.FEED_FAILED,
        suggestions: (error as any).hint ? [(error as any).hint] : undefined,
      });
      return { ok: false, exitCode: getExitCode(error) };
    }
    
    let updateResult: any = null;
    
    // Step 1: Update indexes (optional)
    if (doUpdate) {
      ctx.tracker.checkpoint('update-start');
      const updateOptions: any = {
        cwd,
        log: (entry: any) => {
          if (!flags.quiet && !flags.json) {
            ctx.output?.info(`Update: ${entry.msg || entry}`);
          }
        }
      };
      
      if (since) {updateOptions.since = since;}
      if (timeBudget) {updateOptions.timeBudgetMs = timeBudget;}
      
      updateResult = await updateIndexes(updateOptions);
      ctx.tracker.checkpoint('update-complete');
    }
    
    // Step 2: Build pack
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
    
    const packResult = await buildPack(packOptions);
    ctx.tracker.checkpoint('pack-complete');
    
    // Prepare data for artifacts (if not using --out flag)
    // If --out is specified, user wants explicit file location, so don't use artifacts
    const producedArtifacts = doUpdate ? [UPDATE_ARTIFACT_ID, PACK_ARTIFACT_ID] : [PACK_ARTIFACT_ID];

    const artifactData = !outFile
      ? {
          [PACK_ARTIFACT_ID]: packResult.markdown,
        }
      : undefined;
    
    // Step 3: Handle output
    if (flags.json) {
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
        timingMs: ctx.tracker.total(),
        produces: producedArtifacts,
        ...(artifactData || {}),
      };
      
      ctx.output?.json(jsonOutput);
    } else {
      const { ui } = ctx.output!;
      // Handle output to file or stdout
      if (outFile) {
        const absPath = isAbsolute(outFile) ? outFile : join(cwd, outFile);
        await writeFile(absPath, packResult.markdown, 'utf8');
        
        if (!flags.quiet) {
          const sections: Array<{ header?: string; items: string[] }> = [
            {
              header: 'Summary',
              items: [
                `File: ${absPath}`,
                `Intent: ${intent}`,
                `Product: ${product || 'none'}`,
                `Tokens: ${packResult.tokensEstimate}`,
                `Mode: ${doUpdate ? 'Update + Pack' : 'Pack Only'}`,
              ],
            },
            {
              header: 'Artifacts',
              items: [
                `${ui.symbols.success} Mind Feed Pack: Markdown bundle created by feed`,
              ],
            },
          ];

          if (ignoredFlags.length > 0) {
            sections.push({
              header: 'Warnings',
              items: [`Ignored flags: ${ignoredFlags.join(', ')}`],
            });
          }

          const outputText = ui.sideBox({
            title: 'Mind Feed',
            sections,
            status: 'success',
            timing: ctx.tracker.total(),
          });
          ctx.output?.write(outputText);
        }
      } else {
        // Default: stream Markdown to stdout
        // Show summary to stderr if not quiet
        if (!flags.quiet) {
          const sections: Array<{ header?: string; items: string[] }> = [
            {
              items: [
                `Intent: ${intent}`,
                `Product: ${product || 'none'}`,
                `Tokens: ${packResult.tokensEstimate}`,
                `Mode: ${doUpdate ? 'Update + Pack' : 'Pack Only'}`,
              ],
            },
          ];

          if (ignoredFlags.length > 0) {
            sections.push({
              header: 'Warnings',
              items: [`Ignored flags: ${ignoredFlags.join(', ')}`],
            });
          }

          const outputText = ui.sideBox({
            title: 'Mind Feed',
            sections,
            status: 'success',
            timing: ctx.tracker.total(),
          });
          ctx.output?.write(outputText);
        }
        // Stream markdown to stdout
        ctx.output?.write(packResult.markdown);
      }
    }
    
    ctx.logger?.info('Mind feed completed', {
      doUpdate,
      intent,
      product,
      tokensEstimate: packResult.tokensEstimate,
    });
    
    // Return data for artifacts if available
    if (artifactData) {
      return { ok: true, produces: producedArtifacts, ...artifactData };
    }

    return { ok: true, packResult, updateResult };
  },
  async onError(error, ctx, flags) {
    const wrappedError = wrapError(error, 'MIND_FEED_ERROR');
    const errorMessage = wrappedError instanceof Error ? wrappedError.message : String(wrappedError);
    const errorCode = (wrappedError as any).code || MIND_ERROR_CODES.FEED_FAILED;
    const errorHint = (wrappedError as any).hint;

    ctx.logger?.error('Mind feed failed', {
      error: errorMessage,
      cwd: flags.cwd || ctx.cwd,
    });

    ctx.output?.error(wrappedError instanceof Error ? wrappedError : new Error(errorMessage), {
      code: errorCode,
      suggestions: errorHint ? [errorHint] : undefined,
    });

    return { ok: false, exitCode: getExitCode(wrappedError), error: errorMessage };
  },
});
