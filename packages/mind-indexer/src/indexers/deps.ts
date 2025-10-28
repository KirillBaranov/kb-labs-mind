/**
 * Dependencies indexer for KB Labs Mind
 */

import { promises as fsp } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { realpath } from 'node:fs/promises';
import * as ts from 'typescript';
import type { DepsGraph as _DepsGraph, PackageNode } from '@kb-labs/mind-types';
import type { IndexerContext } from '../types';
import { toPosix } from '@kb-labs/mind-core';
import { writeJson } from '../fs/json.js';

/**
 * Compute edge priority for AI token economy
 */
function computeEdgePriority(edge: { from: string; to: string; type: string; imports?: string[] }): string {
  if (edge.type === 'type' && (!edge.imports || edge.imports.length === 0)) {return 'noise';}
  if (edge.imports && edge.imports.length >= 5) {return 'important';}
  if (edge.from.includes('/src/index.') || edge.from.includes('/bin.')) {return 'critical';}
  return 'normal';
}

/**
 * Compute graph summary for AI insights
 */
function computeGraphSummary(edges: any[], packages: Record<string, any>): any {
  const fileConnections = new Map<string, { in: number; out: number }>();
  const externalDepsSet = new Set<string>();
  
  for (const edge of edges) {
    const from = fileConnections.get(edge.from) || { in: 0, out: 0 };
    const to = fileConnections.get(edge.to) || { in: 0, out: 0 };
    from.out++;
    to.in++;
    fileConnections.set(edge.from, from);
    fileConnections.set(edge.to, to);
  }
  
  const hotspots = Array.from(fileConnections.entries())
    .filter(([_, conn]) => conn.in + conn.out >= 10)
    .sort((a, b) => (b[1].in + b[1].out) - (a[1].in + a[1].out))
    .slice(0, 10)
    .map(([file, conn]) => ({ file, inbound: conn.in, outbound: conn.out }));
  
  for (const pkg of Object.values(packages)) {
    for (const dep of pkg.deps || []) {
      if (!dep.startsWith('@kb-labs/')) {externalDepsSet.add(dep);}
    }
  }
  
  const packageGraph: Record<string, string[]> = {};
  for (const [name, pkg] of Object.entries(packages)) {
    packageGraph[name] = (pkg.deps || []).filter((d: string) => packages[d]);
  }
  
  return {
    totalEdges: edges.length,
    internalEdges: edges.filter(e => !e.to.includes('node_modules')).length,
    externalDeps: Array.from(externalDepsSet).slice(0, 20),
    hotspots,
    maxDepth: 0,
    packageGraph
  };
}

/**
 * Index package dependencies
 */
