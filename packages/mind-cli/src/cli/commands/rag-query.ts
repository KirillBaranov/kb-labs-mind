import type { CommandModule } from '../types.js';
import { runRagQuery } from '../../application/rag.js';
import { MIND_ERROR_CODES } from '../../errors/error-codes.js';

const VALID_INTENTS = ['summary', 'search', 'similar', 'nav'] as const;

export const run: CommandModule['run'] = async (ctx, argv, flags) => {
  const cwd = typeof flags.cwd === 'string' && flags.cwd ? flags.cwd : ctx.cwd;
  const scopeId =
    typeof flags.scope === 'string' && flags.scope ? flags.scope : undefined;
  const intent =
    typeof flags.intent === 'string' && isValidIntent(flags.intent)
      ? flags.intent
      : undefined;
  const text = typeof flags.text === 'string' ? flags.text.trim() : '';
  const limit =
    typeof flags.limit === 'number' && Number.isFinite(flags.limit)
      ? Math.max(1, flags.limit)
      : undefined;
  const profileId =
    typeof flags.profile === 'string' && flags.profile ? flags.profile : undefined;

  if (!text) {
    ctx.output.error(new Error('Provide --text "<query>" to run rag:query.'), {
      code: MIND_ERROR_CODES.RAG_QUERY_MISSING_TEXT,
      suggestions: [
        'Use: kb mind rag-query --text "your query"',
        'Add --scope to search in specific scope',
        'Add --intent to specify intent (summary, search, similar, nav)',
      ],
    });
    return 1;
  }

  const spinner = ctx.output.spinner('Initializing...');
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
  
  try {
    if (!ctx.output.isQuiet && !ctx.output.isJSON) {
      spinner.start();
      // Update spinner with elapsed time every second
      timeUpdateInterval = setInterval(() => {
        const elapsed = Date.now() - startTime;
        const elapsedStr = formatElapsedTime(elapsed);
        const { ui } = ctx.output;
        spinner.update({ text: `Querying... ${ui.colors.muted(`[${elapsedStr}]`)}` });
      }, 1000);
    }

    const result = await runRagQuery({
      cwd,
      scopeId,
      text,
      intent,
      limit,
      profileId,
      onProgress: (stage: string, details?: string) => {
        if (ctx.output.isQuiet || ctx.output.isJSON) return;
        
        ctx.output.progress('RAG Query', {
          message: details ? `${stage}: ${details}` : stage,
        });
      },
    });

    if (timeUpdateInterval) {
      clearInterval(timeUpdateInterval);
    }

    if (!ctx.output.isQuiet && !ctx.output.isJSON) {
      spinner.succeed('Query completed');
    }

    // Output result
    if (ctx.output.isJSON) {
      ctx.output.json({
        ok: true,
        scopeId: result.scopeId,
        intent: result.knowledge.query.intent,
        chunks: result.knowledge.chunks,
        contextText: result.knowledge.contextText,
      });
    } else if (!ctx.output.isQuiet) {
      const { ui } = ctx.output;
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

      ctx.output.write(
        '\n' + ui.box(`${ui.symbols.info} Mind RAG query`, summaryLines),
      );
    }

    return 0;
  } catch (error) {
    if (timeUpdateInterval) {
      clearInterval(timeUpdateInterval);
    }
    if (!ctx.output.isQuiet && !ctx.output.isJSON) {
      spinner.fail('Mind RAG query failed');
    }

    const message = error instanceof Error ? error.message : String(error);
    ctx.output.error(error instanceof Error ? error : new Error(message), {
      code: MIND_ERROR_CODES.RAG_QUERY_FAILED,
      suggestions: [
        'Check that Mind is initialized',
        'Verify that index exists: kb mind rag-index',
        'Try with --scope flag to search in specific scope',
      ],
    });

    return 1;
  }
};

function isValidIntent(intent: string): intent is (typeof VALID_INTENTS)[number] {
  return VALID_INTENTS.includes(intent as any);
}

function truncateText(text: string, limit: number): string {
  if (text.length <= limit) {
    return text;
  }
  return `${text.slice(0, limit - 3)}...`;
}
