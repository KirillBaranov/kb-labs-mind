import type { CommandModule } from '../types.js';
import { runRagIndex } from '../../application/rag.js';
import { MIND_ERROR_CODES } from '../../errors/error-codes.js';

export const run: CommandModule['run'] = async (ctx, argv, flags) => {
  const cwd = typeof flags.cwd === 'string' && flags.cwd ? flags.cwd : ctx.cwd;
  const scopeId =
    typeof flags.scope === 'string' && flags.scope ? flags.scope : undefined;

  const spinner = ctx.output.spinner('Building Mind RAG index');
  spinner.start();

  try {
    const result = await runRagIndex({ cwd, scopeId });

    spinner.succeed('Mind RAG index updated');

    const scopesLabel =
      result.scopeIds.length === 1
        ? `scope "${result.scopeIds[0]}"`
        : `${result.scopeIds.length} scopes`;

    const { ui } = ctx.output;
    ctx.output.success(
      `${ui.symbols.success} ${ui.colors.success('Mind knowledge index updated')} (${scopesLabel})`,
      { scopes: result.scopeIds },
    );

    return 0;
  } catch (error) {
    spinner.fail('Mind RAG index failed');

    const message = error instanceof Error ? error.message : String(error);
    ctx.output.error(error instanceof Error ? error : new Error(message), {
      code: MIND_ERROR_CODES.RAG_INDEX_FAILED,
      suggestions: [
        'Check that Mind is initialized',
        'Verify that source files are accessible',
        'Try: kb mind init',
      ],
    });

    return 1;
  }
};
