/**
 * @module @kb-labs/mind-engine/chunking/markdown
 * Structure-based chunking for Markdown files
 */

import type { Chunk, ChunkingOptions, Chunker } from './chunker.js';

export interface MarkdownChunkingOptions extends ChunkingOptions {
  byHeadings?: boolean;
  includeCodeBlocks?: boolean;
}

const DEFAULT_OPTIONS: Required<MarkdownChunkingOptions> = {
  byHeadings: true,
  includeCodeBlocks: true,
  maxLines: 150,
  minLines: 30,
  preserveContext: true,
};

/**
 * Markdown Structure Chunker
 */
export class MarkdownChunker implements Chunker {
  readonly id = 'markdown-structure';
  readonly extensions = ['.md', '.mdx', '.markdown'];
  readonly languages = ['markdown', 'mdx'];

  chunk(sourceCode: string, filePath: string, options: ChunkingOptions = {}): Chunk[] {
    const opts: Required<MarkdownChunkingOptions> = {
      ...DEFAULT_OPTIONS,
      ...options,
    };
    const chunks: Chunk[] = [];

    if (opts.byHeadings) {
      const headingChunks = chunkByHeadings(sourceCode, opts);
      chunks.push(...headingChunks);
    } else {
      // Fallback to line-based chunking
      const lineChunks = chunkByLines(sourceCode, opts);
      chunks.push(...lineChunks);
    }

    // Extract code blocks as separate chunks if enabled
    if (opts.includeCodeBlocks) {
      const codeBlockChunks = extractCodeBlocks(sourceCode);
      chunks.push(...codeBlockChunks);
    }

    return chunks;
  }
}

/**
 * Legacy function for backward compatibility
 */
export function chunkMarkdown(
  sourceCode: string,
  options: MarkdownChunkingOptions = {},
): Chunk[] {
  const chunker = new MarkdownChunker();
  return chunker.chunk(sourceCode, '', options);
}

function chunkByHeadings(
  sourceCode: string,
  options: Required<MarkdownChunkingOptions>,
): Chunk[] {
  const lines = sourceCode.split('\n');
  const chunks: Chunk[] = [];
  let currentChunk: {
    startLine: number;
    level: number;
    title?: string;
    lines: string[];
  } | null = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    const headingMatch = line.match(/^(#{1,6})\s+(.+)$/);

    if (headingMatch) {
      // Save previous chunk if exists
      if (currentChunk && currentChunk.lines.length >= options.minLines) {
        chunks.push({
          text: currentChunk.lines.join('\n'),
          span: {
            startLine: currentChunk.startLine,
            endLine: currentChunk.startLine + currentChunk.lines.length - 1,
          },
          type: 'markdown-heading',
          name: currentChunk.title,
          metadata: {
            headingLevel: currentChunk.level,
            headingTitle: currentChunk.title,
          },
        });
      }

      // Start new chunk
      const level = headingMatch[1]!.length;
      const title = headingMatch[2]!.trim();
      currentChunk = {
        startLine: i + 1,
        level,
        title,
        lines: [line],
      };
    } else if (currentChunk) {
      currentChunk.lines.push(line);
    } else {
      // Content before first heading
      if (!currentChunk) {
        currentChunk = {
          startLine: i + 1,
          level: 0,
          lines: [],
        };
      }
      currentChunk.lines.push(line);
    }
  }

  // Add final chunk
  if (currentChunk && currentChunk.lines.length >= options.minLines) {
    chunks.push({
      text: currentChunk.lines.join('\n'),
      span: {
        startLine: currentChunk.startLine,
        endLine: currentChunk.startLine + currentChunk.lines.length - 1,
      },
      type: 'markdown-heading',
      name: currentChunk.title,
      metadata: {
        headingLevel: currentChunk.level,
        headingTitle: currentChunk.title,
      },
    });
  }

  // Split chunks that exceed maxLines
  const finalChunks: Chunk[] = [];
  for (const chunk of chunks) {
    if (chunk.text.split('\n').length > options.maxLines) {
      const splitChunks = splitChunkByLines(chunk, options.maxLines);
      finalChunks.push(...splitChunks);
    } else {
      finalChunks.push(chunk);
    }
  }

  return finalChunks;
}

function chunkByLines(
  sourceCode: string,
  options: Required<MarkdownChunkingOptions>,
): Chunk[] {
  const lines = sourceCode.split('\n');
  const chunks: Chunk[] = [];
  let start = 0;

  while (start < lines.length) {
    const end = Math.min(lines.length, start + options.maxLines);
    const chunkLines = lines.slice(start, end);
    const text = chunkLines.join('\n');

    if (text.trim().length >= options.minLines) {
      chunks.push({
        text,
        span: {
          startLine: start + 1,
          endLine: end,
        },
        type: 'markdown-line',
        metadata: {
          chunkMethod: 'line-based',
        },
      });
    }

    start = end;
  }

  return chunks;
}

function extractCodeBlocks(sourceCode: string): Chunk[] {
  const chunks: Chunk[] = [];
  const lines = sourceCode.split('\n');
  let inCodeBlock = false;
  let codeBlockStart = 0;
  let codeBlockLines: string[] = [];
  let language: string | undefined;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    const codeBlockStartMatch = line.match(/^```(\w+)?$/);

    if (codeBlockStartMatch) {
      if (inCodeBlock) {
        // End of code block
        if (codeBlockLines.length > 0) {
          chunks.push({
            text: codeBlockLines.join('\n'),
            span: {
              startLine: codeBlockStart + 1,
              endLine: i,
            },
            type: 'markdown-code-block',
            metadata: {
              chunkType: 'code-block',
              language,
            },
          });
        }
        codeBlockLines = [];
        inCodeBlock = false;
        language = undefined;
      } else {
        // Start of code block
        inCodeBlock = true;
        codeBlockStart = i;
        language = codeBlockStartMatch[1];
      }
    } else if (inCodeBlock) {
      codeBlockLines.push(line);
    }
  }

  // Handle unclosed code block
  if (inCodeBlock && codeBlockLines.length > 0) {
    chunks.push({
      text: codeBlockLines.join('\n'),
      span: {
        startLine: codeBlockStart + 1,
        endLine: lines.length,
      },
      type: 'markdown-code-block',
      metadata: {
        chunkType: 'code-block',
        language,
      },
    });
  }

  return chunks;
}

function splitChunkByLines(
  chunk: Chunk,
  maxLines: number,
): Chunk[] {
  const lines = chunk.text.split('\n');
  if (lines.length <= maxLines) {
    return [chunk];
  }

  const subChunks: Chunk[] = [];
  let currentStart = chunk.span.startLine;
  let currentLines: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    currentLines.push(lines[i]!);

    if (currentLines.length >= maxLines) {
      subChunks.push({
        text: currentLines.join('\n'),
        span: {
          startLine: currentStart,
          endLine: currentStart + currentLines.length - 1,
        },
        type: chunk.type,
        name: chunk.name,
        metadata: {
          ...chunk.metadata,
          isSubChunk: true,
        },
      });

      currentStart = currentStart + currentLines.length;
      currentLines = [];
    }
  }

  // Add remaining lines
  if (currentLines.length > 0) {
    subChunks.push({
      text: currentLines.join('\n'),
      span: {
        startLine: currentStart,
        endLine: currentStart + currentLines.length - 1,
      },
      type: chunk.type,
      name: chunk.name,
      metadata: {
        ...chunk.metadata,
        isSubChunk: true,
      },
    });
  }

  return subChunks;
}

