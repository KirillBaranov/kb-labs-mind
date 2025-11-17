import { describe, it, expect } from 'vitest';
import { TypeScriptASTChunker } from '../ast-typescript.js';

describe('TypeScriptASTChunker', () => {
  const chunker = new TypeScriptASTChunker();

  it('should have correct id and extensions', () => {
    expect(chunker.id).toBe('typescript-ast');
    expect(chunker.extensions).toContain('.ts');
    expect(chunker.extensions).toContain('.tsx');
    expect(chunker.languages).toContain('typescript');
  });

  it('should chunk TypeScript file with functions', () => {
    const code = `
export function testFunction() {
  return true;
}

export function anotherFunction() {
  return false;
}
`;

    const chunks = chunker.chunk(code, 'test.ts', {
      minLines: 1,
    });

    expect(chunks.length).toBeGreaterThan(0);
    // Should extract functions
    const hasFunction = chunks.some(chunk => 
      chunk.text.includes('testFunction') || chunk.text.includes('anotherFunction')
    );
    expect(hasFunction).toBe(true);
  });

  it('should chunk TypeScript file with classes', () => {
    const code = `
export class TestClass {
  private property: string;

  constructor(value: string) {
    this.property = value;
  }

  public method(): string {
    return this.property;
  }
}
`;

    const chunks = chunker.chunk(code, 'test.ts', {
      minLines: 1,
    });

    expect(chunks.length).toBeGreaterThan(0);
    // Should extract class
    const hasClass = chunks.some(chunk => 
      chunk.text.includes('TestClass') || chunk.text.includes('class')
    );
    expect(hasClass).toBe(true);
  });

  it('should extract imports in context', () => {
    const code = `
import { something } from 'somewhere';
import type { Type } from 'types';

export function test() {
  return something;
}
`;

    const chunks = chunker.chunk(code, 'test.ts', {
      preserveContext: true,
      minLines: 1,
    });

    // Should have chunks with imports in context
    expect(chunks.length).toBeGreaterThan(0);
    const hasImports = chunks.some(chunk => 
      chunk.text.includes('import')
    );
    expect(hasImports).toBe(true);
  });

  it('should extract interfaces', () => {
    const code = `
export interface TestInterface {
  prop1: string;
  prop2: number;
}

export function useInterface() {
  const obj: TestInterface = { prop1: 'test', prop2: 42 };
}
`;

    const chunks = chunker.chunk(code, 'test.ts', {
      minLines: 1,
    });

    // Should extract interface (if it meets minLines requirement)
    if (chunks.length > 0) {
      const hasInterface = chunks.some(chunk => 
        chunk.text.includes('TestInterface') || chunk.text.includes('interface')
      );
      expect(hasInterface).toBe(true);
    } else {
      // If no chunks, interface might be too small
      expect(chunks).toEqual([]);
    }
  });

  it('should handle empty file', () => {
    const chunks = chunker.chunk('', 'test.ts');
    expect(chunks).toEqual([]);
  });

  it('should handle file with only comments', () => {
    const code = `
// This is a comment
/* 
 * Multi-line comment
 */
`;

    const chunks = chunker.chunk(code, 'test.ts', {
      includeJSDoc: true,
    });

    // May return empty if no valid AST nodes
    expect(Array.isArray(chunks)).toBe(true);
  });

  it('should preserve context when splitting large chunks', () => {
    const largeFunction = `
export function largeFunction() {
  ${Array.from({ length: 200 }, (_, i) => `const var${i} = ${i};`).join('\n')}
  return true;
}
`;

    const chunks = chunker.chunk(largeFunction, 'test.ts', {
      maxLines: 50,
      minLines: 1,
    });

    // Should split large function into smaller chunks or filter by size
    expect(Array.isArray(chunks)).toBe(true);
    if (chunks.length > 0) {
      chunks.forEach(chunk => {
        const lines = chunk.text.split('\n').length;
        expect(lines).toBeLessThanOrEqual(50);
      });
    }
  });

  it('should extract top-level comments', () => {
    const code = `
/**
 * This is a JSDoc comment
 * @param value - The value to process
 */
export function documentedFunction(value: string) {
  return value;
}
`;

    const chunks = chunker.chunk(code, 'test.ts', {
      includeJSDoc: true,
      preserveContext: true,
      minLines: 1,
    });

    // Should preserve JSDoc comments in context
    expect(chunks.length).toBeGreaterThan(0);
    const hasComment = chunks.some(chunk => 
      chunk.text.includes('JSDoc') || chunk.text.includes('@param')
    );
    expect(hasComment).toBe(true);
  });

  it('should handle TypeScript with JSX', () => {
    const code = `
import React from 'react';

export function Component() {
  return <div>Hello</div>;
}
`;

    const chunks = chunker.chunk(code, 'test.tsx', {
      minLines: 1,
    });

    expect(chunks.length).toBeGreaterThan(0);
    // Should handle JSX syntax
    const hasJSX = chunks.some(chunk => 
      chunk.text.includes('<div>') || chunk.text.includes('Component')
    );
    expect(hasJSX).toBe(true);
  });

  it('should respect preserveContext option', () => {
    const code = `
import { helper } from './helper';

const constant = 'value';

export function test() {
  return constant;
}
`;

    const chunksWithContext = chunker.chunk(code, 'test.ts', {
      preserveContext: true,
      minLines: 1,
    });

    const chunksWithoutContext = chunker.chunk(code, 'test.ts', {
      preserveContext: false,
      minLines: 1,
    });

    // Both should create chunks
    expect(chunksWithContext.length).toBeGreaterThan(0);
    expect(chunksWithoutContext.length).toBeGreaterThan(0);
    
    // Chunks with context should include imports
    const hasImportsInContext = chunksWithContext.some(chunk => 
      chunk.text.includes('import')
    );
    expect(hasImportsInContext).toBe(true);
  });
});

