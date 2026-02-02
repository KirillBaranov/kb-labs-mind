import {
  createKnowledgeService,
  createKnowledgeEngineRegistry,
  type KnowledgeConfigInput,
  type KnowledgeLogger,
  type KnowledgeService,
  type PlatformServices,
  type KnowledgeCapabilityRegistry,
} from '@kb-labs/sdk';
import { findNearestConfig, readJsonWithDiagnostics } from '@kb-labs/sdk';
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
  /**
   * Mind configuration (from ctx.config)
   * If provided, will be used instead of reading from file
   */
  config?: KnowledgeConfigInput;
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
  /**
   * Platform services (passed through to mind-engine for ports/adapters)
   */
  platform?: PlatformServices;
}

/**
 * Create Mind knowledge runtime
 */
export async function createMindKnowledgeRuntime(
  options: MindKnowledgeRuntimeOptions,
): Promise<MindKnowledgeRuntime> {
  // Use provided config (from ctx.config) or fallback to file reading for backward compatibility
  const config = options.config ?? await findAndReadConfig(options.cwd);

  // Create engine registry
  // Note: createKnowledgeEngineRegistry expects KnowledgeLogger directly, not an options object
  const engineRegistry = createKnowledgeEngineRegistry(
    options.logger ?? { debug: () => {}, info: () => {}, warn: () => {}, error: () => {} },
  );

  // Register Mind engine with runtime adapter if provided
  registerMindKnowledgeEngine(engineRegistry, {
    runtime: options.runtime,
    platform: options.platform,
  });

  // Build capabilities registry for the 'mind' product
  // This allows queries with productId: 'mind' to succeed
  const allScopeIds = config.scopes?.map((scope: any) => scope.id) ?? [];
  const capabilities: KnowledgeCapabilityRegistry = {
    [MIND_PRODUCT_ID]: {
      productId: MIND_PRODUCT_ID,
      allowedIntents: ['summary', 'search', 'similar', 'nav'],
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
    workspaceRoot: options.cwd, // CRITICAL: Pass cwd as workspaceRoot for file discovery
  });

  return {
    service,
    config,
  };
}

/**
 * Find and read knowledge config
 * Supports Profiles v2 (profiles[].products.mind) and legacy formats
 */
async function findAndReadConfig(cwd: string): Promise<KnowledgeConfigInput> {
  const { path: configPath } = await findNearestConfig({
    startDir: cwd,
    filenames: [
      '.kb/kb.config.json',      // Prioritize .kb/ location (new standard)
      'kb.config.json',           // Fallback to root (deprecated)
      '.kb/knowledge.json',
      'knowledge.json',
    ],
  });
  if (!configPath) {
    throw new Error('No kb.config.json or knowledge.json found. Run "kb mind init" first.');
  }

  // Read raw JSON first to check format
  const result = await readJsonWithDiagnostics<Record<string, unknown>>(configPath);
  if (!result.ok) {
    throw new Error(`Failed to read config: ${result.diagnostics.map((d: { message: string }) => d.message).join(', ')}`);
  }

  const rawData = result.data;
  let knowledgeConfig: KnowledgeConfigInput | undefined;

  // Try Profiles v2 format first: profiles[0].products.mind
  if (Array.isArray(rawData.profiles) && rawData.profiles.length > 0) {
    const defaultProfile = rawData.profiles.find((p: any) => p.id === 'default') ?? rawData.profiles[0];
    if (defaultProfile && typeof defaultProfile === 'object' && 'products' in defaultProfile) {
      const products = (defaultProfile as any).products;
      if (products && typeof products === 'object' && MIND_PRODUCT_ID in products) {
        knowledgeConfig = products[MIND_PRODUCT_ID] as KnowledgeConfigInput;
      }
    }
  }

  // Fallback to legacy formats
  if (!knowledgeConfig) {
    // Legacy: kb.config.json with top-level 'knowledge' key
    knowledgeConfig = (rawData.knowledge as KnowledgeConfigInput) ?? (rawData as unknown as KnowledgeConfigInput);
  }

  // Validate required fields
  if (!knowledgeConfig?.sources || !knowledgeConfig?.scopes || !knowledgeConfig?.engines) {
    throw new Error('Invalid knowledge configuration. Must have sources, scopes, and engines.');
  }

  return knowledgeConfig;
}
