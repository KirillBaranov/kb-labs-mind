import type { CommandModule } from '../types.js';
import { runRagIndex } from '../../application/rag.js';
import { createSpinner, safeColors, safeSymbols } from '@kb-labs/shared-cli-ui';

export const run: CommandModule['run'] = async (ctx, argv, flags) => {
  const cwd = typeof flags.cwd === 'string' && flags.cwd ? flags.cwd : ctx.cwd;
  const scopeId =
    typeof flags.scope === 'string' && flags.scope ? flags.scope : undefined;
  const jsonMode = Boolean(flags.json);
  const quiet = Boolean(flags.quiet);

  const loader = createSpinner('Building Mind RAG index', jsonMode);

  try {
    if (!jsonMode && !quiet) {
      loader.start();
    }

    const result = await runRagIndex({ cwd, scopeId });

    if (!jsonMode && !quiet) {
      loader.stop();
    }

    if (jsonMode) {
      ctx.presenter.json({
        ok: true,
        scopes: result.scopeIds,
      });
    } else if (!quiet) {
      const scopesLabel =
        result.scopeIds.length === 1
          ? `scope "${result.scopeIds[0]}"`
          : `${result.scopeIds.length} scopes`;
      ctx.presenter.info(
        `${safeSymbols.success} ${safeColors.success(
          'Mind knowledge index updated',
        )} (${scopesLabel})`,
      );
    }
    return 0;
  } catch (error) {
    if (!jsonMode && !quiet) {
      loader.fail('Mind RAG index failed');
    }

    const message = error instanceof Error ? error.message : String(error);
    if (jsonMode) {
      ctx.presenter.json({
        ok: false,
        error: message,
      });
    } else {
      ctx.presenter.error(`${safeSymbols.error} ${message}`);
    }
    return 1;
  }
};
