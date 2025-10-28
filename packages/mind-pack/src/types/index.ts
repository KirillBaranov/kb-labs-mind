/**
 * Types for KB Labs Mind Pack
 */

import type { ContextBudget, ContextPreset, ContextPackJson, ContextSection } from "@kb-labs/mind-types";

export interface PackOptions {
  cwd: string;
  intent: string;
  product?: string;                 // 'devlink' | 'aiReview' | ...
  preset?: ContextPreset;           // weights
  budget: ContextBudget;            // caps + truncation
  withBundle?: boolean;             // if true, try spawn "kb bundle print --product <id> --json"
  seed?: number;                    // random seed for deterministic output
  log?: (e: object) => void;
}

export interface PackResult {
  json: ContextPackJson;
  markdown: string;
  tokensEstimate: number;
}

export interface SectionBuilder {
  buildSection(
    context: PackContext,
    budget: number,
    truncation: "start"|"middle"|"end"
  ): Promise<{ content: string; tokensUsed: number }>;
}

export interface PackContext {
  cwd: string;
  product?: string;
  intent: string;
  budget: ContextBudget;
  preset?: ContextPreset;
  withBundle?: boolean;
  seed?: number;                    // random seed for deterministic output
  log: (e: object) => void;
}