export async function indexDependencies(
  ctx: IndexerContext
): Promise<{ edgesAdded: number; edgesRemoved: number }> {
  let edgesAdded = 0;
  let edgesRemoved = 0;

  try {
    // Read tsconfig.json if exists
    const tsconfigPath = join(ctx.cwd, 'tsconfig.json');
    let compilerOptions: ts.CompilerOptions = {};
    let baseUrl: string | undefined;
    let paths: Record<string, string[]> = {};

    try {
      const tsconfigContent = await fsp.readFile(tsconfigPath, 'utf8');
      const tsconfig = JSON.parse(tsconfigContent);
      compilerOptions = tsconfig.compilerOptions || {};
      baseUrl = compilerOptions.baseUrl;
      paths = compilerOptions.paths || {};
    } catch {
      // No tsconfig.json, use defaults
    }

    // Find all TypeScript/JavaScript files recursively
    const allFiles: string[] = [];
    
    // Scan root directory
    await findTsFiles(ctx.cwd, allFiles);
    
    // Also scan workspace packages
    const packageJsonPath = join(ctx.cwd, 'package.json');
    try {
      const packageJson = JSON.parse(await fsp.readFile(packageJsonPath, 'utf8'));
      if (packageJson.workspaces) {
        const workspaces = Array.isArray(packageJson.workspaces) 
          ? packageJson.workspaces 
          : packageJson.workspaces.packages || [];
        
        for (const pattern of workspaces) {
          const packagesDir = pattern.replace('/*', '');
          const packagesPath = join(ctx.cwd, packagesDir);
          
          try {
            const entries = await fsp.readdir(packagesPath, { withFileTypes: true });
            for (const entry of entries) {
              if (entry.isDirectory()) {
                const pkgPath = join(packagesPath, entry.name);
                // Scan TypeScript files in this package
                await findTsFiles(pkgPath, allFiles);
                
                // Also add package info
                const pkgJsonPath = join(pkgPath, 'package.json');
                try {
                  const pkgJson = JSON.parse(await fsp.readFile(pkgJsonPath, 'utf8'));
                  ctx.depsGraph.packages[pkgJson.name || entry.name] = {
                    name: pkgJson.name || entry.name,
                    version: pkgJson.version,
                    private: pkgJson.private || false,
                    dir: join(packagesDir, entry.name),
                    deps: Object.keys(pkgJson.dependencies || {})
                  };
                } catch {
                  // Skip packages without package.json
                }
              }
            }
          } catch {
            // Skip if workspace directory doesn't exist
          }
        }
      }
    } catch {
      // Not a monorepo, only root directory scanned
    }

    // Remove duplicates and sort
    const uniqueFiles = [...new Set(allFiles)].sort();

    // Process files in batches to respect time budget
    const batchSize = 50;
    const edges: Array<{ from: string; to: string; type: 'runtime' | 'type'; imports?: string[] }> = [];

    for (let i = 0; i < uniqueFiles.length; i += batchSize) {
      // Check time budget
      if (Date.now() - ctx.startTime >= ctx.timeBudgetMs) {
        ctx.log({
          level: 'warn',
          code: 'MIND_TIME_BUDGET',
          msg: 'Time budget exceeded during dependency indexing',
          filesProcessed: i,
          totalFiles: uniqueFiles.length
        });
        break;
      }

      const batch = uniqueFiles.slice(i, i + batchSize);
      await processBatch(batch, ctx, compilerOptions, baseUrl, paths, edges);
    }

    // Normalize paths and filter to workspace
    const normalizedEdges = [];
    for (const edge of edges) {
      try {
        const fromReal = await realpath(edge.from);
        const toReal = await realpath(edge.to);
        
        // Convert to POSIX paths relative to workspace
        const fromPosix = toPosix(fromReal.replace(ctx.root + '/', ''));
        const toPosixPath = toPosix(toReal.replace(ctx.root + '/', ''));
        
        // Only include edges within workspace
        if (fromPosix && toPosixPath && 
            !fromPosix.includes('node_modules') && 
            !toPosixPath.includes('node_modules')) {
          normalizedEdges.push({
            from: fromPosix,
            to: toPosixPath,
            type: edge.type,
            imports: edge.imports,
            priority: computeEdgePriority(edge),
            weight: 1
          });
        }
      } catch (_error) {
        // Skip invalid paths
        ctx.log({
          level: 'warn',
          code: 'MIND_PARSE_ERROR',
          msg: `Failed to normalize path: ${edge.from} -> ${edge.to}`,
          error: _error instanceof Error ? _error.message : String(_error)
        });
      }
    }

    // Sort edges deterministically by (from, to, type)
    normalizedEdges.sort((a, b) => {
      if (a.from !== b.from) {return a.from.localeCompare(b.from);}
      if (a.to !== b.to) {return a.to.localeCompare(b.to);}
      return a.type.localeCompare(b.type);
    });

    // Sort imports arrays alphabetically for deterministic output
    normalizedEdges.forEach(edge => {
      if (edge.imports) {
        edge.imports.sort();
      }
    });

    // Update deps graph
    edgesAdded = normalizedEdges.length;
    edgesRemoved = 0; // For now, we don't track removals

    // Update the context's deps graph
    ctx.depsGraph.edges = normalizedEdges as any;

    // Compute graph summary
    const summary = computeGraphSummary(normalizedEdges, ctx.depsGraph.packages);
    ctx.depsGraph.summary = summary;

    // Update packages info (already scanned above)
    try {
      const packageJson = JSON.parse(await fsp.readFile(packageJsonPath, 'utf8'));
      const packageNode: PackageNode = {
        name: packageJson.name || 'unknown',
        version: packageJson.version,
        private: packageJson.private || false,
        dir: '.',
        deps: Object.keys(packageJson.dependencies || {})
      };
      ctx.depsGraph.packages[packageNode.name] = packageNode;
    } catch (error: any) {
      ctx.log({
        level: 'warn',
        code: 'MIND_PARSE_ERROR',
        msg: 'Failed to parse package.json',
        error: error.message
      });
    }

    // Save deps graph to disk
    await writeJson(`${ctx.cwd}/.kb/mind/deps.json`, ctx.depsGraph);

  } catch (error: any) {
    ctx.log({
      level: 'error',
      code: 'MIND_PARSE_ERROR',
      msg: 'Failed to index dependencies',
      error: error.message
    });
  }

  return { edgesAdded, edgesRemoved };
}

