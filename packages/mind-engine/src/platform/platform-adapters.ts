import type {
  IAnalytics,
  ICache,
  IEmbeddings,
  ILLM,
  ILogger,
  IStorage,
  IVectorStore,
} from '@kb-labs/core-platform';
import type { EmbeddingProvider } from '@kb-labs/mind-embeddings';
import type {
  MindLLMEngine,
  MindLLMGenerateOptions,
  MindLLMGenerateResult,
} from '@kb-labs/mind-llm';

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

  async embed(texts: string[]): Promise<import('@kb-labs/knowledge-contracts').EmbeddingVector[]> {
    const vectors = await this.embeddings.embedBatch(texts);
    const dim = this.embeddings.dimensions ?? (vectors[0]?.length ?? 0);
    return vectors.map(values => ({
      dim: dim || values.length,
      values,
    }));
  }
}

export class PlatformLLMEngine implements MindLLMEngine {
  readonly id: string;
  readonly description?: string;

  constructor(private readonly llm: ILLM) {
    this.id = 'platform-llm';
  }

  async generate(
    prompt: string,
    options?: MindLLMGenerateOptions,
  ): Promise<MindLLMGenerateResult> {
    const response = await this.llm.complete(prompt, {
      model: options?.metadata?.model ?? options?.systemPrompt ?? options?.model,
      temperature: options?.temperature,
      maxTokens: options?.maxTokens,
      stop: options?.stop,
      systemPrompt: options?.systemPrompt,
    });

    return {
      text: response.content,
      tokens: response.usage?.completionTokens ?? response.content.length,
      finishReason: 'stop',
      metadata: {
        model: response.model,
      },
    };
  }
}

