import { findNearestConfig, readJsonWithDiagnostics } from '@kb-labs/core';
import {
  createKnowledgeService,
  createKnowledgeEngineRegistry,
  type KnowledgeServiceOptions,
} from '@kb-labs/knowledge-core';
import type {
  KnowledgeCapability,
  KnowledgeCapabilityRegistry,
  KnowledgeConfigInput,
} from '@kb-labs/knowledge-contracts';
import type {
  KnowledgeLogger,
  KnowledgeService,
} from '@kb-labs/knowledge-core';
import {
  registerMindKnowledgeEngine,
  type RuntimeAdapter,
} from '@kb-labs/mind-engine';

export const MIND_PRODUCT_ID = 'mind';

export interface MindKnowledgeRuntime {
  service: KnowledgeService;
  config: KnowledgeConfigInput;
}

export interface MindKnowledgeRuntimeOptions {
  cwd: string;
  logger?: KnowledgeLogger;
  /**
   * Progress callback for tracking query execution stages
   */
  onProgress?: (event: { stage: string; details?: string; metadata?: Record<string, unknown>; timestamp: number }) => void;
  /**
   * Runtime adapter for sandbox Runtime API
   * If provided, will be passed to MindKnowledgeEngine through config options
   */
  runtime?: RuntimeAdapter | {
    fetch?: typeof fetch;
    fs?: any;
    env?: (key: string) => string | undefined;
    log?: (
      level: 'debug' | 'info' | 'warn' | 'error',
      msg: string,
      meta?: Record<string, unknown>,
    ) => void;
    analytics?: {
      track(event: string, properties?: Record<string, unknown>): void;
      metric(name: string, value: number, tags?: Record<string, string>): void;
    };
  };
}

/**
 * Create Mind knowledge runtime
 */
export async function createMindKnowledgeRuntime(
  options: MindKnowledgeRuntimeOptions,
): Promise<MindKnowledgeRuntime> {
  const config = await findAndReadConfig(options.cwd);

  // Create engine registry
  // Note: createKnowledgeEngineRegistry expects KnowledgeLogger directly, not an options object
  const engineRegistry = createKnowledgeEngineRegistry(
    options.logger ?? { debug: () => {}, info: () => {}, warn: () => {}, error: () => {} },
  );

  // Register Mind engine with runtime adapter if provided
  registerMindKnowledgeEngine(engineRegistry, {
    runtime: options.runtime,
  });

  // Build capabilities registry for the 'mind' product
  // This allows queries with productId: 'mind' to succeed
  const allScopeIds = config.scopes?.map((scope: any) => scope.id) ?? [];
  const capabilities = {
    [MIND_PRODUCT_ID]: {
      productId: MIND_PRODUCT_ID,
      allowedIntents: ['summary', 'search', 'similar', 'nav'] as const,
      allowedScopes: allScopeIds,
      defaultScopeId: allScopeIds[0],
      description: 'Mind knowledge engine capability',
    },
  };

  // Create knowledge service
  // Note: KnowledgeServiceOptions expects 'registry', not 'engineRegistry'
  // Note: onProgress is not part of KnowledgeServiceOptions, it's passed to engine via options
  const service = createKnowledgeService({
    config,
    registry: engineRegistry,
    capabilities,
    logger: options.logger,
  });

  return {
    service,
    config,
  };
}

/**
 * Find and read knowledge config
 * Supports both kb.config.json (with knowledge key) and knowledge.json (flat format)
 */
async function findAndReadConfig(cwd: string): Promise<KnowledgeConfigInput> {
  const { path: configPath } = await findNearestConfig({
    startDir: cwd,
    filenames: ['kb.config.json', 'knowledge.json'],
  });
  if (!configPath) {
    throw new Error('No kb.config.json or knowledge.json found. Run "kb mind init" first.');
  }

  // Read raw JSON first to check format
  const result = await readJsonWithDiagnostics<Record<string, unknown>>(configPath);
  if (!result.ok) {
    throw new Error(`Failed to read config: ${result.diagnostics.map(d => d.message).join(', ')}`);
  }

  // Check if this is kb.config.json (has 'knowledge' key) or flat knowledge.json
  const rawData = result.data;
  const knowledgeConfig = (rawData.knowledge as KnowledgeConfigInput) ?? (rawData as unknown as KnowledgeConfigInput);

  // Validate required fields
  if (!knowledgeConfig.sources || !knowledgeConfig.scopes || !knowledgeConfig.engines) {
    throw new Error('Invalid knowledge configuration. Must have sources, scopes, and engines.');
  }

  return knowledgeConfig;
}
