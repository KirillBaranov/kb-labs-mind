/**
 * EmbeddingStage - Generate embeddings for chunks
 *
 * Responsibilities:
 * - Receive chunks from ChunkingStage
 * - Batch chunks for efficient API calls
 * - Call embedding provider with batched chunks
 * - Handle rate limits via RateLimiter
 * - Memory-efficient processing
 * - Progress reporting
 */

import type { PipelineStage, PipelineContext, StageResult } from '../pipeline-types';
import type { MindChunk } from './chunking';
import type {
  RateLimiter} from '../../rate-limiting/index';
import {
  type RateLimitConfig,
  type RateLimitPreset,
  getRateLimitConfig,
  estimateBatchTokens,
  createRateLimiter,
} from '../../rate-limiting/index';

export interface ChunkWithEmbedding extends MindChunk {
  embedding: number[];
}

export interface EmbeddingProvider {
  /**
   * Generate embeddings for multiple texts in one API call
   * @param texts Array of texts to embed
   * @returns Array of embedding vectors
   */
  embedBatch(texts: string[]): Promise<number[][]>;

  /**
   * Maximum batch size supported by this provider
   */
  readonly maxBatchSize: number;

  /**
   * Embedding dimension
   */
  readonly dimension: number;

  /**
   * Optional: Rate limit configuration for this provider
   * If not provided, default OpenAI tier-2 limits will be used
   */
  readonly rateLimits?: RateLimitConfig;
}

export interface EmbeddingStageOptions {
  /**
   * Chunks per batch (default: auto-calculated based on rate limits)
   */
  batchSize?: number;

  /**
   * Max retries per batch on transient errors (default: 3)
   */
  maxRetries?: number;

  /**
   * Initial delay between retries in ms (default: 1000)
   */
  retryDelay?: number;

  /**
   * Maximum parallel API calls (default: 5)
   * Rate limiter will control actual concurrency based on available capacity
   */
  maxConcurrency?: number;

  /**
   * Rate limit configuration or preset name
   * Examples: 'openai-tier-2', 'sber-gigachat', 'ollama-local'
   * Or custom RateLimitConfig object
   */
  rateLimits?: RateLimitConfig | RateLimitPreset;
}

/**
 * Embedding Stage
 * Generates embeddings for chunks using batched API calls with rate limiting
 */
export class EmbeddingStage implements PipelineStage {
  readonly name = 'embedding';
  readonly description = 'Generate embeddings for chunks';

  private chunksWithEmbeddings: ChunkWithEmbedding[] = [];
  private rateLimiter: RateLimiter;

  constructor(
    private embeddingProvider: EmbeddingProvider,
    private chunks: MindChunk[],
    private options: EmbeddingStageOptions = {}
  ) {
    // Initialize rate limiter from options or provider config
    const rateLimitConfig = getRateLimitConfig(
      options.rateLimits ?? embeddingProvider.rateLimits
    );
    this.rateLimiter = createRateLimiter(rateLimitConfig);
  }

