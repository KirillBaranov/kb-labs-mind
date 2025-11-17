import type { KnowledgeIntent } from '@kb-labs/knowledge-contracts';
import type { KnowledgeResult } from '@kb-labs/knowledge-core';
import {
  MIND_PRODUCT_ID,
  createMindKnowledgeRuntime,
} from '../shared/knowledge.js';

export interface RagIndexOptions {
  cwd: string;
  scopeId?: string;
}

export interface RagIndexResult {
  scopeIds: string[];
}

export interface RagIndexOptionsWithRuntime extends RagIndexOptions {
  runtime?: Parameters<typeof createMindKnowledgeRuntime>[0]['runtime'];
}

export async function runRagIndex(
  options: RagIndexOptions | RagIndexOptionsWithRuntime,
): Promise<RagIndexResult> {
  const runtime = await createMindKnowledgeRuntime({
    cwd: options.cwd,
    runtime: 'runtime' in options ? options.runtime : undefined,
  });
  const allScopeIds = runtime.config.scopes?.map((scope: any) => scope.id) ?? [];
  if (!allScopeIds.length) {
    throw new Error('No knowledge scopes found. Update kb.config.json first.');
  }

  const scopeIds = options.scopeId
    ? allScopeIds.filter((scopeId: string) => scopeId === options.scopeId)
    : allScopeIds;

  if (!scopeIds.length) {
    throw new Error(
      `Scope "${options.scopeId}" is not defined in knowledge.scopes.`,
    );
  }

  for (const scopeId of scopeIds) {
    await runtime.service.index(scopeId);
  }

  return { scopeIds };
}

export interface RagQueryOptions {
  cwd: string;
  scopeId?: string;
  text: string;
  intent?: KnowledgeIntent;
  limit?: number;
  profileId?: string;
  runtime?: Parameters<typeof createMindKnowledgeRuntime>[0]['runtime'];
}

export interface RagQueryResult {
  scopeId: string;
  knowledge: KnowledgeResult;
}

export async function runRagQuery(
  options: RagQueryOptions,
): Promise<RagQueryResult> {
  const runtime = await createMindKnowledgeRuntime({
    cwd: options.cwd,
    runtime: options.runtime,
  });
  const defaultScopeId = runtime.config.scopes?.[0]?.id;
  const scopeId = options.scopeId ?? defaultScopeId;
  if (!scopeId) {
    throw new Error(
      'No knowledge scopes configured. Provide at least one scope in kb.config.json.',
    );
  }

  const knowledge = await runtime.service.query({
    productId: MIND_PRODUCT_ID,
    intent: options.intent ?? 'summary',
    scopeId,
    text: options.text,
    limit: options.limit,
    profileId: options.profileId,
  });

  return {
    scopeId,
    knowledge,
  };
}
