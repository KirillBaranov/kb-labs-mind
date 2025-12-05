/**
 * Mind verify command - checks Qdrant index status
 */

import { defineCommand, type CommandResult } from '@kb-labs/shared-command-kit';
import { MIND_ERROR_CODES } from '../../errors/error-codes';
import { ANALYTICS_EVENTS, ANALYTICS_ACTOR } from '../../infra/analytics/events';

type MindVerifyFlags = {
  json: { type: 'boolean'; description?: string; default?: boolean };
  quiet: { type: 'boolean'; description?: string; default?: boolean };
  qdrant: { type: 'string'; description?: string };
};

interface QdrantCollectionInfo {
  status: 'green' | 'yellow' | 'red';
  points_count: number;
  indexed_vectors_count: number;
  optimizer_status: string;
}

interface VerifyResult {
  ok: boolean;
  code: string | null;
  qdrantUrl: string;
  collections: {
    name: string;
    status: 'green' | 'yellow' | 'red' | 'missing';
    points_count: number;
    indexed_vectors_count: number;
  }[];
  issues: string[];
  hint?: string;
  meta: {
    collectionsChecked: number;
    timingMs: number;
  };
}

type MindVerifyResult = CommandResult & VerifyResult;

/**
 * Fetch Qdrant collection info
 */
async function fetchCollectionInfo(qdrantUrl: string, collectionName: string): Promise<QdrantCollectionInfo | null> {
  try {
    const response = await fetch(`${qdrantUrl}/collections/${collectionName}`);
    if (!response.ok) {
      return null;
    }
    const data = await response.json() as { result: QdrantCollectionInfo };
    return data.result;
  } catch {
    return null;
  }
}

/**
 * Verify mind workspace consistency
 */
