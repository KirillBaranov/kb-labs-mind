import { defineCommand, type CommandResult } from '@kb-labs/cli-command-kit';
import { runRagQuery } from '../../application/rag.js';
import { MIND_ERROR_CODES } from '../../errors/error-codes.js';

const VALID_INTENTS = ['summary', 'search', 'similar', 'nav'] as const;

function isValidIntent(intent: string): intent is (typeof VALID_INTENTS)[number] {
  return VALID_INTENTS.includes(intent as any);
}

function truncateText(text: string, limit: number): string {
  if (text.length <= limit) {
    return text;
  }
  return `${text.slice(0, limit - 3)}...`;
}

type MindRagQueryFlags = {
  cwd: { type: 'string'; description?: string };
  scope: { type: 'string'; description?: string };
  text: { type: 'string'; description?: string; required: true };
  intent: { type: 'string'; description?: string; choices?: readonly string[] };
  limit: { type: 'number'; description?: string; default?: number };
  profile: { type: 'string'; description?: string };
  json: { type: 'boolean'; description?: string; default?: boolean };
  quiet: { type: 'boolean'; description?: string; default?: boolean };
};

type MindRagQueryResult = CommandResult & {
  chunks?: Array<{ text: string; score: number }>;
  query?: string;
};

export const run = defineCommand<MindRagQueryFlags, MindRagQueryResult>({
  name: 'mind:rag-query',
  flags: {
    cwd: {
      type: 'string',
      description: 'Working directory',
    },
    scope: {
      type: 'string',
      description: 'Scope ID (default: first configured scope)',
    },
    text: {
      type: 'string',
      description: 'Query text',
      required: true,
    },
    intent: {
      type: 'string',
      description: 'Intent hint for ranking/policy',
      choices: ['summary', 'search', 'similar', 'nav'] as const,
    },
    limit: {
      type: 'number',
      description: 'Maximum chunks to return',
      default: 16,
    },
    profile: {
      type: 'string',
      description: 'Profile ID override (knowledge profiles v2)',
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
    const intent = flags.intent && isValidIntent(flags.intent) ? flags.intent : undefined;
    const text = flags.text?.trim() || '';
    const limit = flags.limit ? Math.max(1, flags.limit) : undefined;
    const profileId = flags.profile;

    if (!text) {
      ctx.output?.error(new Error('Provide --text "<query>" to run rag:query.'), {
        code: MIND_ERROR_CODES.RAG_QUERY_MISSING_TEXT,
        suggestions: [
          'Use: kb mind rag-query --text "your query"',
          'Add --scope to search in specific scope',
          'Add --intent to specify intent (summary, search, similar, nav)',
        ],
      });
      return { ok: false, exitCode: 1 };
    }

    const spinner = ctx.output?.spinner('Initializing...');
    const startTime = Date.now();

    // Helper to format elapsed time
    const formatElapsedTime = (ms: number): string => {
      const seconds = Math.floor(ms / 1000);
      if (seconds < 60) {
        return `${seconds}s`;
      }
      const minutes = Math.floor(seconds / 60);
      const remainingSeconds = seconds % 60;
      return `${minutes}m ${remainingSeconds}s`;
    };

    // Set up interval to update spinner with elapsed time
    let timeUpdateInterval: NodeJS.Timeout | null = null;
    
    ctx.tracker.checkpoint('query');

    if (!flags.quiet && !flags.json) {
      spinner?.start();
      // Update spinner with elapsed time every second
      timeUpdateInterval = setInterval(() => {
        const elapsed = Date.now() - startTime;
        const elapsedStr = formatElapsedTime(elapsed);
        const { ui } = ctx.output!;
        spinner?.update({ text: `Querying... ${ui.colors.muted(`[${elapsedStr}]`)}` });
      }, 1000);
    }

    try {
      const result = await runRagQuery({
        cwd,
        scopeId,
        text,
        intent,
        limit,
        profileId,
        onProgress: (stage: string, details?: string) => {
          if (flags.quiet || flags.json) return;
          
          ctx.output?.progress('RAG Query', {
            message: details ? `${stage}: ${details}` : stage,
          });
        },
      });

      if (timeUpdateInterval) {
        clearInterval(timeUpdateInterval);
      }

      ctx.tracker.checkpoint('complete');

      if (!flags.quiet && !flags.json) {
        spinner?.succeed('Query completed');
      }

      // Output result
      if (flags.json) {
        ctx.output?.json({
          ok: true,
          scopeId: result.scopeId,
          intent: result.knowledge.query.intent,
          chunks: result.knowledge.chunks,
          contextText: result.knowledge.contextText,
        });
      } else if (!flags.quiet) {
        const { ui } = ctx.output!;
        const topChunk = result.knowledge.chunks[0];
        const summaryLines = [
          ...ui.keyValue({
            Scope: result.scopeId,
            Intent: result.knowledge.query.intent,
            'Chunks returned': String(result.knowledge.chunks.length),
          }),
        ];

        if (topChunk) {
          summaryLines.push(
            '',
            ui.colors.bold('Top chunk:'),
            `${topChunk.path} ${ui.colors.muted(
              `#${topChunk.span.startLine}-${topChunk.span.endLine}`,
            )}`,
            truncateText(topChunk.text, 400),
          );
        } else {
          summaryLines.push('', ui.colors.muted('No matching chunks found.'));
        }

        // Show synthesized context if available (from reasoning chain)
        if (result.knowledge.contextText && result.knowledge.contextText.length > 0) {
          const contextPreview = result.knowledge.contextText.length > 2000
            ? result.knowledge.contextText.substring(0, 2000) + '...'
            : result.knowledge.contextText;
          summaryLines.push(
            '',
            ui.colors.bold('Synthesized context:'),
            ui.colors.muted(`(${result.knowledge.contextText.length} chars)`),
            contextPreview,
          );
        }

        ctx.output?.write(
          '\n' + ui.box(`${ui.symbols.info} Mind RAG query`, summaryLines),
        );
      }

      return { ok: true, result };
    } finally {
      if (timeUpdateInterval) {
        clearInterval(timeUpdateInterval);
      }
    }
  },
  async onError(error, ctx, flags) {
    const spinner = ctx.output?.spinner('Initializing...');
    if (!flags.quiet && !flags.json) {
      spinner?.fail('Mind RAG query failed');
    }

    const message = error instanceof Error ? error.message : String(error);
    ctx.output?.error(error instanceof Error ? error : new Error(message), {
      code: MIND_ERROR_CODES.RAG_QUERY_FAILED,
      suggestions: [
        'Check that Mind is initialized',
        'Verify that index exists: kb mind rag-index',
        'Try with --scope flag to search in specific scope',
      ],
    });

    return { ok: false, exitCode: 1, error: message };
  },
});
