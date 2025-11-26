/**
 * ParallelChunkingStage - Memory-aware parallel file chunking
 *
 * Enhanced version with TRULY ADAPTIVE memory-based concurrency:
 * - NO MAGIC NUMBERS - purely memory-based decisions
 * - Checks heap before taking each task
 * - Dynamically scales from 1 to MAX based on available memory
 * - Prevents OOM by estimating file memory usage
 *
 * Performance:
 * - Adapts to available memory in real-time
 * - More memory = more parallel tasks
 * - Less memory = fewer tasks (prevents OOM)
 */

import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { createHash } from 'node:crypto';
import type { PipelineStage, PipelineContext, StageResult } from '../pipeline-types.js';
import type { AdaptiveChunkerFactory } from '../../chunking/adaptive-factory.js';
import type { FileMetadata } from './discovery.js';
import type { MindChunk } from './chunking.js';
import { createMemoryAwareQueue } from '../memory-aware-queue.js';

export interface ParallelChunkingOptions {
  /**
   * Safe memory threshold (0-1, default 0.7 = 70% of heap limit)
   */
  safeThreshold?: number;

  /**
   * Minimum concurrency (will always try to have at least this many tasks running)
   */
  minConcurrency?: number;

  /**
   * Memory reserve (in bytes) to always keep free
   * Default: 512MB
   */
  memoryReserve?: number;
}

interface ChunkFileTask {
  source: any;
  relativePath: string;
  fullPath: string;
  size: number;
  ext: string;
  metadata?: FileMetadata;
}

/**
 * Parallel Chunking Stage
 * Processes files in parallel using memory-aware queue
 */
export class ParallelChunkingStage implements PipelineStage {
  readonly name = 'parallel-chunking';
  readonly description = 'Convert files to chunks (memory-aware parallel)';

  private chunks: MindChunk[] = [];

  constructor(
    private chunkerFactory: AdaptiveChunkerFactory,
    private runtime: any, // RuntimeAdapter
    private fileMetadata?: Map<string, FileMetadata>,
    private options: ParallelChunkingOptions = {}
  ) {}

