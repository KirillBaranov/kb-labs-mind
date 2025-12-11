import { defineCommand, type CommandResult, useConfig } from '@kb-labs/sdk';
import { runRagIndex } from '../../application/rag';
import { MIND_ERROR_CODES } from '../../errors/error-codes';

type MindRagIndexFlags = {
  cwd: { type: 'string'; description?: string };
  scope: { type: 'string'; description?: string };
  include: { type: 'string'; description?: string };
  exclude: { type: 'string'; description?: string };
  skipDeduplication: { type: 'boolean'; description?: string; default?: boolean };
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
    include: {
      type: 'string',
      description: 'Glob pattern to include specific files (for testing)',
    },
    exclude: {
      type: 'string',
      description: 'Glob pattern to exclude files',
    },
    skipDeduplication: {
      type: 'boolean',
      description: 'Skip deduplication checks (faster for fresh indexes)',
      default: false,
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
    ctx.logger?.debug('Flags', {
      cwd: flags.cwd,
      scope: flags.scope,
      include: flags.include,
      exclude: flags.exclude,
      json: flags.json,
      quiet: flags.quiet
    });

    // Get Mind config using useConfig() helper (auto-detects 'mind' from manifest.configSection)
    const mindConfig = await useConfig();
    console.log('[rag-index] mindConfig from useConfig():', mindConfig ? 'EXISTS' : 'UNDEFINED');
    if (mindConfig) {
      console.log('[rag-index] mindConfig.scopes:', (mindConfig as any)?.scopes ? 'EXISTS' : 'NO SCOPES');
    }

    const cwd = flags.cwd || ctx.cwd;
    const scopeId = flags.scope;
    const include = flags.include;
    const exclude = flags.exclude;
    const skipDeduplication = flags.skipDeduplication;

    // IMPORTANT: Do NOT use ctx.platform - it's from parent process with real adapters.
    // Mind runs in child process and must use usePlatform() there to get IPC proxies.
    // Only keep platform reference for analytics (which runs in parent)
    const platform = (ctx as any).platform;

    ctx.logger?.debug('Command started', { cwd, scopeId, skipDeduplication });

    const spinner = ctx.output?.spinner('Building Mind RAG index');
    if (!flags.quiet && !flags.json) {
      spinner?.start();
    }

    ctx.logger?.debug('About to call runRagIndex');
    ctx.tracker?.checkpoint('index');

    // Pass mindConfig from useConfig() - this avoids reloading config in child process
    // DON'T pass platform - let child process use usePlatform() to get IPC proxies
    const result = await runRagIndex({
      cwd,
      scopeId,
      include,
      exclude,
      skipDeduplication,
      config: mindConfig,
      platform: undefined
    });

    // Track analytics if available (runs in parent process)
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
