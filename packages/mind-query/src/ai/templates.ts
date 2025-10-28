/**
 * AI templates for KB Labs Mind Query
 * Provides deterministic summaries and suggestions for AI mode
 */

import type { QueryName, ImpactResult, ExportsResult, DocsResult, MetaResult, ExternalsResult, ScopeResult, ChainResult } from '@kb-labs/mind-types';

export interface AITemplateResult {
  summary: string;
  suggestNextQueries: string[];
  insights?: string[];
}

/**
 * Generate AI-friendly summary and suggestions for query results
 */
export function generateAITemplate(
  queryName: QueryName,
  result: any,
  params: Record<string, any>
): AITemplateResult {
  switch (queryName) {
    case 'impact':
      return generateImpactTemplate(result as ImpactResult, params);
    case 'exports':
      return generateExportsTemplate(result as ExportsResult, params);
    case 'docs':
      return generateDocsTemplate(result as DocsResult, params);
    case 'meta':
      return generateMetaTemplate(result as MetaResult, params);
    case 'externals':
      return generateExternalsTemplate(result as ExternalsResult, params);
    case 'scope':
      return generateScopeTemplate(result as ScopeResult, params);
    case 'chain':
      return generateChainTemplate(result as ChainResult, params);
    default:
      return generateDefaultTemplate(queryName, result);
  }
}

function generateImpactTemplate(result: ImpactResult, params: Record<string, any>): AITemplateResult {
  const count = result.count || 0;
  const topImporters = result.importers?.slice(0, 3).map(imp => imp.file.split('/').pop()) || [];
  
  let summary = `Found ${count} file(s) importing this module`;
  if (topImporters.length > 0) {
    summary += `. Top importers: ${topImporters.join(', ')}`;
  }
  
  const suggestions: string[] = [];
  if (count > 0) {
    suggestions.push(`query exports ${params.file} to see what this file exports`);
    suggestions.push(`query chain ${params.file} to see full dependency chain`);
  }
  if (count > 5) {
    suggestions.push(`query scope ${params.file} to see dependency scope`);
  }
  
  const insights: string[] = [];
  if (count === 0) {insights.push('Not imported anywhere - safe to remove');}
  else if (count > 20) {insights.push('High impact file - changes affect many modules');}
  
  const entryPoints = result.importers?.filter(i => i.context === 'CLI entry point');
  if (entryPoints?.length > 0) {insights.push(`Used by ${entryPoints.length} entry points`);}
  
  return { summary, suggestNextQueries: suggestions, insights };
}

function generateExportsTemplate(result: ExportsResult, params: Record<string, any>): AITemplateResult {
  const count = result.count || 0;
  const exportNames = result.exports?.slice(0, 5).map(exp => exp.name) || [];
  
  let summary = `${count} export(s) found`;
  if (exportNames.length > 0) {
    summary += `: ${exportNames.join(', ')}`;
    if (exportNames.length < count) {
      summary += ` and ${count - exportNames.length} more`;
    }
  }
  
  const suggestions: string[] = [];
  suggestions.push(`query impact ${params.file} to see who imports this file`);
  suggestions.push(`query chain ${params.file} to see dependency chain`);
  
  return { summary, suggestNextQueries: suggestions };
}

function generateDocsTemplate(result: DocsResult, params: Record<string, any>): AITemplateResult {
  const count = result.count || 0;
  const adrCount = result.docs?.filter(doc => doc.type === 'adr').length || 0;
  const guideCount = result.docs?.filter(doc => doc.type === 'guide').length || 0;
  
  let summary = `Found ${count} documentation file(s)`;
  if (adrCount > 0 || guideCount > 0) {
    const parts = [];
    if (adrCount > 0) {parts.push(`${adrCount} ADR(s)`);}
    if (guideCount > 0) {parts.push(`${guideCount} guide(s)`);}
    summary += `: ${parts.join(', ')}`;
  }
  
  const suggestions: string[] = [];
  suggestions.push(`query meta to see project overview`);
  if (adrCount > 0) {
    suggestions.push(`query docs --type=adr to see all architecture decisions`);
  }
  if (params.type) {
    suggestions.push(`query exports <file> to see API exports`);
  }
  
  return { summary, suggestNextQueries: suggestions };
}

function generateMetaTemplate(result: MetaResult, _params: Record<string, any>): AITemplateResult {
  const productCount = result.products?.length || 0;
  const productIds = result.products?.map(p => p.id) || [];
  
  let summary = `Project contains ${productCount} product(s)`;
  if (productIds.length > 0) {
    summary += `: ${productIds.join(', ')}`;
  }
  
  const suggestions: string[] = [];
  suggestions.push(`query docs --type=adr to see architecture decisions`);
  if (productIds.length > 0) {
    suggestions.push(`query scope <product-path> to see dependencies`);
  }
  suggestions.push(`query externals to see external dependencies`);
  
  return { summary, suggestNextQueries: suggestions };
}

function generateExternalsTemplate(result: ExternalsResult, params: Record<string, any>): AITemplateResult {
  const count = result.count || 0;
  const packages = Object.keys(result.externals || {});
  const topPackages = packages.slice(0, 5);
  
  let summary = `Found ${count} external package(s)`;
  if (topPackages.length > 0) {
    summary += `: ${topPackages.join(', ')}`;
    if (topPackages.length < count) {
      summary += ` and ${count - topPackages.length} more`;
    }
  }
  
  const suggestions: string[] = [];
  suggestions.push(`query meta to see project overview`);
  suggestions.push(`query docs to see project documentation`);
  if (params.scope) {
    suggestions.push(`query scope ${params.scope} to see scope dependencies`);
  }
  
  return { summary, suggestNextQueries: suggestions };
}

function generateScopeTemplate(result: ScopeResult, _params: Record<string, any>): AITemplateResult {
  const count = result.count || 0;
  
  let summary = `Found ${count} dependency edge(s) in scope`;
  if (count > 0) {
    const uniqueFiles = new Set<string>();
    result.edges?.forEach(edge => {
      uniqueFiles.add(edge.from);
      uniqueFiles.add(edge.to);
    });
    summary += ` across ${uniqueFiles.size} file(s)`;
  }
  
  const suggestions: string[] = [];
  if (count > 0) {
    suggestions.push(`query chain <file> to see full dependency chain`);
    suggestions.push(`query impact <file> to see importers`);
  }
  suggestions.push(`query externals to see external dependencies`);
  
  return { summary, suggestNextQueries: suggestions };
}

function generateChainTemplate(result: ChainResult, params: Record<string, any>): AITemplateResult {
  const levels = result.levels?.length || 0;
  const visited = result.visited || 0;
  
  let summary = `Dependency chain with ${levels} level(s), ${visited} file(s) visited`;
  if (levels > 0) {
    const level0Files = result.levels?.[0]?.files?.length || 0;
    summary += `. Root level: ${level0Files} file(s)`;
  }
  
  const suggestions: string[] = [];
  suggestions.push(`query impact ${params.file} to see who imports this file`);
  suggestions.push(`query exports ${params.file} to see what this file exports`);
  if (levels > 3) {
    suggestions.push(`query scope <path> to see dependency scope`);
  }
  
  return { summary, suggestNextQueries: suggestions };
}

function generateDefaultTemplate(queryName: QueryName, result: any): AITemplateResult {
  const count = result.count || 0;
  
  return {
    summary: `${queryName} query returned ${count} result(s)`,
    suggestNextQueries: [
      `query meta to see project overview`,
      `query docs to see documentation`,
      `query exports <file> to see API exports`
    ]
  };
}
