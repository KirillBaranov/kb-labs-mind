/**
 * Mind rag-index command - build Mind knowledge indexes (V3)
 */

import { defineCommand, useConfig, usePlatform, type PluginContextV3 } from '@kb-labs/sdk';
import { runRagIndex } from '../../application/rag';

interface RagIndexInput {
  argv: string[];
  flags: {
    cwd?: string;
    scope?: string;
    include?: string;
    exclude?: string;
    skipDeduplication?: boolean;
    json?: boolean;
    quiet?: boolean;
  };
}

interface RagIndexResult {
  exitCode: number;
  ok: boolean;
  scopes?: string[];
  adapters?: {
    vectorStore: string;
    embeddings: string;
    storage: string;
    llm: string;
    cache: string;
  };
}

export default defineCommand({
  id: 'mind:rag-index',
  description: 'Build Mind knowledge indexes',

  handler: {
    async execute(ctx: PluginContextV3, input: RagIndexInput): Promise<RagIndexResult> {
      const startTime = Date.now();
      const { flags } = input;

      ctx.trace?.addEvent?.('mind.rag-index.start', {
        command: 'mind:rag-index',
        scope: flags.scope,
        include: flags.include,
        exclude: flags.exclude,
        skipDeduplication: flags.skipDeduplication,
      });

      // Get Mind config using useConfig() helper
      const mindConfig = await useConfig();
      ctx.trace?.addEvent?.('mind.rag-index.config', {
        hasConfig: !!mindConfig,
        hasScopes: !!(mindConfig as any)?.scopes,
      });

      const cwd = flags.cwd || ctx.cwd;
      const scopeId = flags.scope;
      const include = flags.include;
      const exclude = flags.exclude;
      const skipDeduplication = flags.skipDeduplication;

      // Get platform for analytics (not passed to Mind - child process uses usePlatform())
      const platform = usePlatform();

      if (!flags.quiet && !flags.json) {
        ctx.ui.info('Building Mind RAG index...');
      }

      try {
        // Pass mindConfig from useConfig() - avoids reloading config in child process
        // DON'T pass platform - let child process use usePlatform() to get IPC proxies
        const result = await runRagIndex({
          cwd,
          scopeId,
          include,
          exclude,
          skipDeduplication,
          config: mindConfig,
          platform: undefined,
        });

        const timing = Date.now() - startTime;

        // Track analytics if available (runs in parent process)
        platform?.analytics?.track?.('mind.rag-index', {
          scopeIds: result.scopeIds,
        }).catch(() => {});

        ctx.trace?.addEvent?.('mind.rag-index.complete', {
          scopes: result.scopeIds,
          timingMs: timing,
        });

        const scopesLabel =
          result.scopeIds.length === 1
            ? `scope "${result.scopeIds[0]}"`
            : `${result.scopeIds.length} scopes`;

        if (flags.json) {
          ctx.ui.info(JSON.stringify({
            ok: true,
            scopes: result.scopeIds,
            adapters: result.adapters,
            timingMs: timing,
          }));
        } else if (!flags.quiet) {
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

          ctx.ui.success('Mind RAG index updated', {
            title: 'Mind RAG Index',
            sections,
            timing,
          });
        }

        return {
          exitCode: 0,
          ok: true,
          scopes: result.scopeIds,
          adapters: result.adapters,
        };
      } catch (error) {
        const timing = Date.now() - startTime;
        const message = error instanceof Error ? error.message : String(error);

        ctx.trace?.addEvent?.('mind.rag-index.error', { error: message, timingMs: timing });

        if (flags.json) {
          ctx.ui.info(JSON.stringify({
            ok: false,
            error: message,
            timingMs: timing,
          }));
        } else if (!flags.quiet) {
          ctx.ui.error(`Index build failed: ${message}`);
        }

        // Track analytics
        platform?.analytics?.track?.('mind.rag-index', {
          error: true,
          errorMessage: message,
        }).catch(() => {});

        return { exitCode: 1, ok: false };
      }
    },
  },
});
