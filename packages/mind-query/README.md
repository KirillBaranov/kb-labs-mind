# KB Labs Mind Query

AI-oriented query interface for KB Labs Mind. Provides structured, queryable access to indexed codebase data with minimal JSON responses optimized for AI consumption.

## Features

- **7 Query Types**: `impact`, `scope`, `exports`, `externals`, `chain`, `meta`, `docs`
- **AI Mode**: Summaries, suggestions, path compression for LLM consumption
- **Smart Caching**: Hash-based auto-invalidation with configurable TTL
- **Token Optimization**: 80-95% smaller payloads vs full context
- **Deterministic Output**: Stable JSON structure, zero noise

## Usage

### CLI

```bash
# Find files importing a module
kb mind query impact packages/core/src/index.ts

# Get project metadata
kb mind query meta --product=mind

# Query documentation
kb mind query docs --type=adr

# AI-optimized mode with summaries
kb mind query exports file.ts --ai-mode
```

### Programmatic API

```typescript
import { executeQuery } from '@kb-labs/mind-query';

const result = await executeQuery('impact', { file: 'src/index.ts' }, {
  cwd: process.cwd(),
  aiMode: true,
  limit: 100
});

console.log(result.summary); // AI-friendly summary
console.log(result.suggestNextQueries); // Query suggestions
```

## Query Types

| Query | Description | Parameters |
|-------|-------------|------------|
| `impact` | Find files importing a module | `file: string` |
| `scope` | Get dependencies within scope | `path: string, depth?: number` |
| `exports` | List exports from a file | `file: string` |
| `externals` | Find external dependencies | `scope?: string` |
| `chain` | Dependency chain traversal | `file: string, depth?: number` |
| `meta` | Project/product metadata | `product?: string` |
| `docs` | Documentation and ADRs | `tag?, type?, search?` |

## AI Mode

When `--ai-mode` is enabled:

- **Path Compression**: Uses stable IDs instead of full paths
- **Summaries**: Human-readable result descriptions
- **Suggestions**: Next query recommendations
- **Token Optimization**: Reduced payload size

## Architecture

```
┌──────────────────────────────────────────────────────┐
│              KB Labs Mind Query                      │
├──────────────────────────────────────────────────────┤
│  Query Layer    │ executeQuery() + 7 query types     │
│  Cache Layer    │ QueryCache + hash validation      │
│  Loader Layer   │ IndexLoader + path registry       │
│  CLI Layer      │ mind:query command integration     │
└──────────────────────────────────────────────────────┘
```

## Development

```bash
# Build
pnpm build

# Test
pnpm test

# Dev mode
pnpm dev
```

## Integration

The query system integrates with:

- **KB Labs CLI**: `kb mind query` command
- **AI Assistants**: JSON output for LLM consumption
- **Developer Tools**: Programmatic API access
- **CI/CD**: Automated code analysis

## Performance

- **Query Latency**: < 50ms (cached < 20ms)
- **Cache Hit Ratio**: > 80%
- **Payload Size**: ≤ 10KB (≤ 5KB in AI mode)
- **Token Reduction**: 90% vs full context
