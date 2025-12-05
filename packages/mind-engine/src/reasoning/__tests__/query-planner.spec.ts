import { describe, it, expect, vi } from 'vitest';
import { QueryPlanner } from '../query-planner';
import type { MindLLMEngine } from '@kb-labs/mind-llm';

describe('QueryPlanner', () => {
  describe('planning', () => {
    it('should generate single query plan when LLM not available', async () => {
      const planner = new QueryPlanner(
        { maxSubqueries: 5 },
        null,
      );

      const plan = await planner.plan('test query', 0.8);
      expect(plan.originalQuery).toBe('test query');
      expect(plan.subqueries.length).toBe(1);
      expect(plan.subqueries[0]!.text).toBe('test query');
    });

    it('should generate multiple sub-queries when LLM available', async () => {
      const mockLLM: MindLLMEngine = {
        id: 'test',
        generate: vi.fn().mockResolvedValue({ text: '["sub-query 1", "sub-query 2", "sub-query 3"]' }),
      };

      const planner = new QueryPlanner(
        { maxSubqueries: 5 },
        mockLLM,
      );

      const plan = await planner.plan('complex query about compression', 0.8);
      expect(plan.originalQuery).toBe('complex query about compression');
      expect(plan.subqueries.length).toBeGreaterThan(1);
      expect(mockLLM.generate).toHaveBeenCalled();
    });

    it('should handle LLM errors gracefully', async () => {
      const mockLLM: MindLLMEngine = {
        id: 'test',
        generate: vi.fn().mockRejectedValue(new Error('LLM error')),
      };

      const planner = new QueryPlanner(
        { maxSubqueries: 5 },
        mockLLM,
      );

      const plan = await planner.plan('test query', 0.8);
      expect(plan.subqueries.length).toBe(1);
      expect(plan.subqueries[0]!.text).toBe('test query');
    });

    it('should limit sub-queries to maxSubqueries', async () => {
      const mockLLM: MindLLMEngine = {
        id: 'test',
        generate: vi.fn().mockResolvedValue({ text: '["q1", "q2", "q3", "q4", "q5", "q6", "q7"]' }),
      };

      const planner = new QueryPlanner(
        { maxSubqueries: 5 },
        mockLLM,
      );

      const plan = await planner.plan('test', 0.8);
      expect(plan.subqueries.length).toBeLessThanOrEqual(5);
    });
  });
});




