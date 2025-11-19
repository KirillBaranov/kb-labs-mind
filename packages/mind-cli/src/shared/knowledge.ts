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

export async function createMindKnowledgeRuntime(
  options: MindKnowledgeRuntimeOptions,
): Promise<MindKnowledgeRuntime> {
  // Load config from kb.config.json
  const configResult = await findNearestConfig({
    startDir: options.cwd,
    filenames: ['kb.config.json'],
  });
  
  if (!configResult.path) {
    throw new Error(`kb.config.json not found in ${options.cwd} or parent directories`);
  }
  
  const jsonResult = await readJsonWithDiagnostics<{ knowledge?: KnowledgeConfigInput }>(configResult.path);
  if (!jsonResult.ok) {
    throw new Error(`Failed to read kb.config.json: ${jsonResult.diagnostics.map(d => d.message).join(', ')}`);
  }
  
  const config: KnowledgeConfigInput = jsonResult.data.knowledge ?? {
    sources: [],
    scopes: [],
    engines: [],
  };
  
  // Create a logger if none provided - use console for debugging
  const defaultLogger: KnowledgeLogger = {
    debug: (msg: string, meta?: Record<string, unknown>) => {
      if (process.env.DEBUG) {
        console.debug(`[DEBUG] ${msg}`, meta ? JSON.stringify(meta, null, 2) : '');
      }
    },
    info: (msg: string, meta?: Record<string, unknown>) => {
      console.log(`[INFO] ${msg}`, meta ? JSON.stringify(meta, null, 2) : '');
    },
    warn: (msg: string, meta?: Record<string, unknown>) => {
      console.warn(`[WARN] ${msg}`, meta ? JSON.stringify(meta, null, 2) : '');
    },
    error: (msg: string, meta?: Record<string, unknown>) => {
      console.error(`[ERROR] ${msg}`, meta ? JSON.stringify(meta, null, 2) : '');
    },
  };
  const logger = options.logger ?? defaultLogger;
  
  // Inject runtime into mind engine options if provided, or create one with logger
  // Use the logger passed in options, or create one that uses the logger
  const logFn = (level: 'debug' | 'info' | 'warn' | 'error', msg: string, meta?: Record<string, unknown>) => {
    if (level === 'debug' && logger.debug) logger.debug(msg, meta);
    else if (level === 'info' && logger.info) logger.info(msg, meta);
    else if (level === 'warn' && logger.warn) logger.warn(msg, meta);
    else if (logger.error) logger.error(msg, meta);
  };
  
  // If runtime is provided, use its log function, otherwise use logger-based logFn
  // This ensures that wrappedRuntime.log from rag.ts is used
  const runtimeWithLogger = options.runtime
    ? {
        ...options.runtime,
        log: options.runtime.log ?? logFn,
      }
    : {
        log: logFn,
      };
  
  // Add onProgress to mind engine options if present
  const configWithRuntime: KnowledgeConfigInput = {
        ...config,
        engines: config.engines?.map((engine: any) => {
          if (engine.type === 'mind') {
            return {
              ...engine,
              options: {
                ...engine.options,
                onProgress: options.onProgress,
                _runtime: runtimeWithLogger,
              },
            };
          }
          return engine;
        }),
  };
  
  const capabilities = buildMindCapabilities(configWithRuntime);
  
  // Create registry with mind engine registered
  const registry = createKnowledgeEngineRegistry(logger);
  registerMindKnowledgeEngine(registry);
  
  // Create knowledge service
  const serviceOptions: KnowledgeServiceOptions = {
    config: configWithRuntime,
    capabilities,
    workspaceRoot: options.cwd,
    logger: options.logger ?? undefined,
    registry,
  };
  
  const service = createKnowledgeService(serviceOptions);

  return { service, config: configWithRuntime };
}

function buildMindCapabilities(
  config: KnowledgeConfigInput,
): KnowledgeCapabilityRegistry {
  if (!config.scopes?.length) {
    throw new Error(
      'knowledge.scopes is empty in kb.config.json. Define at least one scope to use Mind knowledge.',
    );
  }

  const allowedScopes = config.scopes.map((scope: any) => scope.id);
  const mindCapability: KnowledgeCapability = {
    productId: MIND_PRODUCT_ID,
    allowedIntents: ['summary', 'search', 'similar', 'nav'],
    allowedScopes,
    maxChunks: config.defaults?.maxChunks,
  };

  return {
    [MIND_PRODUCT_ID]: mindCapability,
  };
}
