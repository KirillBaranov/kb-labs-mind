import { defineCommand, type CommandResult } from '@kb-labs/sdk';
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
    const platform = (ctx as any).platform;

    ctx.logger?.debug('Command started', { cwd, scopeId });

    const spinner = ctx.output?.spinner('Building Mind RAG index');
    if (!flags.quiet && !flags.json) {
      spinner?.start();
    }

    ctx.logger?.debug('About to call runRagIndex');
    ctx.tracker?.checkpoint('index');

    //  Config will be loaded automatically by createMindKnowledgeRuntime if not provided
    const result = await runRagIndex({ cwd, scopeId, platform });

    // Track analytics if available
    platform?.analytics?.track?.('mind.rag-index', {
      scopeIds: result.scopeIds,
    }).catch(() => {});

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
      ctx.output?.json({ ok: true, scopes: result.scopeIds, adapters: result.adapters });
    } else if (!flags.quiet) {
      const { ui } = ctx.output!;

      // Check if any adapter is a fallback
      const formatAdapter = (name: string): string => {
        const isFallback = name.includes('(fallback)');
        return isFallback ? `⚠️  ${name}` : `✓ ${name}`;
      };

      const sections: Array<{ header?: string; items: string[] }> = [
        {
          items: [
            `Updated ${scopesLabel}`,
            `Scopes: ${result.scopeIds.join(', ')}`,
          ],
        },
        {
          header: 'Adapters',
          items: [
            `Vector Store: ${formatAdapter(result.adapters.vectorStore)}`,
            `Embeddings:   ${formatAdapter(result.adapters.embeddings)}`,
            `Storage:      ${formatAdapter(result.adapters.storage)}`,
            `LLM:          ${formatAdapter(result.adapters.llm)}`,
            `Cache:        ${formatAdapter(result.adapters.cache)}`,
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
