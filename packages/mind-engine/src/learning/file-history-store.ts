import { createHash } from 'node:crypto';
import { useLogger } from '@kb-labs/sdk';
import { cosineSimilarity, FileRotationStore } from '@kb-labs/mind-core';
import type { IStorage } from '../adapters/storage.js';
import type { HistoryFindOptions, HistoryRecord, IHistoryStore } from './history-store.js';

export interface FileHistoryStoreOptions {
  basePath?: string;
  filePrefix?: string;
  maxRecordsPerFile?: number;
  maxFiles?: number;
}

/**
 * File-based history store using platform.storage (JSONL segments with basic rotation).
 */
export class FileHistoryStore extends FileRotationStore<HistoryRecord> implements IHistoryStore {
  constructor(storage: IStorage, options: FileHistoryStoreOptions = {}) {
    super(storage, {
      basePath: options.basePath ?? '.kb/mind/learning/history/',
      filePrefix: options.filePrefix ?? 'history-',
      maxRecordsPerFile: options.maxRecordsPerFile ?? 1000,
      maxFiles: options.maxFiles ?? 30,
    });
  }

  async save(record: HistoryRecord): Promise<void> {
    try {
      await this.appendRecord(record);
    } catch (error) {
      // Log to avoid throwing (learning is non-critical)
      const logger = useLogger().child({ category: 'mind:learning' });
      logger.error('Failed to write history', error as Error);
    }
  }

  async find(options: HistoryFindOptions): Promise<HistoryRecord[]> {
    // Use base class readRecords with custom filter
    const filter = (rec: HistoryRecord): boolean => {
      if (rec.scopeId !== options.scopeId) return false;
      if (options.queryHash && rec.queryHash !== options.queryHash) return false;
      if (options.queryVector && options.queryVector.length > 0 && rec.queryVector) {
        const similarity = cosineSimilarity(options.queryVector, rec.queryVector);
        if (similarity <= 0.7) return false;
      }
      return true;
    };

    return this.readRecords(filter, options.limit);
  }

  async popular(scopeId: string, limit: number = 20): Promise<Array<{ query: string; count: number }>> {
    // Read all records for this scope
    const records = await this.readRecords((rec) => rec.scopeId === scopeId);

    // Count occurrences
    const counts = new Map<string, number>();
    for (const rec of records) {
      counts.set(rec.query, (counts.get(rec.query) ?? 0) + 1);
    }

    // Sort by count and limit
    return Array.from(counts.entries())
      .map(([query, count]) => ({ query, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, limit);
  }

  async saveReasoningPlan(record: HistoryRecord): Promise<void> {
    const hash = record.queryHash ?? createHash('sha256').update(record.query.toLowerCase().trim()).digest('hex');
    await this.save({ ...record, queryHash: hash });
  }
}

