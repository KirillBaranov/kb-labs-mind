import { useLogger } from '@kb-labs/sdk';
import { FileRotationStore } from '@kb-labs/mind-core';
import type { IStorage } from '../adapters/storage.js';
import type { FeedbackRecord, IFeedbackStore } from './feedback-store.js';

export interface FileFeedbackStoreOptions {
  basePath?: string;
  filePrefix?: string;
  maxRecordsPerFile?: number;
  maxFiles?: number;
}

/**
 * File-based feedback store using platform.storage (JSONL segments with basic rotation).
 *
 * Extends FileRotationStore to provide feedback-specific functionality while
 * leveraging shared rotation logic.
 */
export class FileFeedbackStore extends FileRotationStore<FeedbackRecord> implements IFeedbackStore {
  constructor(storage: IStorage, options: FileFeedbackStoreOptions = {}) {
    super(storage, {
      basePath: options.basePath ?? '.kb/mind/learning/feedback/',
      filePrefix: options.filePrefix ?? 'feedback-',
      maxRecordsPerFile: options.maxRecordsPerFile ?? 1000,
      maxFiles: options.maxFiles ?? 30,
    });
  }

  async save(record: FeedbackRecord): Promise<void> {
    try {
      await this.appendRecord(record);
    } catch (error) {
      const logger = useLogger().child({ category: 'mind:learning' });
      logger.error('Failed to write feedback', error as Error);
    }
  }

  async list(scopeId: string, limit: number = 100): Promise<FeedbackRecord[]> {
    // Use base class readRecords with filter for scope
    const records = await this.readRecords((rec: FeedbackRecord) => rec.scopeId === scopeId);

    // Return last N records (most recent)
    return records.slice(-limit);
  }
}
