/**
 * Build context pack API
 */

import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { 
  DEFAULT_BUDGET, 
  DEFAULT_PRESET, 
  getGenerator, 
  estimateTokens,
  truncateToTokens 
} from '@kb-labs/mind-core';
import { orchestratePackBuilding } from '../builder/orchestrator.js';
import type { PackOptions, PackResult } from '../types/index.js';
import type { MindIndex, ApiIndex, DepsGraph, RecentDiff, ContextPackJson } from '@kb-labs/mind-core';

/**
 * Build context pack from Mind indexes
 */
export async function buildPack(opts: PackOptions): Promise<PackResult> {
  const { 
    cwd, 
    intent, 
    product, 
    preset = DEFAULT_PRESET, 
    budget = DEFAULT_BUDGET, 
    withBundle = false, 
    log 
  } = opts;

  const context = {
    cwd,
    product,
    intent,
    budget,
    preset,
    withBundle,
    log: log || (() => {})
  };

  try {
    // Load Mind indexes
    const [index, apiIndex, depsGraph, recentDiff] = await Promise.all([
      loadIndex(cwd, 'index.json') as Promise<MindIndex>,
      loadIndex(cwd, 'api-index.json') as Promise<ApiIndex>,
      loadIndex(cwd, 'deps.json') as Promise<DepsGraph>,
      loadIndex(cwd, 'recent-diff.json') as Promise<RecentDiff>
    ]);

    if (!index || !apiIndex || !depsGraph || !recentDiff || 
        !index.schemaVersion || !apiIndex.schemaVersion || !depsGraph.schemaVersion || !recentDiff.schemaVersion) {
      throw new Error('Mind indexes not found. Run "kb mind init" first.');
    }

    // Use orchestrator for pack building
    const result = await orchestratePackBuilding(context, index, apiIndex, depsGraph, recentDiff);

    return {
      json: result.json,
      markdown: result.markdown,
      tokensEstimate: result.tokensEstimate
    };
  } catch (error: any) {
    context.log({ level: 'error', msg: 'Failed to build pack', error: error.message });
    throw error;
  }
}

/**
 * Load Mind index file
 */
async function loadIndex<T>(cwd: string, filename: string): Promise<T | null> {
  try {
    const content = await readFile(join(cwd, '.kb', 'mind', filename), 'utf8');
    return JSON.parse(content) as T;
  } catch {
    return null;
  }
}

/**
 * Build intent summary section
 */
async function buildIntentSection(
  context: any, 
  maxTokens: number
): Promise<{ content: string; tokensUsed: number }> {
  const content = `# Intent: ${context.intent}\n\nThis context pack provides information to help implement: ${context.intent}`;
  const tokensUsed = estimateTokens(content);
  
  if (tokensUsed > maxTokens) {
    const truncated = truncateToTokens(content, maxTokens, context.budget.truncation);
    return { content: truncated, tokensUsed: estimateTokens(truncated) };
  }
  
  return { content, tokensUsed };
}

/**
 * Build product overview section
 */
async function buildOverviewSection(
  context: any, 
  index: MindIndex, 
  maxTokens: number
): Promise<{ content: string; tokensUsed: number }> {
  const product = context.product || 'unknown';
  const filesCount = index.filesIndexed || 0;
  
  const content = `# Product Overview: ${product}\n\nFiles indexed: ${filesCount}\nLast updated: ${index.updatedAt}`;
  const tokensUsed = estimateTokens(content);
  
  if (tokensUsed > maxTokens) {
    const truncated = truncateToTokens(content, maxTokens, context.budget.truncation);
    return { content: truncated, tokensUsed: estimateTokens(truncated) };
  }
  
  return { content, tokensUsed };
}

/**
 * Build API signatures section
 */
async function buildApiSection(
  context: any, 
  apiIndex: ApiIndex, 
  maxTokens: number
): Promise<{ content: string; tokensUsed: number }> {
  const files = Object.entries(apiIndex.files);
  let content = '# API Signatures\n\n';
  
  for (const [filePath, file] of files.slice(0, 10)) { // Limit to 10 files
    content += `## ${filePath}\n`;
    for (const export_ of file.exports.slice(0, 5)) { // Limit to 5 exports per file
      content += `- ${export_.name} (${export_.kind})`;
      if (export_.signature) {
        content += `: ${export_.signature}`;
      }
      content += '\n';
    }
    content += '\n';
  }
  
  const tokensUsed = estimateTokens(content);
  
  if (tokensUsed > maxTokens) {
    const truncated = truncateToTokens(content, maxTokens, context.budget.truncation);
    return { content: truncated, tokensUsed: estimateTokens(truncated) };
  }
  
  return { content, tokensUsed };
}

/**
 * Build recent diffs section
 */
async function buildDiffsSection(
  context: any, 
  recentDiff: RecentDiff, 
  maxTokens: number
): Promise<{ content: string; tokensUsed: number }> {
  let content = '# Recent Changes\n\n';
  
  if (recentDiff.files.length === 0) {
    content += 'No recent changes detected.\n';
  } else {
    content += `Since: ${recentDiff.since}\n\n`;
    for (const file of recentDiff.files.slice(0, 20)) { // Limit to 20 files
      content += `- ${file.status} ${file.path}\n`;
    }
  }
  
  const tokensUsed = estimateTokens(content);
  
  if (tokensUsed > maxTokens) {
    const truncated = truncateToTokens(content, maxTokens, context.budget.truncation);
    return { content: truncated, tokensUsed: estimateTokens(truncated) };
  }
  
  return { content, tokensUsed };
}

/**
 * Build implementation snippets section
 */
async function buildSnippetsSection(
  context: any, 
  apiIndex: ApiIndex, 
  maxTokens: number
): Promise<{ content: string; tokensUsed: number }> {
  let content = '# Implementation Snippets\n\n';
  
  const files = Object.entries(apiIndex.files);
  for (const [filePath, file] of files.slice(0, 5)) { // Limit to 5 files
    content += `## ${filePath}\n`;
    content += `Size: ${file.size} bytes\n`;
    content += `Exports: ${file.exports.length}\n\n`;
    
    // Add some sample exports
    for (const export_ of file.exports.slice(0, 3)) {
      content += `### ${export_.name}\n`;
      if (export_.jsdoc) {
        content += `${export_.jsdoc}\n\n`;
      }
    }
    content += '\n';
  }
  
  const tokensUsed = estimateTokens(content);
  
  if (tokensUsed > maxTokens) {
    const truncated = truncateToTokens(content, maxTokens, context.budget.truncation);
    return { content: truncated, tokensUsed: estimateTokens(truncated) };
  }
  
  return { content, tokensUsed };
}

/**
 * Build configs and profiles section
 */
async function buildConfigsSection(
  context: any, 
  maxTokens: number
): Promise<{ content: string; tokensUsed: number }> {
  const content = '# Configuration\n\nNo configuration files found in this context.';
  const tokensUsed = estimateTokens(content);
  
  if (tokensUsed > maxTokens) {
    const truncated = truncateToTokens(content, maxTokens, context.budget.truncation);
    return { content: truncated, tokensUsed: estimateTokens(truncated) };
  }
  
  return { content, tokensUsed };
}

/**
 * Generate Markdown from sections
 */
function generateMarkdown(sections: Record<string, string>): string {
  const order = [
    'intent_summary',
    'product_overview', 
    'api_signatures',
    'recent_diffs',
    'impl_snippets',
    'configs_profiles'
  ];
  
  let markdown = '';
  for (const section of order) {
    if (sections[section]) {
      markdown += sections[section] + '\n\n';
    }
  }
  
  return markdown.trim();
}