  async execute(context: PipelineContext): Promise<StageResult> {
    const filePaths = context.filePaths ?? [];

    if (filePaths.length === 0) {
      context.logger.warn('No files to chunk');
      return {
        success: true,
        message: 'No files to process',
      };
    }

    context.logger.info('Starting memory-aware parallel chunking', {
      filesCount: filePaths.length,
      safeThreshold: this.options.safeThreshold ?? 0.7,
      minConcurrency: this.options.minConcurrency ?? 1,
      memoryReserve: `${((this.options.memoryReserve ?? 512 * 1024 * 1024) / 1024 / 1024).toFixed(0)}MB`,
    });

    this.chunks = [];
    let processedCount = 0;

    // Prepare tasks
    const tasks: ChunkFileTask[] = [];
    for (const relativePath of filePaths) {
      const metadata = this.fileMetadata?.get(relativePath);
      const source = context.sources[0]; // TODO: map file to correct source

      tasks.push({
        source,
        relativePath,
        fullPath: path.resolve(process.cwd(), relativePath),
        size: metadata?.size ?? 0,
        ext: path.extname(relativePath).toLowerCase(),
        metadata,
      });
    }

    // Create memory-aware queue
    const memoryQueue = createMemoryAwareQueue<ChunkFileTask>({
      estimateMemory: (task) => {
        // Use chunker factory to estimate memory for this file
        return this.chunkerFactory.estimateMemoryUsage({
          path: task.relativePath,
          size: task.size,
          extension: task.ext,
        });
      },
      worker: async (task) => {
        const fileChunks = await this.chunkFileWorker(task, context);
        this.chunks.push(...fileChunks);
        processedCount++;

        // Report progress
        if (context.onProgress && processedCount % 10 === 0) {
          const stats = memoryQueue.getStats();
          context.onProgress({
            stage: this.name,
            current: processedCount,
            total: tasks.length,
            message: `Chunked ${processedCount}/${tasks.length} files (${stats.activeTasks} active, heap: ${(stats.heapUsagePercent * 100).toFixed(0)}%)`,
          });
        }

        return fileChunks;
      },
      safeThreshold: this.options.safeThreshold ?? 0.7, // 70% of heap limit
      minConcurrency: this.options.minConcurrency ?? 1,
      memoryReserve: this.options.memoryReserve ?? 512 * 1024 * 1024, // 512MB
      checkInterval: 100, // Check every 100ms
    });

    // Start processing
    memoryQueue.start();

    // Enqueue all tasks
    try {
      const promises = tasks.map(task => memoryQueue.enqueue(task));
      await Promise.all(promises);

      // Shutdown queue
      await memoryQueue.shutdown();

      // Apply final backpressure
      await context.memoryMonitor.applyBackpressure();
    } catch (error) {
      context.logger.error('Memory-aware chunking failed', {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }

    // Update context stats
    context.stats.filesProcessed = processedCount;
    context.stats.filesSkipped = 0;
    context.chunksProcessed = this.chunks.length;

    const queueStats = memoryQueue.getStats();
    context.logger.info('Memory-aware parallel chunking complete', {
      filesProcessed: processedCount,
      totalChunks: this.chunks.length,
      peakActiveTasks: queueStats.activeTasks,
      failedTasks: queueStats.failedTasks,
      heapUsagePercent: (queueStats.heapUsagePercent * 100).toFixed(1) + '%',
    });

    return {
      success: true,
      message: `Chunked ${processedCount} files into ${this.chunks.length} chunks (memory-aware)`,
      data: {
        filesProcessed: processedCount,
        totalChunks: this.chunks.length,
        peakActiveTasks: queueStats.activeTasks,
      },
    };
  }

  /**
   * Worker function - processes a single file
   */
  private async chunkFileWorker(
    task: ChunkFileTask,
    context: PipelineContext
  ): Promise<MindChunk[]> {
    const { source, relativePath, fullPath, size, ext } = task;
    const normalizedPath = relativePath.replace(/\\/g, '/');

    try {
      // Get file info
      const stats = await fs.stat(fullPath);
      const mtime = stats.mtimeMs;

      // Select appropriate chunker
      const chunker = this.chunkerFactory.select({
        path: normalizedPath,
        size,
        extension: ext,
      });

      // Calculate file hash (for deduplication)
      const hashStream = createHash('sha256');
      const fileStream = await fs.open(fullPath, 'r');
      const readStream = fileStream.createReadStream();

      for await (const chunk of readStream) {
        hashStream.update(chunk);
      }

      const hash = hashStream.digest('hex');
      await fileStream.close();

      // Check if chunker supports streaming
      const chunkerWithStream = chunker as any;
      if (!chunkerWithStream.chunkStream) {
        throw new Error(
          `Chunker ${chunker.id} does not support streaming. ` +
          `All chunkers must implement chunkStream() for memory safety.`
        );
      }

      // Stream chunks from file
      const fileChunks: MindChunk[] = [];

      for await (const sourceChunk of chunkerWithStream.chunkStream(fullPath, {})) {
        // Create MindChunk
        const mindChunk: MindChunk = {
          chunkId: `${source.id}:${normalizedPath}:${sourceChunk.span.startLine}-${sourceChunk.span.endLine}`,
          sourceId: source.id,
          path: normalizedPath,
          span: sourceChunk.span,
          text: sourceChunk.text,
          metadata: {
            kind: source.kind,
            language: source.language,
            chunkerId: chunker.id,
            ...sourceChunk.metadata,
          },
          hash,
          mtime,
        };

        fileChunks.push(mindChunk);
      }

      return fileChunks;
    } catch (error) {
      context.logger.error('Failed to chunk file', {
        file: relativePath,
        error: error instanceof Error ? error.message : String(error),
      });

      context.stats.errors.push({
        file: relativePath,
        error: error instanceof Error ? error.message : String(error),
      });

      // Return empty array on error (don't fail entire batch)
      return [];
    }
  }

  /**
   * Get chunks (for next stage)
   */
  getChunks(): ReadonlyArray<MindChunk> {
    return this.chunks;
  }

  /**
   * Optional: Cleanup
   */
  async cleanup(context: PipelineContext): Promise<void> {
    context.logger.debug('Memory-aware parallel chunking cleanup', {
      chunksInMemory: this.chunks.length,
    });
  }

  /**
   * Optional: Checkpoint
   */
  async checkpoint(context: PipelineContext): Promise<any> {
    return {
      stage: this.name,
      processedFiles: [],
      stats: context.stats,
      timestamp: Date.now(),
      chunksGenerated: this.chunks.length,
    };
  }
}
