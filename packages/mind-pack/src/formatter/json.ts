/**
 * JSON formatter for KB Labs Mind Pack
 */

import type { ContextPackJson } from '@kb-labs/mind-types';
import { getGenerator } from '@kb-labs/mind-core';

/**
 * Create ContextPackJson with sorted keys and section usage
 */
export function createContextPackJson(
  intent: string,
  product: string | undefined,
  budget: any,
  sections: Record<string, string>,
  sectionUsage: Record<string, number>,
  seed?: number
): ContextPackJson {
  return {
    schemaVersion: "1.0",
    generator: getGenerator(),
    intent,
    product,
    budgetApplied: budget,
    sections,
    tokensEstimate: Object.values(sectionUsage).reduce((sum, tokens) => sum + tokens, 0),
    sectionUsage,
    seed,
    deterministic: true
  };
}
