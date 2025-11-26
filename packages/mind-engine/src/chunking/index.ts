/**
 * @module @kb-labs/mind-engine/chunking
 * Chunking system with adaptive strategy selection
 */

export type { Chunk, ChunkingOptions, Chunker } from './chunker.js';
export { ChunkerRegistry, globalChunkerRegistry } from './chunker.js';

// Export chunkers
// REMOVED: TypeScriptASTChunker (uses 8.7MB TypeScript compiler, redundant with tree-sitter)
// export { TypeScriptASTChunker, chunkTypeScriptAST } from './ast-typescript.js';
export { MarkdownChunker, chunkMarkdown } from './markdown.js';
export { LineBasedChunker } from './line-based.js';

// Export tree-sitter chunkers
export { TypeScriptTreeSitterChunker, chunkTypeScriptTreeSitter } from './tree-sitter-typescript.js';
export { JavaScriptTreeSitterChunker, chunkJavaScriptTreeSitter } from './tree-sitter-javascript.js';
export { CSharpTreeSitterChunker, chunkCSharpTreeSitter } from './tree-sitter-csharp.js';
export { PythonTreeSitterChunker, chunkPythonTreeSitter } from './tree-sitter-python.js';
export { GoTreeSitterChunker, chunkGoTreeSitter } from './tree-sitter-go.js';
export { RustTreeSitterChunker, chunkRustTreeSitter } from './tree-sitter-rust.js';

// Register default chunkers
import { MarkdownChunker } from './markdown.js';
import { LineBasedChunker } from './line-based.js';
import { globalChunkerRegistry, type Chunker } from './chunker.js';

// Tree-sitter chunkers (registered by AdaptiveChunkerFactory, also available globally)
import { TypeScriptTreeSitterChunker } from './tree-sitter-typescript.js';
import { JavaScriptTreeSitterChunker } from './tree-sitter-javascript.js';
import { CSharpTreeSitterChunker } from './tree-sitter-csharp.js';
import { PythonTreeSitterChunker } from './tree-sitter-python.js';
import { GoTreeSitterChunker } from './tree-sitter-go.js';
import { RustTreeSitterChunker } from './tree-sitter-rust.js';

// Register built-in chunkers
globalChunkerRegistry.register(new MarkdownChunker());
globalChunkerRegistry.register(new LineBasedChunker());

// Register tree-sitter chunkers
globalChunkerRegistry.register(new TypeScriptTreeSitterChunker());
globalChunkerRegistry.register(new JavaScriptTreeSitterChunker());
globalChunkerRegistry.register(new CSharpTreeSitterChunker());
globalChunkerRegistry.register(new PythonTreeSitterChunker());
globalChunkerRegistry.register(new GoTreeSitterChunker());
globalChunkerRegistry.register(new RustTreeSitterChunker());

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

