/**
 * Documentation indexer for KB Labs Mind
 */

import { promises as fsp } from 'node:fs';
import { join, basename, extname } from 'node:path';
import type { DocsIndex, DocEntry } from '@kb-labs/mind-types';
import type { IndexerContext } from '../types/index.js';
import { getGenerator, toPosix } from '@kb-labs/mind-core';

export async function indexDocs(ctx: IndexerContext): Promise<void> {
  try {
    const docs: DocEntry[] = [];
    
    // Scan docs/ and adr/
    const scanDirs = ['docs', 'docs/adr', 'adr'];
    
    for (const dir of scanDirs) {
      const fullPath = join(ctx.cwd, dir);
      try {
        await scanMarkdownFiles(fullPath, ctx.root, docs);
      } catch {
        // Directory doesn't exist
      }
    }
    
    // Sort docs deterministically by path
    docs.sort((a, b) => a.path.localeCompare(b.path));
    
    const docsIndex: DocsIndex = {
      schemaVersion: '1.0',
      generator: getGenerator(),
      docs,
      count: docs.length,
      generatedAt: new Date().toISOString()
    };
    
    const indexPath = join(ctx.cwd, '.kb', 'mind', 'docs-index.json');
    await fsp.writeFile(indexPath, JSON.stringify(docsIndex, null, 2));
    
    ctx.log({ level: 'info', msg: `Indexed ${docs.length} documentation files` });
  } catch (error: any) {
    ctx.log({ level: 'warn', msg: 'Failed to index docs', error: error.message });
  }
}

async function scanMarkdownFiles(dir: string, root: string, docs: DocEntry[]): Promise<void> {
  const entries = await fsp.readdir(dir, { withFileTypes: true });
  
  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    
    if (entry.isDirectory()) {
      await scanMarkdownFiles(fullPath, root, docs);
    } else if (entry.isFile() && entry.name.endsWith('.md')) {
      const content = await fsp.readFile(fullPath, 'utf8');
      const doc = extractDocMetadata(content, fullPath, root);
      if (doc) {docs.push(doc);}
    }
  }
}

function extractDocMetadata(content: string, fullPath: string, root: string): DocEntry | null {
  // Extract title (first # heading)
  const titleMatch = content.match(/^#\s+(.+)$/m);
  const title = titleMatch ? titleMatch[1] : 'Untitled';
  
  // Extract summary (first 150 words)
  const textOnly = content
    .replace(/^#.+$/gm, '')
    .replace(/```[\s\S]*?```/g, '')
    .replace(/`[^`]+`/g, '')
    .trim();
  const words = textOnly.split(/\s+/).slice(0, 150);
  const summary = words.join(' ') + (words.length >= 150 ? '...' : '');
  
  // Detect type
  let type: "adr" | "readme" | "guide" | "api" = 'guide';
  if (fullPath.includes('/adr/') || fullPath.includes('ADR')) {type = 'adr';}
  else if (fullPath.toLowerCase().includes('readme')) {type = 'readme';}
  else if (fullPath.toLowerCase().includes('api')) {type = 'api';}
  
  // Extract tags (from keywords or frontmatter if exists)
  const tags: string[] = [];
  const tagMatch = content.match(/(?:tags|keywords):\s*\[([^\]]+)\]/i);
  if (tagMatch && tagMatch[1]) {
    tags.push(...tagMatch[1].split(',').map(t => t.trim()));
  }
  
  // Relative path from root
  const relativePath = toPosix(fullPath.replace(root + '/', ''));
  
  return {
    title: title || basename(fullPath, extname(fullPath)),
    path: relativePath,
    tags,
    summary,
    type
  };
}
