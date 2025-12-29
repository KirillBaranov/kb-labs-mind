/**
 * ChunkingStage - Convert files to chunks using streaming
 *
 * Responsibilities:
 * - Read discovered files
 * - Select appropriate chunker for each file
 * - Stream chunks (memory-efficient)
 * - Handle errors per-file (don't fail entire batch)
 * - Memory monitoring and backpressure
 * - Progress reporting
 */

import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { createHash } from 'node:crypto';
import { useLogger } from '@kb-labs/sdk';
import type { PipelineStage, PipelineContext, StageResult } from '../pipeline-types';
import type { AdaptiveChunkerFactory } from '../../chunking/adaptive-factory';
import type { FileMetadata } from './discovery';

const getChunkingLogger = () => useLogger().child({ category: 'mind:engine:chunking' });

export interface MindChunk {
  chunkId: string;
  sourceId: string;
  path: string;
  span: { startLine: number; endLine: number };
  text: string;
  metadata: Record<string, unknown>;
  hash?: string;
  mtime?: number;
}

/**
 * Chunking Stage
 * Converts files to chunks using streaming approach
 */
export class ChunkingStage implements PipelineStage {
  readonly name = 'chunking';
  readonly description = 'Convert files to chunks';

  private chunks: MindChunk[] = [];

  constructor(
    private chunkerFactory: AdaptiveChunkerFactory,
    private runtime: any, // RuntimeAdapter
    private fileMetadata?: Map<string, FileMetadata>
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

    context.logger.debug('Chunking files', {
      filesCount: filePaths.length,
    });

    this.chunks = [];
    let processedCount = 0;
    let skippedCount = 0;

    // Process files in batches for memory efficiency
    const batchSize = this.calculateBatchSize(context);

    for (let i = 0; i < filePaths.length; i += batchSize) {
      const batch = filePaths.slice(i, i + batchSize);

      context.logger.debug('Processing batch', {
        batchStart: i,
        batchSize: batch.length,
      });

      // Process batch
      for (const relativePath of batch) {
        try {
          const fileChunks = await this.chunkFile(relativePath, context);
          this.chunks.push(...fileChunks);
          processedCount++;

          // Report progress
          if (context.onProgress && processedCount % 10 === 0) {
            context.onProgress({
              stage: this.name,
              current: processedCount,
              total: filePaths.length,
              message: `Chunked ${processedCount}/${filePaths.length} files`,
            });
          }

          // Force GC periodically to prevent memory buildup
          if (processedCount % 50 === 0 && global.gc) {
            global.gc();
          }
        } catch (error) {
          skippedCount++;
          context.stats.errors.push({
            file: relativePath,
            error: error instanceof Error ? error.message : String(error),
          });

          context.logger.error('Failed to chunk file', {
            file: relativePath,
            error: error instanceof Error ? error.message : String(error),
          });

          // Continue processing other files
          if (!context.stats.errors || context.stats.errors.length < 100) {
            continue;
          } else {
            // Too many errors, abort
            break;
          }
        }
      }

      // Apply memory backpressure after batch
      await context.memoryMonitor.applyBackpressure();
    }

    // Update context stats
    context.stats.filesProcessed = processedCount;
    context.stats.filesSkipped = skippedCount;
    context.chunksProcessed = this.chunks.length;

    context.logger.debug('Chunking complete', {
      filesProcessed: processedCount,
      filesSkipped: skippedCount,
      totalChunks: this.chunks.length,
    });

    return {
      success: true,
      message: `Chunked ${processedCount} files into ${this.chunks.length} chunks`,
      data: {
        filesProcessed: processedCount,
        totalChunks: this.chunks.length,
      },
    };
  }

  /**
   * Chunk a single file using streaming
   */
  private async chunkFile(
    relativePath: string,
    context: PipelineContext
  ): Promise<MindChunk[]> {
    const fullPath = path.resolve(process.cwd(), relativePath);
    const normalizedPath = relativePath.replace(/\\/g, '/');

    // Get file info
    const stats = await fs.stat(fullPath);
    const size = stats.size;
    const mtime = stats.mtimeMs;
    const ext = path.extname(relativePath).toLowerCase();

    // Select appropriate chunker
    const chunker = this.chunkerFactory.select({
      path: normalizedPath,
      size,
      extension: ext,
    });

    // DEBUG: Log which chunker is selected for which file
    getChunkingLogger().debug(`File: ${normalizedPath}, Size: ${(size / 1024).toFixed(1)}KB, Chunker: ${chunker.id}`);

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
    const source = context.sources[0]; // TODO: map file to correct source

    if (!source) {
      throw new Error(`No source found for file: ${normalizedPath}`);
    }

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

      // Chunk immediately goes out of scope after push
      // This prevents memory accumulation
    }

    context.logger.debug('File chunked', {
      file: normalizedPath,
      chunks: fileChunks.length,
    });

    return fileChunks;
  }

  /**
   * Calculate optimal batch size based on available memory
   */
  private calculateBatchSize(context: PipelineContext): number {
    const memoryStats = context.memoryMonitor.getStats();
    const memoryUsage = memoryStats.heapPercent;

    // Adjust batch size based on memory pressure
    if (memoryUsage > 0.8) {
      return 5; // High memory pressure - small batches
    } else if (memoryUsage > 0.6) {
      return 10; // Medium memory pressure
    } else {
      return 20; // Low memory pressure - larger batches
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
    // Chunks will be passed to next stage, don't clear yet
    // Just log summary
    context.logger.debug('Chunking stage cleanup', {
      chunksInMemory: this.chunks.length,
    });
  }

  /**
   * Optional: Checkpoint
   */
  async checkpoint(context: PipelineContext): Promise<any> {
    return {
      stage: this.name,
      processedFiles: [], // Would track which files are chunked
      stats: context.stats,
      timestamp: Date.now(),
      chunksGenerated: this.chunks.length,
    };
  }
}
