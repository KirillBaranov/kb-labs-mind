import type { CommandModule } from '../types.js';
import {
  runSyncAdd,
  runSyncUpdate,
  runSyncDelete,
  runSyncList,
  runSyncBatch,
  runSyncStatus,
  runSyncRestore,
  runSyncCleanup,
} from '../../application/sync.js';
import { MIND_ERROR_CODES } from '../../errors/error-codes.js';

export const run: CommandModule['run'] = async (ctx, argv, flags) => {
  const cwd = typeof flags.cwd === 'string' && flags.cwd ? flags.cwd : ctx.cwd;

  const subcommand = argv[0];

  try {
    switch (subcommand) {
      case 'add': {
        const source = flags.source as string;
        const id = flags.id as string;
        const scope = flags.scope as string;
        const content = flags.content as string;
        const contentFile = flags['content-file'] as string | undefined;
        const metadata = flags.metadata as string | undefined;

        if (!source || !id || !scope) {
          ctx.output.error(new Error('Missing required flags: --source, --id, --scope'), {
            code: MIND_ERROR_CODES.SYNC_MISSING_FLAGS,
            suggestions: [
              'Use: kb mind sync add --source <source> --id <id> --scope <scope>',
              'Add --content or --content-file to provide document content',
            ],
          });
          return 1;
        }

        if (!content && !contentFile) {
          ctx.output.error(new Error('Either --content or --content-file is required'), {
            code: MIND_ERROR_CODES.SYNC_MISSING_CONTENT,
            suggestions: [
              'Use --content "text" to provide content directly',
              'Use --content-file <path> to provide content from file',
            ],
          });
          return 1;
        }

        const spinner = ctx.output.spinner('Adding document');
        spinner.start();

        const result = await runSyncAdd({
          cwd,
          source,
          id,
          scopeId: scope,
          content: content || '',
          contentFile,
          metadata,
        });

        if (result.success) {
          spinner.succeed('Document added');
          const { ui } = ctx.output;
          ctx.output.success(
            `${ui.symbols.success} Document added: ${result.documentId} (${result.chunksAdded} chunks)`,
            result,
          );
        } else {
          spinner.fail('Failed to add document');
          ctx.output.error(new Error(result.error || 'Failed to add document'), {
            code: MIND_ERROR_CODES.SYNC_ADD_FAILED,
          });
        }

        return result.success ? 0 : 1;
      }

      case 'update': {
        const source = flags.source as string;
        const id = flags.id as string;
        const scope = flags.scope as string;
        const content = flags.content as string;
        const contentFile = flags['content-file'] as string | undefined;
        const metadata = flags.metadata as string | undefined;

        if (!source || !id || !scope) {
          ctx.output.error(new Error('Missing required flags: --source, --id, --scope'), {
            code: MIND_ERROR_CODES.SYNC_MISSING_FLAGS,
            suggestions: [
              'Use: kb mind sync update --source <source> --id <id> --scope <scope>',
              'Add --content or --content-file to provide document content',
            ],
          });
          return 1;
        }

        if (!content && !contentFile) {
          ctx.output.error(new Error('Either --content or --content-file is required'), {
            code: MIND_ERROR_CODES.SYNC_MISSING_CONTENT,
            suggestions: [
              'Use --content "text" to provide content directly',
              'Use --content-file <path> to provide content from file',
            ],
          });
          return 1;
        }

        const spinner = ctx.output.spinner('Updating document');
        spinner.start();

        const result = await runSyncUpdate({
          cwd,
          source,
          id,
          scopeId: scope,
          content: content || '',
          contentFile,
          metadata,
        });

        if (result.success) {
          spinner.succeed('Document updated');
          const { ui } = ctx.output;
          ctx.output.success(
            `${ui.symbols.success} Document updated: ${result.documentId}`,
            result,
          );
        } else {
          spinner.fail('Failed to update document');
          ctx.output.error(new Error(result.error || 'Failed to update document'), {
            code: MIND_ERROR_CODES.SYNC_UPDATE_FAILED,
          });
        }

        return result.success ? 0 : 1;
      }

      case 'delete': {
        const source = flags.source as string;
        const id = flags.id as string;
        const scope = flags.scope as string;

        if (!source || !id || !scope) {
          ctx.output.error(new Error('Missing required flags: --source, --id, --scope'), {
            code: MIND_ERROR_CODES.SYNC_MISSING_FLAGS,
            suggestions: [
              'Use: kb mind sync delete --source <source> --id <id> --scope <scope>',
            ],
          });
          return 1;
        }

        const spinner = ctx.output.spinner('Deleting document');
        spinner.start();

        const result = await runSyncDelete({ cwd, source, id, scopeId: scope });

        if (result.success) {
          spinner.succeed('Document deleted');
          const { ui } = ctx.output;
          ctx.output.success(
            `${ui.symbols.success} Document deleted: ${result.documentId}`,
            result,
          );
        } else {
          spinner.fail('Failed to delete document');
          ctx.output.error(new Error(result.error || 'Failed to delete document'), {
            code: MIND_ERROR_CODES.SYNC_DELETE_FAILED,
          });
        }

        return result.success ? 0 : 1;
      }

      case 'list': {
        const source = flags.source as string | undefined;
        const scope = flags.scope as string | undefined;
        const includeDeleted = Boolean(flags['include-deleted']);

        const result = await runSyncList({
          cwd,
          source,
          scopeId: scope,
          includeDeleted,
        });

        if (ctx.output.isJSON) {
          ctx.output.json({ ok: true, documents: result });
        } else if (!ctx.output.isQuiet) {
          ctx.output.info(`Found ${result.length} documents`);
          for (const doc of result) {
            const status = doc.deleted ? '[deleted]' : '';
            ctx.output.info(
              `  ${doc.source}:${doc.id}:${doc.scopeId} ${status} (${doc.chunks.length} chunks)`,
            );
          }
        }

        return 0;
      }

      case 'batch': {
        const file = flags.file as string;
        const maxSize = flags['max-size'] as number | undefined;

        if (!file) {
          ctx.output.error(new Error('Missing required flag: --file'), {
            code: MIND_ERROR_CODES.SYNC_MISSING_FLAGS,
            suggestions: [
              'Use: kb mind sync batch --file <path>',
              'The file should contain batch operations in JSON format',
            ],
          });
          return 1;
        }

        const spinner = ctx.output.spinner('Processing batch');
        spinner.start();

        const result = await runSyncBatch({ cwd, file, maxSize });

        if (result.failed === 0) {
          spinner.succeed('Batch completed');
          const { ui } = ctx.output;
          ctx.output.success(
            `${ui.symbols.success} Batch completed: ${result.successful}/${result.total} successful`,
            result,
          );
        } else {
          spinner.fail('Batch completed with errors');
          const { ui } = ctx.output;
          ctx.output.warn(
            `Batch completed: ${result.successful}/${result.total} successful, ${result.failed} failed`,
            result,
          );
        }

        return result.failed > 0 ? 1 : 0;
      }

      case 'status': {
        const source = flags.source as string | undefined;
        const scope = flags.scope as string | undefined;

        const metrics = await runSyncStatus({ cwd, source, scopeId: scope });

        if (ctx.output.isJSON) {
          ctx.output.json({ ok: true, metrics });
        } else if (!ctx.output.isQuiet) {
          ctx.output.info(`Total documents: ${metrics.totalDocuments}`);
          ctx.output.info(`Total chunks: ${metrics.totalChunks}`);
          if (source) {
            ctx.output.info(`Documents from ${source}: ${metrics.documentsBySource[source] ?? 0}`);
          }
        }

        return 0;
      }

      case 'restore': {
        const source = flags.source as string;
        const id = flags.id as string;
        const scope = flags.scope as string;

        if (!source || !id || !scope) {
          ctx.output.error(new Error('Missing required flags: --source, --id, --scope'), {
            code: MIND_ERROR_CODES.SYNC_MISSING_FLAGS,
            suggestions: [
              'Use: kb mind sync restore --source <source> --id <id> --scope <scope>',
            ],
          });
          return 1;
        }

        const spinner = ctx.output.spinner('Restoring document');
        spinner.start();

        const result = await runSyncRestore({ cwd, source, id, scopeId: scope });

        if (result.success) {
          spinner.succeed('Document restored');
          const { ui } = ctx.output;
          ctx.output.success(
            `${ui.symbols.success} Document restored: ${result.documentId}`,
            result,
          );
        } else {
          spinner.fail('Failed to restore document');
          ctx.output.error(new Error(result.error || 'Failed to restore document'), {
            code: MIND_ERROR_CODES.SYNC_RESTORE_FAILED,
          });
        }

        return result.success ? 0 : 1;
      }

      case 'cleanup': {
        const source = flags.source as string | undefined;
        const scope = flags.scope as string | undefined;
        const deletedOnly = Boolean(flags['deleted-only']);
        const ttlDays = flags['ttl-days'] as number | undefined;

        const spinner = ctx.output.spinner('Cleaning up');
        spinner.start();

        const result = await runSyncCleanup({
          cwd,
          source,
          scopeId: scope,
          deletedOnly,
          ttlDays,
        });

        spinner.succeed('Cleanup completed');
        const { ui } = ctx.output;
        ctx.output.success(
          `${ui.symbols.success} Cleaned up ${result.deleted} documents`,
          result,
        );

        return 0;
      }

      default:
        ctx.output.error(
          new Error(`Unknown subcommand: ${subcommand}. Use: add, update, delete, list, batch, status, restore, cleanup`),
          {
            code: MIND_ERROR_CODES.SYNC_MISSING_FLAGS,
            suggestions: [
              'Available subcommands: add, update, delete, list, batch, status, restore, cleanup',
              'Use: kb mind sync <subcommand> --help for more info',
            ],
          },
        );
        return 1;
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    ctx.output.error(error instanceof Error ? error : new Error(message), {
      code: MIND_ERROR_CODES.SYNC_FAILED,
      suggestions: [
        'Check that Mind is initialized',
        'Verify that sync operations are valid',
        'Try: kb mind sync status to check current state',
      ],
    });
    return 1;
  }
};