/**
 * Recursively find TypeScript/JavaScript files
 */
async function findTsFiles(dir: string, files: string[]): Promise<void> {
  try {
    const entries = await fsp.readdir(dir, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = join(dir, entry.name);
      
      // Skip excluded directories
      if (entry.isDirectory()) {
        if (entry.name === 'node_modules' || 
            entry.name === '.git' || 
            entry.name === '.kb' ||
            entry.name === 'dist' ||
            entry.name === 'coverage' ||
            entry.name === 'fixtures' ||
            entry.name === '__tests__') {
          continue;
        }
        await findTsFiles(fullPath, files);
      } else if (entry.isFile()) {
        // Check if it's a TypeScript/JavaScript file
        if (entry.name.match(/\.(ts|tsx|js|jsx)$/) && 
            !entry.name.endsWith('.d.ts') && 
            !entry.name.endsWith('.map')) {
          files.push(fullPath);
        }
      }
    }
  } catch {
    // Skip directories we can't read
  }
}

/**
 * Process a batch of files
 */
async function processBatch(
  files: string[],
  ctx: IndexerContext,
  compilerOptions: ts.CompilerOptions,
  baseUrl: string | undefined,
  paths: Record<string, string[]>,
  edges: Array<{ from: string; to: string; type: 'runtime' | 'type'; imports?: string[] }>
): Promise<void> {
  try {
    // Create TypeScript program for this batch
    const program = ts.createProgram(files, {
      ...compilerOptions,
      allowJs: true,
      checkJs: false,
      noEmit: true,
      skipLibCheck: true
    });

    const sourceFiles = program.getSourceFiles();

    for (const sourceFile of sourceFiles) {
      try {
        await processSourceFile(sourceFile, ctx, compilerOptions, baseUrl, paths, edges);
      } catch (error: any) {
        ctx.log({
          level: 'warn',
          code: 'MIND_PARSE_ERROR',
          msg: `Failed to process file: ${sourceFile.fileName}`,
          error: error.message
        });
      }
    }
  } catch (error: any) {
    ctx.log({
      level: 'warn',
      code: 'MIND_PARSE_ERROR',
      msg: 'Failed to create TypeScript program for batch',
      error: error.message
    });
  }
}

/**
 * Extract imported symbol names from TypeScript node
 */
