/**
 * @module @kb-labs/mind-engine/chunking/ast-typescript
 * AST-based chunking for TypeScript/JavaScript files
 */

import * as ts from 'typescript';
import type { Chunk, ChunkingOptions, Chunker } from './chunker.js';

export interface TypeScriptChunkingOptions extends ChunkingOptions {
  preserveContext?: boolean;
  includeJSDoc?: boolean;
}

const DEFAULT_OPTIONS: Required<TypeScriptChunkingOptions> = {
  preserveContext: true,
  includeJSDoc: true,
  maxLines: 200,
  minLines: 20,
};

/**
 * TypeScript/JavaScript AST Chunker
 */
export class TypeScriptASTChunker implements Chunker {
  readonly id = 'typescript-ast';
  readonly extensions = ['.ts', '.tsx', '.js', '.jsx', '.mts', '.cts', '.mjs', '.cjs'];
  readonly languages = ['typescript', 'javascript', 'tsx', 'jsx'];

  chunk(sourceCode: string, filePath: string, options: ChunkingOptions = {}): Chunk[] {
    const opts: Required<TypeScriptChunkingOptions> = {
      ...DEFAULT_OPTIONS,
      ...options,
    };
    const chunks: Chunk[] = [];

    try {
      const sourceFile = ts.createSourceFile(
        filePath,
        sourceCode,
        ts.ScriptTarget.Latest,
        true,
      );

      // Extract imports and top-level comments for context
      const imports = extractImports(sourceFile);
      const topLevelComments = opts.includeJSDoc
        ? extractTopLevelComments(sourceFile)
        : '';

      // Visit AST nodes
      ts.forEachChild(sourceFile, node => {
        const chunk = extractNodeChunk(node, sourceFile, sourceCode, opts);
        if (chunk) {
          // Add context (imports, comments) if preserveContext is enabled
          if (opts.preserveContext && (imports || topLevelComments)) {
            chunk.text = [imports, topLevelComments, chunk.text]
              .filter(Boolean)
              .join('\n\n');
          }

          // Filter by size constraints
          const lines = chunk.text.split('\n').length;
          if (lines >= opts.minLines && lines <= opts.maxLines) {
            chunks.push(chunk);
          } else if (lines > opts.maxLines) {
            // Split large chunks by lines
            const lineChunks = splitLargeChunk(chunk, opts.maxLines);
            chunks.push(...lineChunks);
          }
        }
      });

      return chunks;
    } catch (error) {
      // If AST parsing fails, return empty array (fallback to line-based chunking)
      return [];
    }
  }
}

/**
 * Legacy function for backward compatibility
 */
export function chunkTypeScriptAST(
  sourceCode: string,
  filePath: string,
  options: TypeScriptChunkingOptions = {},
): Chunk[] {
  const chunker = new TypeScriptASTChunker();
  return chunker.chunk(sourceCode, filePath, options);
}

function extractNodeChunk(
  node: ts.Node,
  sourceFile: ts.SourceFile,
  sourceCode: string,
  options: Required<TypeScriptChunkingOptions>,
): Chunk | null {
  const start = node.getStart(sourceFile);
  const end = node.getEnd();
  const text = sourceCode.slice(start, end);

  if (!text.trim()) {
    return null;
  }

  const startLine = sourceFile.getLineAndCharacterOfPosition(start).line + 1;
  const endLine = sourceFile.getLineAndCharacterOfPosition(end).line + 1;

  let type: string;
  let name: string | undefined;

  if (ts.isFunctionDeclaration(node) || ts.isFunctionExpression(node) || ts.isArrowFunction(node)) {
    type = 'function';
    name = ts.isFunctionDeclaration(node) || ts.isFunctionExpression(node)
      ? node.name?.getText(sourceFile)
      : undefined;
  } else if (ts.isClassDeclaration(node)) {
    type = 'class';
    name = node.name?.getText(sourceFile);
  } else if (ts.isInterfaceDeclaration(node)) {
    type = 'interface';
    name = node.name.getText(sourceFile);
  } else if (ts.isTypeAliasDeclaration(node)) {
    type = 'type';
    name = node.name.getText(sourceFile);
  } else if (ts.isEnumDeclaration(node)) {
    type = 'enum';
    name = node.name.getText(sourceFile);
  } else if (ts.isModuleDeclaration(node)) {
    type = 'module';
    name = node.name.getText(sourceFile);
  } else {
    // Skip other node types
    return null;
  }

  // Extract JSDoc comments if enabled
  let jsDocText = '';
  if (options.includeJSDoc) {
    const jsDoc = ts.getJSDocCommentsAndTags(node);
    if (jsDoc.length > 0) {
      jsDocText = jsDoc
        .map(doc => {
          const docStart = doc.getStart(sourceFile);
          const docEnd = doc.getEnd();
          return sourceCode.slice(docStart, docEnd);
        })
        .join('\n');
    }
  }

  const chunkText = jsDocText ? `${jsDocText}\n\n${text}` : text;

  const metadata: Record<string, unknown> = {
    nodeType: ts.SyntaxKind[node.kind],
  };
  
  // Add function/class/type name to metadata for better context
  if (name) {
    if (type === 'function') {
      metadata.functionName = name;
    } else if (type === 'class') {
      metadata.className = name;
    } else if (type === 'interface' || type === 'type' || type === 'enum' || type === 'module') {
      metadata.typeName = name;
    }
  }
  
  return {
    text: chunkText,
    span: {
      startLine,
      endLine,
    },
    type,
    name,
    metadata,
  };
}

function extractImports(sourceFile: ts.SourceFile): string {
  const imports: string[] = [];
  ts.forEachChild(sourceFile, node => {
    if (ts.isImportDeclaration(node)) {
      const importText = node.getFullText(sourceFile).trim();
      if (importText) {
        imports.push(importText);
      }
    }
  });
  return imports.join('\n');
}

function extractTopLevelComments(sourceFile: ts.SourceFile): string {
  const comments: string[] = [];
  const sourceText = sourceFile.getFullText();
  const commentRanges = ts.getLeadingCommentRanges(sourceText, 0) ?? [];

  for (const range of commentRanges) {
    const comment = sourceText.slice(range.pos, range.end);
    if (comment.includes('@') || comment.includes('*')) {
      // JSDoc-style comment
      comments.push(comment);
    }
  }

  return comments.join('\n\n');
}

function splitLargeChunk(
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
      const currentEnd = currentStart + currentLines.length - 1;
      subChunks.push({
        text: currentLines.join('\n'),
        span: {
          startLine: currentStart,
          endLine: currentEnd,
        },
        type: chunk.type,
        name: chunk.name,
        metadata: {
          ...chunk.metadata,
          isSubChunk: true,
          originalStart: chunk.span.startLine,
          originalEnd: chunk.span.endLine,
        },
      });

      currentStart = currentEnd + 1;
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
        originalStart: chunk.span.startLine,
        originalEnd: chunk.span.endLine,
      },
    });
  }

  return subChunks;
}

