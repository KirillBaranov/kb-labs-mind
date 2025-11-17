import { describe, it, expect } from 'vitest';
import { LineBasedChunker } from '../line-based.js';

describe('LineBasedChunker', () => {
  const chunker = new LineBasedChunker();

  it('should have correct id and extensions', () => {
    expect(chunker.id).toBe('line-based');
    expect(chunker.extensions).toEqual([]);
  });

  it('should chunk simple text into lines', () => {
    const text = 'line 1\nline 2\nline 3\nline 4\nline 5';
    const chunks = chunker.chunk(text, 'test.txt', { maxLines: 2 });

    expect(chunks.length).toBeGreaterThan(0);
    expect(chunks[0].text).toContain('line 1');
    expect(chunks[0].span.startLine).toBe(1);
    expect(chunks[0].type).toBe('line-based');
  });

  it('should respect maxLines option', () => {
    const lines = Array.from({ length: 200 }, (_, i) => `line ${i + 1}`).join('\n');
    const chunks = chunker.chunk(lines, 'test.txt', { maxLines: 50 });

    expect(chunks.length).toBeGreaterThan(0);
    chunks.forEach(chunk => {
      const chunkLines = chunk.text.split('\n').length;
      expect(chunkLines).toBeLessThanOrEqual(50);
    });
  });

  it('should respect minLines option', () => {
    const text = 'line 1\nline 2\nline 3';
    const chunks = chunker.chunk(text, 'test.txt', { maxLines: 2, minLines: 2 });

    // All chunks should have at least minLines
    chunks.forEach(chunk => {
      const chunkLines = chunk.text.split('\n').length;
      expect(chunkLines).toBeGreaterThanOrEqual(2);
    });
  });

  it('should handle empty text', () => {
    const chunks = chunker.chunk('', 'test.txt');
    expect(chunks).toEqual([]);
  });

  it('should handle whitespace-only text', () => {
    const chunks = chunker.chunk('   \n\n   ', 'test.txt');
    expect(chunks).toEqual([]);
  });

  it('should create overlapping chunks', () => {
    const lines = Array.from({ length: 100 }, (_, i) => `line ${i + 1}`).join('\n');
    const chunks = chunker.chunk(lines, 'test.txt', { maxLines: 30, overlap: 10 });

    if (chunks.length > 1) {
      // Check that chunks overlap
      const firstEnd = chunks[0].span.endLine;
      const secondStart = chunks[1].span.startLine;
      expect(secondStart).toBeLessThan(firstEnd);
    }
  });

  it('should set correct span ranges', () => {
    const text = 'line 1\nline 2\nline 3\nline 4\nline 5';
    const chunks = chunker.chunk(text, 'test.txt', { maxLines: 2 });

    expect(chunks.length).toBeGreaterThan(0);
    chunks.forEach(chunk => {
      expect(chunk.span.startLine).toBeGreaterThan(0);
      expect(chunk.span.endLine).toBeGreaterThanOrEqual(chunk.span.startLine);
    });
  });
});


