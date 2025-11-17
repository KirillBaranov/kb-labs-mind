# Compression for Token Optimization in Mind v2

This document describes the compression system in Mind v2, designed to optimize token usage in search results without losing meaning.

## Overview

The compression system includes several techniques to reduce the number of tokens in the context passed to LLMs:

1. **Smart Truncation** - Intelligent truncation that preserves code structure
2. **Metadata-Only Mode** - Show only metadata for low-relevance chunks
3. **Incremental Context Building** - Build context with token budget awareness
4. **LLM Compression** - Compression using LLM (placeholder for future implementation)

## Configuration

Compression is configured in `kb.config.json` in the `knowledge.engines[].options.search.optimization.compression` section:

```json
{
  "knowledge": {
    "engines": [
      {
        "id": "mind-auto",
        "type": "mind",
        "options": {
          "search": {
            "optimization": {
              "compression": {
                "enabled": true,
                "cache": "memory",
                "smartTruncation": {
                  "enabled": true,
                  "maxLength": 2000,
                  "preserveStructure": true
                },
                "metadataOnly": {
                  "enabled": true,
                  "scoreThreshold": 0.4
                },
                "llm": {
                  "enabled": false
                }
              }
            }
          }
        }
      }
    ]
  }
}
```

### Configuration Parameters

#### `enabled`
- **Type:** `boolean`
- **Default:** `false`
- **Description:** Enables/disables all compression features

#### `cache`
- **Type:** `'memory' | 'qdrant' | 'both'`
- **Default:** `'memory'`
- **Description:** Caching strategy for compressed chunks
  - `'memory'` - in-memory cache for the duration of a query (implemented)
  - `'qdrant'` - persistent storage in Qdrant (reserved for future)
  - `'both'` - use both methods (reserved for future)

#### `smartTruncation`
- **Type:** object
- **Description:** Smart truncation settings
  - `enabled` - enable/disable (default: `true` if compression is enabled)
  - `maxLength` - maximum chunk length in characters (default: `2000`)
  - `preserveStructure` - preserve code structure (function signatures, types) (default: `true`)

#### `metadataOnly`
- **Type:** object
- **Description:** Metadata-only mode settings
  - `enabled` - enable/disable (default: `true` if compression is enabled)
  - `scoreThreshold` - score threshold below which chunks are shown as metadata-only (default: `0.4`)

#### `llm`
- **Type:** object
- **Description:** LLM compression settings (placeholder for future implementation)
  - `enabled` - enable/disable (default: `false`)
  - `model` - LLM model for compression (optional)
  - `maxTokens` - maximum number of tokens for compressed output (optional)

## Compression Techniques

### 1. Smart Truncation

Intelligent truncation of chunks while preserving important code parts.

**How it works:**
- If chunk is smaller than `maxLength`, return as-is
- If chunk is larger than `maxLength`:
  - Preserve first 30% of lines
  - Extract important parts (function signatures, types, exports)
  - Preserve last 30% of lines
  - Insert marker `// ...` between sections

**Important parts are identified by keywords:**
- `export`, `function`, `class`, `interface`, `type`
- `const`, `let`, `var`, `enum`, `namespace`

**Example:**

Before compression (3000 characters):
```typescript
export class MyClass {
  private field1: string;
  private field2: number;
  
  constructor(field1: string, field2: number) {
    this.field1 = field1;
    this.field2 = field2;
  }
  
  method1() {
    // ... lots of code ...
  }
  
  method2() {
    // ... lots of code ...
  }
}
```

After compression (2000 characters):
```typescript
export class MyClass {
  private field1: string;
  private field2: number;
  
  constructor(field1: string, field2: number) {
    this.field1 = field1;
    this.field2 = field2;
  }
  
  // ... important parts ...
  method1() {
    // ... lots of code ...
  }
  
  method2() {
    // ... lots of code ...
  }
}
```

### 2. Metadata-Only Mode

For chunks with low scores, show only metadata instead of full content.

**How it works:**
- If `score < scoreThreshold`, chunk is formatted as metadata-only
- Format: `[metadata-only] path/to/file.ts` with function/class/type information
- Extract brief description from comments if available

**Example:**

