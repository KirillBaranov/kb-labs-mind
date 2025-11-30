import { defineCommand, type CommandResult } from '@kb-labs/shared-command-kit';
import {
  runSyncAdd,
  runSyncUpdate,
  runSyncDelete,
  runSyncList,
  runSyncBatch,
  runSyncStatus,
  runSyncRestore,
  runSyncCleanup,
} from '../../application/sync';
import { MIND_ERROR_CODES } from '../../errors/error-codes';

type MindSyncFlags = {
  cwd: { type: 'string'; description?: string };
  source: { type: 'string'; description?: string };
  id: { type: 'string'; description?: string };
  scope: { type: 'string'; description?: string };
  content: { type: 'string'; description?: string };
  'content-file': { type: 'string'; description?: string };
  metadata: { type: 'string'; description?: string };
  file: { type: 'string'; description?: string };
  'max-size': { type: 'number'; description?: string };
  'include-deleted': { type: 'boolean'; description?: string; default?: boolean };
  'deleted-only': { type: 'boolean'; description?: string; default?: boolean };
  'ttl-days': { type: 'number'; description?: string };
  json: { type: 'boolean'; description?: string; default?: boolean };
  quiet: { type: 'boolean'; description?: string; default?: boolean };
};

type MindSyncResult = CommandResult & {
  subcommand?: string;
  result?: unknown;
};

