import type {
  IAnalytics,
  ICache,
  IEmbeddings,
  ILLM,
  ILogger,
  IStorage,
  IVectorStore,
} from '@kb-labs/sdk';
import type { EmbeddingProvider } from '@kb-labs/mind-embeddings';

export interface MindPlatformBindings {
  vectorStore?: IVectorStore;
  embeddings?: IEmbeddings;
  llm?: ILLM;
  cache?: ICache;
  storage?: IStorage;
  logger?: ILogger;
  analytics?: IAnalytics;
}

export class PlatformEmbeddingProvider implements EmbeddingProvider {
  readonly id = 'platform-embeddings';

  constructor(private readonly embeddings: IEmbeddings) {}

  async embed(texts: string[]): Promise<import('@kb-labs/sdk').EmbeddingVector[]> {
    const vectors = await this.embeddings.embedBatch(texts);
    const dim = this.embeddings.dimensions ?? (vectors[0]?.length ?? 0);
    return vectors.map(values => ({
      dim: dim || values.length,
      values,
    }));
  }
}