Normal format:
```
File: src/utils.ts
Lines: 10-50
Function: helperFunction

export function helperFunction() {
  // ... full code ...
}
```

Metadata-only format (for score < 0.4):
```
[metadata-only] src/utils.ts
  function:helperFunction
  Lines: 10-50
```

### 3. Incremental Context Building

Build context with token budget awareness, applying more aggressive compression to later chunks.

**How it works:**
- Chunks are added one by one, counting tokens
- Uses approximate calculation: ~4 characters = 1 token
- When token budget is reached, compression is applied to remaining chunks
- If compression doesn't help, addition stops

**Integration:**
- Works together with `adaptiveSelection` in `context-optimizer`
- Uses `tokenBudget` from query context (if provided)

### 4. LLM Compression (Placeholder)

Placeholder for future LLM-based compression implementation.

**Current implementation:**
- `NullLLMCompressor` simply returns original text
- Interface is ready for future implementation

**Planned functionality:**
- Use LLM to compress chunks while preserving meaning
- Extract key information from long chunks
- Generate concise descriptions of complex code

## Metrics

The system logs compression metrics for each query:

```json
{
  "totalChunks": 10,
  "metadataOnlyChunks": 3,
  "tokensBeforeCompression": 5000,
  "tokensAfterCompression": 3500,
  "tokensSaved": 1500,
  "compressionRate": "30.0%"
}
```

**Where to find metrics:**
- In runtime logs when `compression.enabled = true`
- Log level: `info`
- Message: `"Compression metrics"`

## Expected Token Savings

- **Base level (no compression):** 0% savings
- **With Smart Truncation:** 20-30% savings
- **With Metadata-Only Mode:** additional 10-20% savings
- **Combined effect:** 30-50% token savings

**Influencing factors:**
- Chunk size (larger chunks → more savings)
- Score distribution (more low-score chunks → more savings)
- Code structure (more structured code → Smart Truncation works better)

## Choosing scoreThreshold

The `metadataOnly.scoreThreshold` threshold depends on your index and chunker quality:

- **High index quality (good chunker, accurate embeddings):**
  - `scoreThreshold: 0.3` - more aggressive compression
  - Suitable for projects with high-quality indexing

- **Medium index quality:**
  - `scoreThreshold: 0.4` - balance between savings and quality (default)
  - Suitable for most projects

- **Low index quality:**
  - `scoreThreshold: 0.5-0.6` - more conservative compression
  - Suitable for projects with unstable scores

**Recommendation:**
- Start with `0.4` (default)
- Check compression metrics
- If too many important chunks fall into metadata-only → increase threshold
- If token savings are insufficient → decrease threshold

## Roadmap

### Implemented
- ✅ Smart Truncation with Context Preservation
- ✅ Metadata-Only Mode with configurable threshold
- ✅ Incremental Context Building with token budget
- ✅ In-memory cache for compressed chunks
- ✅ Metrics and logging

### Planned
- 🔲 LLM Compression with real implementation
- 🔲 Qdrant cache for compressed chunks
- 🔲 Adaptive scoreThreshold based on feedback
- 🔲 Improved extraction of important code parts
- 🔲 Support for different programming languages

## Usage Examples

### Minimal Configuration
```json
{
  "compression": {
    "enabled": true
  }
}
```
All sub-options will use default values.

### Aggressive Compression
```json
{
  "compression": {
    "enabled": true,
    "smartTruncation": {
      "maxLength": 1500
    },
    "metadataOnly": {
      "scoreThreshold": 0.3
    }
  }
}
```

### Conservative Compression
```json
{
  "compression": {
    "enabled": true,
    "smartTruncation": {
      "maxLength": 3000,
      "preserveStructure": true
    },
    "metadataOnly": {
      "scoreThreshold": 0.5
    }
  }
}
```

## Troubleshooting

### Compression Not Working
- Check that `compression.enabled = true`
- Check logs for errors
- Ensure chunks have scores (for metadata-only mode)

### Too Aggressive Compression
- Increase `scoreThreshold` for metadata-only mode
- Increase `maxLength` for smart truncation
- Disable `metadataOnly.enabled` if needed

### Insufficient Token Savings
- Decrease `scoreThreshold` for metadata-only mode
- Decrease `maxLength` for smart truncation
- Check compression metrics in logs
