import { defineCommand, type CommandResult } from '@kb-labs/shared-command-kit';
import { runRagIndex } from '../../application/rag';
import { MIND_ERROR_CODES } from '../../errors/error-codes';

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
    ctx.logger?.debug('RAG-INDEX handler entry point');
    ctx.logger?.debug('Flags', { cwd: flags.cwd, scope: flags.scope, json: flags.json, quiet: flags.quiet });

    const cwd = flags.cwd || ctx.cwd;
    const scopeId = flags.scope;

    ctx.logger?.debug('Command started', { cwd, scopeId });

    const spinner = ctx.output?.spinner('Building Mind RAG index');
    if (!flags.quiet && !flags.json) {
      spinner?.start();
    }

    ctx.logger?.debug('About to call runRagIndex');
    ctx.tracker?.checkpoint('index');

    const result = await runRagIndex({ cwd, scopeId });

    ctx.logger?.debug('runRagIndex completed successfully');
    ctx.tracker?.checkpoint('complete');

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

      const sections: Array<{ header?: string; items: string[] }> = [
        {
          items: [
            `Updated ${scopesLabel}`,
            `Scopes: ${result.scopeIds.join(', ')}`,
          ],
        },
      ];

      const outputText = ui.sideBox({
        title: 'Mind RAG Index',
        sections,
        status: 'success',
        timing: ctx.tracker.total(),
      });
      ctx.output?.write(outputText);
    }

    return { ok: true, scopes: result.scopeIds };
  },
  // TODO: onError handler removed - no longer supported in CommandConfig
});
