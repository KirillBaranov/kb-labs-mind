/**
 * @module @kb-labs/mind-engine/chunking/line-based
 * Line-based chunker (fallback for unsupported languages)
 */

import type { Chunk, ChunkingOptions, Chunker } from './chunker.js';
import type { SpanRange } from '@kb-labs/knowledge-contracts';

/**
 * Line-based chunker (fallback for unsupported file types)
 */
export class LineBasedChunker implements Chunker {
  readonly id = 'line-based';
  readonly extensions: string[] = []; // Matches all if no other chunker found
  readonly languages?: string[] = undefined; // Matches all if no other chunker found

  chunk(sourceCode: string, filePath: string, options: ChunkingOptions = {}): Chunk[] {
    const maxLines = options.maxLines ?? 120;
    const minLines = options.minLines ?? 40;
    const overlap = (options.overlap as number) ?? 20;

    const lines = sourceCode.split(/\r?\n/);
    const chunks: Chunk[] = [];
    let start = 0;

    while (start < lines.length) {
      const end = Math.min(lines.length, start + maxLines);
      const text = lines.slice(start, end).join('\n');
      
      if (text.trim().length > 0) {
        const span: SpanRange = {
          startLine: start + 1,
          endLine: end,
        };

        chunks.push({
          text,
          span,
          type: 'line-based',
          metadata: {
            chunkMethod: 'line-based',
            overlap: start > 0 ? overlap : 0,
          },
        });
      }

      if (end === lines.length) {
        break;
      }
      start = Math.max(0, end - overlap);
    }

    // Filter by minLines
    return chunks.filter(chunk => {
      const lines = chunk.text.split('\n').length;
      return lines >= minLines;
    });
  }
}


