import type { CommandModule } from '../types.js';
import { runRagQuery } from '../../application/rag.js';
import {
  box,
  createSpinner,
  keyValue,
  safeColors,
  safeSymbols,
} from '@kb-labs/shared-cli-ui';

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
  const jsonMode = Boolean(flags.json);
  const quiet = Boolean(flags.quiet);

  if (!text) {
    const message = 'Provide --text "<query>" to run rag:query.';
    if (jsonMode) {
      ctx.presenter.json({ ok: false, error: message });
    } else {
      ctx.presenter.error(message);
    }
    return 1;
  }

  const loader = createSpinner('Running Mind RAG query', jsonMode);

  try {
    if (!jsonMode && !quiet) {
      loader.start();
    }

    const result = await runRagQuery({
      cwd,
      scopeId,
      text,
      intent,
      limit,
      profileId,
    });

    if (!jsonMode && !quiet) {
      loader.stop();
    }

    if (jsonMode) {
      ctx.presenter.json({
        ok: true,
        scopeId: result.scopeId,
        intent: result.knowledge.query.intent,
        chunks: result.knowledge.chunks,
        contextText: result.knowledge.contextText,
      });
    } else if (!quiet) {
      const topChunk = result.knowledge.chunks[0];
      const summaryLines = [
        ...keyValue({
          Scope: result.scopeId,
          Intent: result.knowledge.query.intent,
          'Chunks returned': String(result.knowledge.chunks.length),
        }),
      ];

      if (topChunk) {
        summaryLines.push(
          '',
          safeColors.bold('Top chunk:'),
          `${topChunk.path} ${safeColors.muted(
            `#${topChunk.span.startLine}-${topChunk.span.endLine}`,
          )}`,
          truncateText(topChunk.text, 400),
        );
      } else {
        summaryLines.push('', safeColors.muted('No matching chunks found.'));
      }

      ctx.presenter.write(
        '\n' +
          box(`${safeSymbols.info} Mind RAG query`, summaryLines),
      );
    }

    return 0;
  } catch (error) {
    if (!jsonMode && !quiet) {
      loader.fail('Mind RAG query failed');
    }

    const message = error instanceof Error ? error.message : String(error);
    if (jsonMode) {
      ctx.presenter.json({ ok: false, error: message });
    } else {
      ctx.presenter.error(`${safeSymbols.error} ${message}`);
    }
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