export const run = defineCommand<MindVerifyFlags, MindVerifyResult>({
  name: 'mind:verify',
  flags: {
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
    qdrant: {
      type: 'string',
      description: 'Qdrant URL (defaults to http://localhost:6333)',
    },
  },
  analytics: {
    startEvent: ANALYTICS_EVENTS.VERIFY_STARTED,
    finishEvent: ANALYTICS_EVENTS.VERIFY_FINISHED,
    actor: ANALYTICS_ACTOR.id,
  },
  async handler(ctx, argv, flags) {
    ctx.tracker.checkpoint('start');

    const qdrantUrl = flags.qdrant || process.env.QDRANT_URL || 'http://localhost:6333';

    ctx.logger?.info('Mind verify started', {
      qdrantUrl,
      command: 'mind:verify',
    });

    // Check Qdrant health
    ctx.tracker.checkpoint('qdrant-health-check');
    try {
      const healthResponse = await fetch(`${qdrantUrl}/healthz`);
      if (!healthResponse.ok) {
        const error: VerifyResult = {
          ok: false,
          code: 'QDRANT_UNAVAILABLE',
          qdrantUrl,
          collections: [],
          issues: ['Qdrant is not responding'],
          hint: 'Ensure Qdrant is running at ' + qdrantUrl,
          meta: {
            collectionsChecked: 0,
            timingMs: ctx.tracker.total()
          }
        };

        if (flags.json) {
          ctx.output?.json(error);
        } else {
          ctx.output?.error(new Error('Qdrant is not responding'), {
            code: MIND_ERROR_CODES.VERIFY_FAILED,
            suggestions: ['Ensure Qdrant is running at ' + qdrantUrl],
          });
        }
        return 1;
      }
    } catch (err) {
      const error: VerifyResult = {
        ok: false,
        code: 'QDRANT_CONNECTION_ERROR',
        qdrantUrl,
        collections: [],
        issues: [`Cannot connect to Qdrant: ${err instanceof Error ? err.message : String(err)}`],
        hint: 'Ensure Qdrant is running at ' + qdrantUrl,
        meta: {
          collectionsChecked: 0,
          timingMs: ctx.tracker.total()
        }
      };

      if (flags.json) {
        ctx.output?.json(error);
      } else {
        ctx.output?.error(new Error(`Cannot connect to Qdrant at ${qdrantUrl}`), {
          code: MIND_ERROR_CODES.VERIFY_FAILED,
          suggestions: ['Ensure Qdrant is running', 'Check QDRANT_URL environment variable'],
        });
      }
      return 1;
    }

    // Check Mind collections in Qdrant
    ctx.tracker.checkpoint('collections-check');
    const requiredCollections = ['mind_chunks', 'mind_feedback', 'mind_query_history'];

    const collectionsData: VerifyResult['collections'] = [];
    const issues: string[] = [];

    for (const collectionName of requiredCollections) {
      const info = await fetchCollectionInfo(qdrantUrl, collectionName);

      if (!info) {
        collectionsData.push({
          name: collectionName,
          status: 'missing',
          points_count: 0,
          indexed_vectors_count: 0,
        });
        issues.push(`Collection ${collectionName} is missing`);
        ctx.logger?.warn('Collection missing', { collectionName });
      } else {
        collectionsData.push({
          name: collectionName,
          status: info.status,
          points_count: info.points_count,
          indexed_vectors_count: info.indexed_vectors_count,
        });

        // Check for issues
        if (info.status !== 'green') {
          issues.push(`Collection ${collectionName} status is ${info.status}`);
          ctx.logger?.warn('Collection unhealthy', { collectionName, status: info.status });
        }

        if (collectionName === 'mind_chunks' && info.points_count === 0) {
          issues.push('mind_chunks is empty - no indexed content');
          ctx.logger?.warn('mind_chunks is empty');
        }

        if (info.indexed_vectors_count < info.points_count) {
          const unindexed = info.points_count - info.indexed_vectors_count;
          issues.push(`Collection ${collectionName} has ${unindexed} unindexed vectors`);
          ctx.logger?.warn('Unindexed vectors', { collectionName, unindexed });
        }
      }
    }

    ctx.tracker.checkpoint('verify-complete');

    ctx.logger?.info('Verification completed', {
      collectionsChecked: collectionsData.length,
      issuesCount: issues.length,
      ok: issues.length === 0,
    });

    const result: VerifyResult = {
      ok: issues.length === 0,
      code: issues.length > 0 ? 'QDRANT_INDEX_ISSUES' : null,
      qdrantUrl,
      collections: collectionsData,
      issues,
      hint: issues.length > 0 ? 'Run: pnpm kb mind rag-index --scope default' : undefined,
      meta: {
        collectionsChecked: collectionsData.length,
        timingMs: ctx.tracker.total()
      }
    };

    if (flags.json) {
      ctx.output?.json(result);
    } else {
      if (!flags.quiet) {
        const { ui } = ctx.output!;

        const sections: Array<{ header?: string; items: string[] }> = [
          {
            header: 'Qdrant',
            items: [
              `URL: ${qdrantUrl}`,
              `Collections: ${collectionsData.length}`,
            ],
          },
        ];

        // Add collections details
        const collectionItems: string[] = [];
        for (const coll of collectionsData) {
          const statusSymbol = coll.status === 'green' ? '✓' : coll.status === 'missing' ? '✗' : '⚠';
          collectionItems.push(
            `${statusSymbol} ${coll.name}: ${coll.points_count} points, ${coll.indexed_vectors_count} indexed (${coll.status})`
          );
        }
        sections.push({
          header: 'Collections',
          items: collectionItems,
        });

        if (!result.ok && issues.length > 0) {
          sections.push({
            header: 'Issues',
            items: issues.map(issue => `${ui.symbols.warning} ${issue}`),
          });

          sections.push({
            header: 'Hint',
            items: ['Run: pnpm kb mind rag-index --scope default'],
          });
        }

        const status = result.ok ? 'success' : 'warning';
        const outputText = ui.sideBox({
          title: 'Mind Verify - Qdrant Index',
          sections,
          status,
          timing: ctx.tracker.total(),
        });
        ctx.output?.write(outputText);
      }
    }

    // Return result object (contains ok field)
    return result;
  },
  // TODO: onError handler removed - no longer supported in CommandConfig
  // Error handling is done by the command framework automatically
});
