# @kb-labs/mind-query

KB Labs Mind Query is a library for querying the KB Labs Mind index.

## Vision & Purpose

**@kb-labs/mind-query** provides AI-oriented query interface for KB Labs Mind. It includes query execution, index loading, query cache, and various query types (impact, scope, exports, externals, chain, meta, docs).

### Core Goals

- **Query Execution**: Execute queries against Mind index
- **Index Loading**: Load Mind indexes from disk
- **Query Cache**: Cache query results for performance
- **Query Types**: Support for various query types

## Package Status

- **Version**: 0.1.0
- **Stage**: Stable
- **Status**: Production Ready ✅

## Architecture

### High-Level Overview

```
Mind Query
    │
    ├──► Query Execution
    ├──► Index Loading
    ├──► Query Cache
    └──► Query Types
```

### Key Components

1. **API** (`api/`): Query execution API
2. **Loader** (`loader/`): Index loader
3. **Cache** (`cache/`): Query cache
4. **Queries** (`queries/`): Query implementations (impact, scope, exports, externals, chain, meta, docs)
5. **AI** (`ai/`): AI integration
6. **Errors** (`errors/`): Error handling

## ✨ Features

- **Query Execution**: Execute queries against Mind index
- **Index Loading**: Load Mind indexes from disk
- **Query Cache**: Cache query results for performance
- **Query Types**: Support for impact, scope, exports, externals, chain, meta, docs queries
- **AI Integration**: AI-friendly query results

## 📦 API Reference

### Main Exports

#### Query Execution

- `executeQuery`: Execute query against Mind index

#### Index Loading

- `loadIndexes`: Load Mind indexes from disk
- `createPathRegistry`: Create path registry from indexes

#### Query Cache

- `QueryCache`: Query cache implementation

#### Query Types

- `impact`: Impact query
- `scope`: Scope query
- `exports`: Exports query
- `externals`: Externals query
- `chain`: Chain query
- `meta`: Meta query
- `docs`: Docs query

## 🔧 Configuration

### Configuration Options

All configuration via function parameters.

## 🔗 Dependencies

### Runtime Dependencies

- `@kb-labs/mind-core` (`link:../mind-core`): Mind core
- `@kb-labs/mind-indexer` (`link:../mind-indexer`): Mind indexer
- `@kb-labs/mind-types` (`link:../mind-types`): Mind types

### Development Dependencies

- `@kb-labs/devkit` (`link:../../../kb-labs-devkit`): DevKit presets
- `@types/node` (`^20`): Node.js types
- `tsup` (`^8`): TypeScript bundler
- `typescript` (`^5`): TypeScript compiler
- `vitest` (`^3`): Test runner

## 🧪 Testing

### Test Structure

```
src/__tests__/
└── (2 test files)
```

### Test Coverage

- **Current Coverage**: ~75%
- **Target Coverage**: 90%

## 📈 Performance

### Performance Characteristics

- **Time Complexity**: O(n) for query execution, O(1) for cache operations
- **Space Complexity**: O(n) where n = index size
- **Bottlenecks**: Large index querying

## 🔒 Security

### Security Considerations

- **Path Validation**: Path validation for file operations
- **Query Validation**: Query parameter validation

### Known Vulnerabilities

- None

## 🐛 Known Issues & Limitations

### Known Issues

- None currently

### Limitations

- **Query Types**: Fixed query types
- **Index Size**: Performance degrades with very large indexes

### Future Improvements

- **More Query Types**: Additional query types
- **Performance**: Optimize for large indexes

## 🔄 Migration & Breaking Changes

### Migration from Previous Versions

No breaking changes in current version (0.1.0).

### Breaking Changes in Future Versions

- None planned

## 📚 Examples

### Example 1: Execute Query

```typescript
import { executeQuery } from '@kb-labs/mind-query';

const result = await executeQuery({
  query: 'impact',
  params: { symbol: 'MyFunction' },
  cwd: process.cwd(),
});
```

### Example 2: Load Indexes

```typescript
import { loadIndexes } from '@kb-labs/mind-query';

const indexes = await loadIndexes({
  cwd: process.cwd(),
});
```

### Example 3: Use Query Cache

```typescript
import { QueryCache } from '@kb-labs/mind-query';

const cache = new QueryCache();
const cached = cache.get('query-id');
if (!cached) {
  const result = await executeQuery(...);
  cache.set('query-id', result);
}
```

## 🤝 Contributing

See [CONTRIBUTING.md](../../CONTRIBUTING.md) for development guidelines.

## 📄 License

MIT © KB Labs
