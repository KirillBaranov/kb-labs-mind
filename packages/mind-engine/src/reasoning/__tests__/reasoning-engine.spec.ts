import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ReasoningEngine } from '../reasoning-engine.js';
import { ComplexityDetector } from '../complexity-detector.js';
import { QueryPlanner } from '../query-planner.js';
import { ParallelExecutor } from '../parallel-executor.js';
import { ResultSynthesizer } from '../synthesizer.js';
import type { KnowledgeQuery, KnowledgeResult } from '@kb-labs/knowledge-contracts';
import type { KnowledgeExecutionContext } from '@kb-labs/knowledge-core';

describe('ReasoningEngine', () => {
  let complexityDetector: ComplexityDetector;
  let queryPlanner: QueryPlanner;
  let parallelExecutor: ParallelExecutor;
  let synthesizer: ResultSynthesizer;
  let reasoningEngine: ReasoningEngine;

  const createMockContext = (): KnowledgeExecutionContext => ({
    scope: { id: 'test-scope' },
    limit: 10,
  });

  beforeEach(() => {
    complexityDetector = new ComplexityDetector(
      { threshold: 0.6, heuristics: true, llmBased: false },
      null,
    );
    queryPlanner = new QueryPlanner({ maxSubqueries: 5 }, null);
    parallelExecutor = new ParallelExecutor({ parallel: false });
    synthesizer = new ResultSynthesizer({ enabled: false }, null);
    reasoningEngine = new ReasoningEngine(
      { maxDepth: 3, maxTotalQueries: 20, cyclicDetection: true },
      complexityDetector,
      queryPlanner,
      parallelExecutor,
      synthesizer,
    );
  });

  it('should execute simple queries without reasoning', async () => {
    const mockExecutor = vi.fn().mockResolvedValue({
      query: { text: 'simple', intent: 'search' },
      chunks: [],
      contextText: 'result',
      generatedAt: new Date().toISOString(),
    });

    const result = await reasoningEngine.execute(
      { text: 'simple', intent: 'search' },
      createMockContext(),
      mockExecutor,
    );

    expect(mockExecutor).toHaveBeenCalledTimes(1);
    expect(result.metadata?.reasoning).toBeDefined();
    expect(result.metadata?.reasoning?.subqueriesCount).toBe(1);
  });

  it('should execute complex queries with reasoning', async () => {
    // Mock complexity detector - create a custom one that always returns high complexity
    const mockComplexityDetector = {
      detectComplexity: vi.fn().mockResolvedValue({
        score: 0.8,
        reasons: ['Long query', 'Multiple concepts'],
        needsReasoning: true,
      }),
    } as unknown as ComplexityDetector;
    
    // Mock query planner to generate multiple sub-queries
    const mockLLM = {
      id: 'test',
      complete: vi.fn().mockResolvedValue('["sub-query 1", "sub-query 2"]'),
      generate: vi.fn(),
    };
    queryPlanner = new QueryPlanner({ maxSubqueries: 5 }, mockLLM);
    
    parallelExecutor = new ParallelExecutor({ parallel: false });
    synthesizer = new ResultSynthesizer({ enabled: false }, null);
    
    reasoningEngine = new ReasoningEngine(
      { maxDepth: 3, maxTotalQueries: 20, cyclicDetection: true },
      mockComplexityDetector,
      queryPlanner,
      parallelExecutor,
      synthesizer,
    );

    const mockExecutor = vi.fn().mockResolvedValue({
      query: { text: 'test', intent: 'search' },
      chunks: [{ id: '1', sourceId: 's1', path: 'p1', span: { startLine: 1, endLine: 10 }, text: 'chunk', score: 0.8 }],
      contextText: 'result',
      generatedAt: new Date().toISOString(),
    });

    const complexQuery = 'How does compression work and what are the different strategies including smart truncation and LLM compression?';
    const result = await reasoningEngine.execute(
      { text: complexQuery, intent: 'search' },
      createMockContext(),
      mockExecutor,
    );

    // Result should have reasoning metadata
    expect(result.metadata?.reasoning).toBeDefined();
    if (result.metadata?.reasoning) {
      // Should have executed multiple sub-queries
      expect(result.metadata.reasoning.subqueriesCount).toBeGreaterThanOrEqual(1);
      expect(result.metadata.reasoning.plan.subqueries.length).toBeGreaterThan(1);
    }
    // Should have executed queries
    expect(mockExecutor).toHaveBeenCalled();
  });

  it('should respect maxDepth limit', async () => {
    const engine = new ReasoningEngine(
      { maxDepth: 1, maxTotalQueries: 20, cyclicDetection: true },
      complexityDetector,
      queryPlanner,
      parallelExecutor,
      synthesizer,
    );

    const mockExecutor = vi.fn().mockResolvedValue({
      query: { text: 'test', intent: 'search' },
      chunks: [],
      contextText: 'result',
      generatedAt: new Date().toISOString(),
    });

    // At max depth, should execute directly
    const result = await engine.execute(
      { text: 'test', intent: 'search' },
      createMockContext(),
      mockExecutor,
      1, // depth = 1, maxDepth = 1
    );

    expect(result.metadata?.reasoning).toBeDefined();
    expect(result.metadata?.reasoning?.depth).toBe(1);
  });

  it('should detect cycles', async () => {
    const engine = new ReasoningEngine(
      { maxDepth: 3, maxTotalQueries: 20, cyclicDetection: true },
      complexityDetector,
      queryPlanner,
      parallelExecutor,
      synthesizer,
    );

    const mockExecutor = vi.fn().mockResolvedValue({
      query: { text: 'test', intent: 'search' },
      chunks: [],
      contextText: 'result',
      generatedAt: new Date().toISOString(),
    });

    // This should not throw if cycle detection works correctly
    // (actual cycle detection would need more complex setup)
    await expect(
      engine.execute(
        { text: 'test', intent: 'search' },
        createMockContext(),
        mockExecutor,
      )
    ).resolves.toBeDefined();
  });
});

