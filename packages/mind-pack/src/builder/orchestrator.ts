/**
 * Pack orchestrator for KB Labs Mind Pack
 */

import { buildIntentSection } from '../sections/intent.js';
import { buildOverviewSection } from '../sections/overview.js';
import { buildApiSection } from '../sections/api.js';
import { buildDiffsSection } from '../sections/diffs.js';
import { buildSnippetsSection } from '../sections/snippets.js';
import { buildConfigsSection } from '../sections/configs.js';
import { getBundleInfo } from '../bundle/integration.js';
import { generateMarkdown } from '../formatter/markdown.js';
import { createContextPackJson } from '../formatter/json.js';
import type { PackContext } from '../types/index.js';
import type { MindIndex, ApiIndex, DepsGraph, RecentDiff } from '@kb-labs/mind-core';

/**
 * Orchestrate the pack building process
 */
export async function orchestratePackBuilding(
  context: PackContext,
  index: MindIndex,
  apiIndex: ApiIndex,
  depsGraph: DepsGraph,
  recentDiff: RecentDiff
): Promise<{ json: any; markdown: string; tokensEstimate: number }> {
  // Build sections
  const sections: Record<string, string> = {};
  const sectionUsage: Record<string, number> = {};
  let totalTokens = 0;

  // Intent summary
  const intentResult = await buildIntentSection(context, context.budget.caps.intent_summary || 300);
  sections.intent_summary = intentResult.content;
  sectionUsage.intent_summary = intentResult.tokensUsed;
  totalTokens += intentResult.tokensUsed;

  // Product overview
  const overviewResult = await buildOverviewSection(context, index, context.budget.caps.product_overview || 600);
  sections.product_overview = overviewResult.content;
  sectionUsage.product_overview = overviewResult.tokensUsed;
  totalTokens += overviewResult.tokensUsed;

  // API signatures
  const apiResult = await buildApiSection(context, apiIndex, context.budget.caps.api_signatures || 2200);
  sections.api_signatures = apiResult.content;
  sectionUsage.api_signatures = apiResult.tokensUsed;
  totalTokens += apiResult.tokensUsed;

  // Recent diffs
  const diffsResult = await buildDiffsSection(context, recentDiff, context.budget.caps.recent_diffs || 1200);
  sections.recent_diffs = diffsResult.content;
  sectionUsage.recent_diffs = diffsResult.tokensUsed;
  totalTokens += diffsResult.tokensUsed;

  // Implementation snippets
  const snippetsResult = await buildSnippetsSection(context, apiIndex, context.budget.caps.impl_snippets || 3000);
  sections.impl_snippets = snippetsResult.content;
  sectionUsage.impl_snippets = snippetsResult.tokensUsed;
  totalTokens += snippetsResult.tokensUsed;

  // Configs and profiles
  const configsResult = await buildConfigsSection(context, context.budget.caps.configs_profiles || 700);
  sections.configs_profiles = configsResult.content;
  sectionUsage.configs_profiles = configsResult.tokensUsed;
  totalTokens += configsResult.tokensUsed;

  // Optional bundle integration
  if (context.withBundle && context.product) {
    const bundleInfo = await getBundleInfo(context.product);
    if (bundleInfo) {
      sections.configs_profiles += '\n\n' + bundleInfo;
    }
  }

  // Create JSON pack
  const json = createContextPackJson(
    context.intent,
    context.product,
    context.budget,
    sections,
    sectionUsage,
    context.seed
  );

  // Generate Markdown
  const markdown = generateMarkdown(sections);

  return {
    json,
    markdown,
    tokensEstimate: totalTokens
  };
}