function extractImportedNames(node: ts.Node): string[] {
  const names: string[] = [];
  
  if (ts.isImportDeclaration(node)) {
    const clause = node.importClause;
    if (!clause) {return names;}
    
    // Default import: import Foo from '...'
    if (clause.name) {
      names.push(clause.name.text);
    }
    
    // Named imports: import { a, b } from '...'
    if (clause.namedBindings) {
      if (ts.isNamedImports(clause.namedBindings)) {
        clause.namedBindings.elements.forEach(el => {
          names.push(el.name.text);
        });
      }
      // Namespace import: import * as X from '...'
      else if (ts.isNamespaceImport(clause.namedBindings)) {
        names.push(clause.namedBindings.name.text);
      }
    }
  }
  
  return names;
}

/**
 * Process a single source file
 */
async function processSourceFile(
  sourceFile: ts.SourceFile,
  ctx: IndexerContext,
  compilerOptions: ts.CompilerOptions,
  baseUrl: string | undefined,
  paths: Record<string, string[]>,
  edges: Array<{ from: string; to: string; type: 'runtime' | 'type'; imports?: string[] }>
): Promise<void> {
  const fileName = sourceFile.fileName;

  const visit = async (node: ts.Node) => {
    // Import declarations
    if (ts.isImportDeclaration(node) && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) {
      const moduleSpecifier = node.moduleSpecifier.text;
      const resolved = await resolveModule(fileName, moduleSpecifier, compilerOptions, baseUrl, paths);
      if (resolved) {
        const imports = extractImportedNames(node);
        edges.push({
          from: fileName,
          to: resolved,
          type: 'runtime',
          imports
        });
      }
    }

    // Export declarations with 'from'
    if (ts.isExportDeclaration(node) && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) {
      const moduleSpecifier = node.moduleSpecifier.text;
      const resolved = await resolveModule(fileName, moduleSpecifier, compilerOptions, baseUrl, paths);
      if (resolved) {
        const imports = extractImportedNames(node);
        edges.push({
          from: fileName,
          to: resolved,
          type: 'runtime',
          imports
        });
      }
    }

    // Dynamic imports
    if (ts.isCallExpression(node) && 
        node.expression.kind === ts.SyntaxKind.ImportKeyword &&
        node.arguments.length > 0 &&
        node.arguments[0] &&
        ts.isStringLiteral(node.arguments[0])) {
      const moduleSpecifier = node.arguments[0].text;
      const resolved = await resolveModule(fileName, moduleSpecifier, compilerOptions, baseUrl, paths);
      if (resolved) {
        edges.push({
          from: fileName,
          to: resolved,
          type: 'runtime',
          imports: [] // Dynamic imports don't have named imports
        });
      }
    }

    ts.forEachChild(node, visit);
  };

  await visit(sourceFile);
}

/**
 * Resolve module path using TypeScript resolution
 */
async function resolveModule(
  fromFile: string,
  moduleSpecifier: string,
  _compilerOptions: ts.CompilerOptions,
  _baseUrl: string | undefined,
  _paths: Record<string, string[]>
): Promise<string | null> {
  try {
    // Skip external modules
    if (moduleSpecifier.startsWith('node_modules') || 
        (!moduleSpecifier.startsWith('.') && !moduleSpecifier.startsWith('/'))) {
      return null;
    }

    const fromDir = dirname(fromFile);
    let resolvedPath: string;

    // Handle relative imports
    if (moduleSpecifier.startsWith('.')) {
      resolvedPath = resolve(fromDir, moduleSpecifier);
    } else {
      // Handle absolute imports
      resolvedPath = resolve(fromDir, moduleSpecifier);
    }

    // Try to resolve with extensions
    const extensions = ['.ts', '.tsx', '.js', '.jsx'];
    for (const ext of extensions) {
      const withExt = resolvedPath + ext;
      try {
        await fsp.access(withExt);
        return withExt;
      } catch {
        // File doesn't exist
      }
    }

    // Try index files
    for (const ext of extensions) {
      const indexPath = join(resolvedPath, 'index' + ext);
      try {
        await fsp.access(indexPath);
        return indexPath;
      } catch {
        // File doesn't exist
      }
    }

    return resolvedPath;
  } catch {
    return null;
  }
}