  async execute(context: PipelineContext): Promise<StageResult> {
    if (this.chunks.length === 0) {
      context.logger.warn('No chunks to embed');
      return {
        success: true,
        message: 'No chunks to process',
      };
    }

    const maxConcurrency = this.options.maxConcurrency ?? 5;
    const batchSize = this.calculateBatchSize();

    context.logger.debug('Generating embeddings with rate limiting', {
      chunksCount: this.chunks.length,
      provider: this.embeddingProvider.constructor.name,
      dimension: this.embeddingProvider.dimension,
      batchSize,
      maxConcurrency,
    });

    // Prepare batches
    const batches: { chunks: MindChunk[]; index: number }[] = [];
    for (let i = 0; i < this.chunks.length; i += batchSize) {
      batches.push({
        chunks: this.chunks.slice(i, i + batchSize),
        index: i,
      });
    }

    // Results storage (ordered by batch index)
    const results: ChunkWithEmbedding[][] = new Array(batches.length);
    let processedCount = 0;
    let errorCount = 0;
    let nextBatchIndex = 0;
    const mutex = { locked: false };

    // Worker function - processes batches until none left
    const processBatches = async (): Promise<void> => {
      while (true) {
        // Atomically get next batch index
        while (mutex.locked) {
          await this.sleep(1);
        }
        mutex.locked = true;
        const currentIndex = nextBatchIndex;
        if (currentIndex >= batches.length) {
          mutex.locked = false;
          break;
        }
        nextBatchIndex++;
        mutex.locked = false;

        const batchItem = batches[currentIndex];
        if (!batchItem) {
          throw new Error(`Batch at index ${currentIndex} is undefined`);
        }
        const { chunks: batch, index: batchStart } = batchItem;
        const texts = batch.map((c: { text: string }) => c.text);

        // Estimate tokens for this batch
        const estimatedTokens = estimateBatchTokens(texts);

        // Wait for rate limiter capacity
        await this.rateLimiter.acquire(estimatedTokens);

        context.logger.debug('Processing embedding batch', {
          batchIndex: currentIndex,
          batchStart,
          batchSize: batch.length,
          estimatedTokens,
          progress: `${currentIndex + 1}/${batches.length}`,
        });

        try {
          // Embed batch with retry logic
          const embeddings = await this.embedBatchWithRetry(texts, context);

          // Release rate limiter slot
          this.rateLimiter.release();

          // Combine chunks with embeddings
          const batchResults: ChunkWithEmbedding[] = [];
          for (let j = 0; j < batch.length; j++) {
            const embedding = embeddings[j];
            const chunk = batch[j];
            if (embedding && chunk) {
              batchResults.push({
                ...chunk,
                chunkId: chunk.chunkId ?? '',
                sourceId: chunk.sourceId ?? '',
                path: chunk.path ?? '',
                embedding,
              });
            }
          }
          results[currentIndex] = batchResults;

          // Update progress (atomic increment)
          while (mutex.locked) {
            await this.sleep(1);
          }
          mutex.locked = true;
          processedCount += batch.length;
          const currentProcessed = processedCount;
          mutex.locked = false;

          // Report progress with rate limiter stats
          if (context.onProgress && currentProcessed % 100 === 0) {
            const rlStats = this.rateLimiter.getStats();
            context.onProgress({
              stage: this.name,
              current: currentProcessed,
              total: this.chunks.length,
              message: `Embedded ${currentProcessed}/${this.chunks.length} chunks (waits: ${rlStats.waitCount})`,
            });
          }

          // Force GC periodically
          if (currentProcessed % 500 === 0 && global.gc) {
            global.gc();
          }

          // Apply memory backpressure
          await context.memoryMonitor.applyBackpressure();
        } catch (error) {
          // Release rate limiter slot on error
          this.rateLimiter.release();

          // Update error count (atomic)
          while (mutex.locked) {
            await this.sleep(1);
          }
          mutex.locked = true;
          errorCount += batch.length;
          const currentErrors = context.stats.errors.length;
          mutex.locked = false;

          // Log error for this batch
          context.logger.error('Failed to embed batch', {
            batchIndex: currentIndex,
            batchSize: batch.length,
            error: error instanceof Error ? error.message : String(error),
          });

          // Add to error stats
          for (const chunk of batch) {
            context.stats.errors.push({
              file: chunk.path,
              error: `Embedding failed: ${error instanceof Error ? error.message : String(error)}`,
            });
          }

          // Store empty array for failed batch
          results[currentIndex] = [];

          // Check if too many errors
          if (currentErrors >= 100) {
            context.logger.error('Too many embedding errors, aborting');
            break;
          }
        }
      }
    };

    // Launch parallel workers
    const workers = Array(Math.min(maxConcurrency, batches.length))
      .fill(null)
      .map(() => processBatches());

    await Promise.all(workers);

    // Flatten results in order
    this.chunksWithEmbeddings = results.flat().filter(Boolean);

    // Update context stats
    context.embeddingsGenerated = processedCount;
    context.stats.totalChunks = this.chunksWithEmbeddings.length;

    // Log final rate limiter stats
    const rlStats = this.rateLimiter.getStats();
    context.logger.debug('Embedding complete', {
      chunksProcessed: processedCount,
      chunksFailed: errorCount,
      totalEmbeddings: this.chunksWithEmbeddings.length,
      parallelWorkers: maxConcurrency,
      rateLimiterWaits: rlStats.waitCount,
      rateLimiterWaitTime: `${(rlStats.totalWaitTime / 1000).toFixed(1)}s`,
      totalTokensUsed: rlStats.totalTokens,
    });

    return {
      success: errorCount === 0,
      message: `Generated ${processedCount} embeddings (${errorCount} failed)`,
      data: {
        chunksProcessed: processedCount,
        chunksFailed: errorCount,
        totalEmbeddings: this.chunksWithEmbeddings.length,
        rateLimiterStats: rlStats,
      },
    };
  }

