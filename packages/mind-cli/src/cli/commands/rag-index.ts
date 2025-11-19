import { defineCommand, type CommandResult } from '@kb-labs/cli-command-kit';
import { runRagIndex } from '../../application/rag.js';
import { MIND_ERROR_CODES } from '../../errors/error-codes.js';

type MindRagIndexFlags = {
  cwd: { type: 'string'; description?: string };
  scope: { type: 'string'; description?: string };
  json: { type: 'boolean'; description?: string; default?: boolean };
  quiet: { type: 'boolean'; description?: string; default?: boolean };
};

type MindRagIndexResult = CommandResult & {
  scopes?: string[];
};

export const run = defineCommand<MindRagIndexFlags, MindRagIndexResult>({
  name: 'mind:rag-index',
  flags: {
    cwd: {
      type: 'string',
      description: 'Working directory',
    },
    scope: {
      type: 'string',
      description: 'Scope ID to rebuild (default: all scopes)',
    },
    json: {
      type: 'boolean',
      description: 'Output in JSON format',
      default: false,
    },
    quiet: {
      type: 'boolean',
      description: 'Quiet output',
      default: false,
    },
  },
  async handler(ctx, argv, flags) {
    const cwd = flags.cwd || ctx.cwd;
    const scopeId = flags.scope;
    
    const spinner = ctx.output?.spinner('Building Mind RAG index');
    if (!flags.quiet && !flags.json) {
      spinner?.start();
    }

    ctx.tracker.checkpoint('index');

    const result = await runRagIndex({ cwd, scopeId });

    ctx.tracker.checkpoint('complete');

    if (!flags.quiet && !flags.json) {
      spinner?.succeed('Mind RAG index updated');
    }

    const scopesLabel =
      result.scopeIds.length === 1
        ? `scope "${result.scopeIds[0]}"`
        : `${result.scopeIds.length} scopes`;

    if (flags.json) {
      ctx.output?.json({ ok: true, scopes: result.scopeIds });
    } else if (!flags.quiet) {
      const { ui } = ctx.output!;
      ctx.output?.success(
        `${ui.symbols.success} ${ui.colors.success('Mind knowledge index updated')} (${scopesLabel})`,
        { scopes: result.scopeIds },
      );
    }

    return { ok: true, scopes: result.scopeIds };
  },
  async onError(error, ctx, flags) {
    const spinner = ctx.output?.spinner('Building Mind RAG index');
    if (!flags.quiet && !flags.json) {
      spinner?.fail('Mind RAG index failed');
    }

    const message = error instanceof Error ? error.message : String(error);
    ctx.output?.error(error instanceof Error ? error : new Error(message), {
      code: MIND_ERROR_CODES.RAG_INDEX_FAILED,
      suggestions: [
        'Check that Mind is initialized',
        'Verify that source files are accessible',
        'Try: kb mind init',
      ],
    });

    return { ok: false, exitCode: 1, error: message };
  },
});