export const run = defineCommand<MindSyncFlags, MindSyncResult>({
  name: 'mind:sync',
  flags: {
    cwd: {
      type: 'string',
      description: 'Working directory',
    },
    source: {
      type: 'string',
      description: 'Source identifier (e.g., clickup, git)',
    },
    id: {
      type: 'string',
      description: 'Document ID in source system',
    },
    scope: {
      type: 'string',
      description: 'Scope ID for indexing',
    },
    content: {
      type: 'string',
      description: 'Document content',
    },
    'content-file': {
      type: 'string',
      description: 'Path to file containing document content',
    },
    metadata: {
      type: 'string',
      description: 'JSON metadata',
    },
    file: {
      type: 'string',
      description: 'Batch operations file (for batch subcommand)',
    },
    'max-size': {
      type: 'number',
      description: 'Maximum batch size override',
    },
    'include-deleted': {
      type: 'boolean',
      description: 'Include deleted documents in list',
      default: false,
    },
    'deleted-only': {
      type: 'boolean',
      description: 'Only cleanup deleted documents',
      default: false,
    },
    'ttl-days': {
      type: 'number',
      description: 'TTL in days for cleanup',
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
    const subcommand = argv[0];

    ctx.tracker.checkpoint('start');

    try {
      switch (subcommand) {
        case 'add': {
          const source = flags.source;
          const id = flags.id;
          const scope = flags.scope;
          const content = flags.content;
          const contentFile = flags['content-file'];
          const metadata = flags.metadata;

          if (!source || !id || !scope) {
            ctx.output?.error(new Error('Missing required flags: --source, --id, --scope'), {
              code: MIND_ERROR_CODES.SYNC_MISSING_FLAGS,
              suggestions: [
                'Use: kb mind sync add --source <source> --id <id> --scope <scope>',
                'Add --content or --content-file to provide document content',
              ],
            });
            return { ok: false, exitCode: 1 };
          }

          if (!content && !contentFile) {
            ctx.output?.error(new Error('Either --content or --content-file is required'), {
              code: MIND_ERROR_CODES.SYNC_MISSING_CONTENT,
              suggestions: [
                'Use --content "text" to provide content directly',
                'Use --content-file <path> to provide content from file',
              ],
            });
            return { ok: false, exitCode: 1 };
          }

          const spinner = ctx.output?.spinner('Adding document');
          if (!flags.quiet && !flags.json) {
            spinner?.start();
          }

          ctx.tracker.checkpoint('add');

          const result = await runSyncAdd({
            cwd,
            source,
            id,
            scopeId: scope,
            content: content || '',
            contentFile,
            metadata,
          });

          ctx.tracker.checkpoint('complete');

          if (result.success) {
            if (!flags.quiet && !flags.json) {
              spinner?.succeed('Document added');
            }
            const { ui } = ctx.output!;
            ctx.output?.success(
              `${ui.symbols.success} Document added: ${result.documentId} (${result.chunksAdded} chunks)`,
              result,
            );
          } else {
            if (!flags.quiet && !flags.json) {
              spinner?.fail('Failed to add document');
            }
            ctx.output?.error(new Error(result.error || 'Failed to add document'), {
              code: MIND_ERROR_CODES.SYNC_ADD_FAILED,
            });
          }

          return result.success ? { ok: true, result } : { ok: false, exitCode: 1, result };
        }

        case 'update': {
          const source = flags.source;
          const id = flags.id;
          const scope = flags.scope;
          const content = flags.content;
          const contentFile = flags['content-file'];
          const metadata = flags.metadata;

          if (!source || !id || !scope) {
            ctx.output?.error(new Error('Missing required flags: --source, --id, --scope'), {
              code: MIND_ERROR_CODES.SYNC_MISSING_FLAGS,
              suggestions: [
                'Use: kb mind sync update --source <source> --id <id> --scope <scope>',
                'Add --content or --content-file to provide document content',
              ],
            });
            return { ok: false, exitCode: 1 };
          }

          if (!content && !contentFile) {
            ctx.output?.error(new Error('Either --content or --content-file is required'), {
              code: MIND_ERROR_CODES.SYNC_MISSING_CONTENT,
              suggestions: [
                'Use --content "text" to provide content directly',
                'Use --content-file <path> to provide content from file',
              ],
            });
            return { ok: false, exitCode: 1 };
          }

          const spinner = ctx.output?.spinner('Updating document');
          if (!flags.quiet && !flags.json) {
            spinner?.start();
          }

          ctx.tracker.checkpoint('update');

          const result = await runSyncUpdate({
            cwd,
            source,
            id,
            scopeId: scope,
            content: content || '',
            contentFile,
            metadata,
          });

          ctx.tracker.checkpoint('complete');

          if (result.success) {
            if (!flags.quiet && !flags.json) {
              spinner?.succeed('Document updated');
            }
            const { ui } = ctx.output!;
            ctx.output?.success(
              `${ui.symbols.success} Document updated: ${result.documentId}`,
              result,
            );
          } else {
            if (!flags.quiet && !flags.json) {
              spinner?.fail('Failed to update document');
            }
            ctx.output?.error(new Error(result.error || 'Failed to update document'), {
              code: MIND_ERROR_CODES.SYNC_UPDATE_FAILED,
            });
          }

          return result.success ? { ok: true, result } : { ok: false, exitCode: 1, result };
        }

        case 'delete': {
          const source = flags.source;
          const id = flags.id;
          const scope = flags.scope;

          if (!source || !id || !scope) {
            ctx.output?.error(new Error('Missing required flags: --source, --id, --scope'), {
              code: MIND_ERROR_CODES.SYNC_MISSING_FLAGS,
              suggestions: [
                'Use: kb mind sync delete --source <source> --id <id> --scope <scope>',
              ],
            });
            return { ok: false, exitCode: 1 };
          }

          const spinner = ctx.output?.spinner('Deleting document');
          if (!flags.quiet && !flags.json) {
            spinner?.start();
          }

          ctx.tracker.checkpoint('delete');

          const result = await runSyncDelete({ cwd, source, id, scopeId: scope });

          ctx.tracker.checkpoint('complete');

          if (result.success) {
            if (!flags.quiet && !flags.json) {
              spinner?.succeed('Document deleted');
            }
            const { ui } = ctx.output!;
            ctx.output?.success(
              `${ui.symbols.success} Document deleted: ${result.documentId}`,
              result,
            );
          } else {
            if (!flags.quiet && !flags.json) {
              spinner?.fail('Failed to delete document');
            }
            ctx.output?.error(new Error(result.error || 'Failed to delete document'), {
              code: MIND_ERROR_CODES.SYNC_DELETE_FAILED,
            });
          }

          return result.success ? { ok: true, result } : { ok: false, exitCode: 1, result };
        }

        case 'list': {
          const source = flags.source;
          const scope = flags.scope;
          const includeDeleted = flags['include-deleted'];

          ctx.tracker.checkpoint('list');

          const result = await runSyncList({
            cwd,
            source,
            scopeId: scope,
            includeDeleted,
          });

          ctx.tracker.checkpoint('complete');

          if (flags.json) {
            ctx.output?.json({ ok: true, documents: result });
          } else if (!flags.quiet) {
            ctx.output?.info(`Found ${result.length} documents`);
            for (const doc of result) {
              const status = doc.deleted ? '[deleted]' : '';
              ctx.output?.info(
                `  ${doc.source}:${doc.id}:${doc.scopeId} ${status} (${doc.chunks.length} chunks)`,
              );
            }
          }

          return { ok: true, documents: result };
        }

        case 'batch': {
          const file = flags.file;
          const maxSize = flags['max-size'];

          if (!file) {
            ctx.output?.error(new Error('Missing required flag: --file'), {
              code: MIND_ERROR_CODES.SYNC_MISSING_FLAGS,
              suggestions: [
                'Use: kb mind sync batch --file <path>',
                'The file should contain batch operations in JSON format',
              ],
            });
            return { ok: false, exitCode: 1 };
          }

          const spinner = ctx.output?.spinner('Processing batch');
          if (!flags.quiet && !flags.json) {
            spinner?.start();
          }

          ctx.tracker.checkpoint('batch');

          const result = await runSyncBatch({ cwd, file, maxSize });

          ctx.tracker.checkpoint('complete');

          if (result.failed === 0) {
            if (!flags.quiet && !flags.json) {
              spinner?.succeed('Batch completed');
            }
            const { ui } = ctx.output!;
            ctx.output?.success(
              `${ui.symbols.success} Batch completed: ${result.successful}/${result.total} successful`,
              result,
            );
          } else {
            if (!flags.quiet && !flags.json) {
              spinner?.fail('Batch completed with errors');
            }
            const { ui } = ctx.output!;
            ctx.output?.warn(
              `Batch completed: ${result.successful}/${result.total} successful, ${result.failed} failed`,
              result,
            );
          }

          return result.failed > 0 ? { ok: false, exitCode: 1, result } : { ok: true, result };
        }

        case 'status': {
          const source = flags.source;
          const scope = flags.scope;

          ctx.tracker.checkpoint('status');

          const metrics = await runSyncStatus({ cwd, source, scopeId: scope });

          ctx.tracker.checkpoint('complete');

          if (flags.json) {
            ctx.output?.json({ ok: true, metrics });
          } else if (!flags.quiet) {
            ctx.output?.info(`Total documents: ${metrics.totalDocuments}`);
            ctx.output?.info(`Total chunks: ${metrics.totalChunks}`);
            if (source) {
              ctx.output?.info(`Documents from ${source}: ${metrics.documentsBySource[source] ?? 0}`);
            }
          }

          return { ok: true, metrics };
        }

        case 'restore': {
          const source = flags.source;
          const id = flags.id;
          const scope = flags.scope;

          if (!source || !id || !scope) {
            ctx.output?.error(new Error('Missing required flags: --source, --id, --scope'), {
              code: MIND_ERROR_CODES.SYNC_MISSING_FLAGS,
              suggestions: [
                'Use: kb mind sync restore --source <source> --id <id> --scope <scope>',
              ],
            });
            return { ok: false, exitCode: 1 };
          }

          const spinner = ctx.output?.spinner('Restoring document');
          if (!flags.quiet && !flags.json) {
            spinner?.start();
          }

          ctx.tracker.checkpoint('restore');

          const result = await runSyncRestore({ cwd, source, id, scopeId: scope });

          ctx.tracker.checkpoint('complete');

          if (result.success) {
            if (!flags.quiet && !flags.json) {
              spinner?.succeed('Document restored');
            }
            const { ui } = ctx.output!;
            ctx.output?.success(
              `${ui.symbols.success} Document restored: ${result.documentId}`,
              result,
            );
          } else {
            if (!flags.quiet && !flags.json) {
              spinner?.fail('Failed to restore document');
            }
            ctx.output?.error(new Error(result.error || 'Failed to restore document'), {
              code: MIND_ERROR_CODES.SYNC_RESTORE_FAILED,
            });
          }

          return result.success ? { ok: true, result } : { ok: false, exitCode: 1, result };
        }

        case 'cleanup': {
          const source = flags.source;
          const scope = flags.scope;
          const deletedOnly = flags['deleted-only'];
          const ttlDays = flags['ttl-days'];

          const spinner = ctx.output?.spinner('Cleaning up');
          if (!flags.quiet && !flags.json) {
            spinner?.start();
          }

          ctx.tracker.checkpoint('cleanup');

          const result = await runSyncCleanup({
            cwd,
            source,
            scopeId: scope,
            deletedOnly,
            ttlDays,
          });

          ctx.tracker.checkpoint('complete');

          if (!flags.quiet && !flags.json) {
            spinner?.succeed('Cleanup completed');
          }
          const { ui } = ctx.output!;
          ctx.output?.success(
            `${ui.symbols.success} Cleaned up ${result.deleted} documents`,
            result,
          );

          return { ok: true, result };
        }

        default:
          ctx.output?.error(
            new Error(`Unknown subcommand: ${subcommand}. Use: add, update, delete, list, batch, status, restore, cleanup`),
            {
              code: MIND_ERROR_CODES.SYNC_MISSING_FLAGS,
              suggestions: [
                'Available subcommands: add, update, delete, list, batch, status, restore, cleanup',
                'Use: kb mind sync <subcommand> --help for more info',
              ],
            },
          );
          return { ok: false, exitCode: 1 };
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      ctx.output?.error(error instanceof Error ? error : new Error(message), {
        code: MIND_ERROR_CODES.SYNC_FAILED,
        suggestions: [
          'Check that Mind is initialized',
          'Verify that sync operations are valid',
          'Try: kb mind sync status to check current state',
        ],
      });
      return { ok: false, exitCode: 1, error: message };
    }
  },
});