  /**
   * Embed batch with retry logic
   */
  private async embedBatchWithRetry(
    texts: string[],
    context: PipelineContext
  ): Promise<number[][]> {
    const maxRetries = this.options.maxRetries ?? 3;
    const retryDelay = this.options.retryDelay ?? 1000;

    let lastError: Error | undefined;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await this.embeddingProvider.embedBatch(texts);
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        // Check if it's a rate limit error - if so, the rate limiter will handle it
        const isRateLimit = lastError.message.toLowerCase().includes('rate limit');

        if (attempt < maxRetries) {
          // Exponential backoff (longer for rate limit errors)
          const baseDelay = isRateLimit ? retryDelay * 2 : retryDelay;
          const delay = baseDelay * Math.pow(2, attempt);

          context.logger.warn('Embedding batch failed, retrying', {
            attempt: attempt + 1,
            maxRetries,
            delay: `${delay}ms`,
            isRateLimit,
            error: lastError.message,
          });

          await this.sleep(delay);
        }
      }
    }

    // All retries failed
    throw new Error(
      `Failed to embed batch after ${maxRetries} retries: ${lastError?.message}`
    );
  }

  /**
   * Calculate optimal batch size based on rate limits
   */
  private calculateBatchSize(): number {
    const userBatchSize = this.options.batchSize;
    const providerMaxBatch = this.embeddingProvider.maxBatchSize;

    // Use user preference if provided
    if (userBatchSize !== undefined) {
      return Math.min(userBatchSize, providerMaxBatch);
    }

    // Calculate based on rate limiter capacity
    // Average chunk is ~500 tokens, aim for ~100K tokens per batch for good throughput
    const avgTokensPerChunk = 500;
    const targetTokensPerBatch = 100_000;
    const optimalByTokens = Math.floor(targetTokensPerBatch / avgTokensPerChunk);

    // Return min of optimal and provider max
    return Math.min(optimalByTokens, providerMaxBatch, 500);
  }

  /**
   * Sleep utility
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get chunks with embeddings (for next stage)
   */
  getChunksWithEmbeddings(): ReadonlyArray<ChunkWithEmbedding> {
    return this.chunksWithEmbeddings;
  }

  /**
   * Get rate limiter for external monitoring
   */
  getRateLimiter(): RateLimiter {
    return this.rateLimiter;
  }

  /**
   * Optional: Cleanup
   */
  async cleanup(context: PipelineContext): Promise<void> {
    context.logger.debug('Embedding stage cleanup', {
      chunksInMemory: this.chunksWithEmbeddings.length,
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
      embeddingsGenerated: this.chunksWithEmbeddings.length,
    };
  }
}
