/**
 * @module @kb-labs/mind-engine/chunking
 * Chunking system with adaptive strategy selection
 */

export type { Chunk, ChunkingOptions, Chunker } from './chunker.js';
export { ChunkerRegistry, globalChunkerRegistry } from './chunker.js';

// Export chunkers
export { TypeScriptASTChunker, chunkTypeScriptAST } from './ast-typescript.js';
export { MarkdownChunker, chunkMarkdown } from './markdown.js';
export { LineBasedChunker } from './line-based.js';

// Register default chunkers
import { TypeScriptASTChunker } from './ast-typescript.js';
import { MarkdownChunker } from './markdown.js';
import { LineBasedChunker } from './line-based.js';
import { globalChunkerRegistry, type Chunker } from './chunker.js';

// Register built-in chunkers
globalChunkerRegistry.register(new TypeScriptASTChunker());
globalChunkerRegistry.register(new MarkdownChunker());
globalChunkerRegistry.register(new LineBasedChunker());

/**
 * Get appropriate chunker for file
 * Returns line-based chunker as fallback if no specific chunker found
 */
export function getChunkerForFile(
  filePath: string,
  language?: string,
): Chunker {
  const chunker = globalChunkerRegistry.find(filePath, language);
  return chunker ?? new LineBasedChunker();
}

