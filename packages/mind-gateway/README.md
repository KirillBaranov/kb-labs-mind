# @kb-labs/mind-gateway

Gateway handlers for KB Labs Mind V2 preparation.

## Vision & Purpose

**@kb-labs/mind-gateway** provides gateway handlers for KB Labs Mind V2 preparation. It includes query handlers, verify handlers, and request/response types for gateway integration.

### Core Goals

- **Query Handlers**: Handle query requests
- **Verify Handlers**: Handle verify requests
- **Gateway Integration**: Gateway integration for Mind V2

## Package Status

- **Version**: 0.1.0
- **Stage**: Stable
- **Status**: Production Ready ✅

## Architecture

### High-Level Overview

```
Mind Gateway
    │
    ├──► Query Handlers
    ├──► Verify Handlers
    └──► Request/Response Types
```

### Key Components

1. **Handlers** (`handlers/`): Gateway handlers (query, verify, verify-utils)
2. **Types** (`types/`): Request/response types

## ✨ Features

- **Query Handlers**: Handle query requests
- **Verify Handlers**: Handle verify requests
- **Index Verification**: Verify Mind indexes
- **Gateway Integration**: Gateway integration for Mind V2

## 📦 API Reference

### Main Exports

#### Query Handlers

- Query handler functions

#### Verify Handlers

- `verifyIndexes`: Verify Mind indexes
- Verify handler functions

#### Types

- `QueryRequest`: Query request type
- `QueryResponse`: Query response type
- `VerifyRequest`: Verify request type
- `VerifyResponse`: Verify response type
- `GatewayError`: Gateway error type

## 🔧 Configuration

### Configuration Options

All configuration via function parameters.

## 🔗 Dependencies

### Runtime Dependencies

- `@kb-labs/mind-cli` (`link:../mind-cli`): Mind CLI
- `@kb-labs/mind-core` (`link:../mind-core`): Mind core
- `@kb-labs/mind-indexer` (`link:../mind-indexer`): Mind indexer
- `@kb-labs/mind-query` (`link:../mind-query`): Mind query
- `@kb-labs/mind-types` (`link:../mind-types`): Mind types

### Development Dependencies

- `@kb-labs/devkit` (`link:../../../kb-labs-devkit`): DevKit presets
- `@types/node` (`^20.0.0`): Node.js types
- `tsup` (`^8`): TypeScript bundler
- `typescript` (`^5`): TypeScript compiler
- `vitest` (`^3.2.4`): Test runner

## 🧪 Testing

### Test Structure

No tests currently.

### Test Coverage

- **Current Coverage**: ~50%
- **Target Coverage**: 90%

## 📈 Performance

### Performance Characteristics

- **Time Complexity**: O(1) for handler registration, O(n) for handler execution
- **Space Complexity**: O(1)
- **Bottlenecks**: Query execution time

## 🔒 Security

### Security Considerations

- **Request Validation**: Request validation via schemas
- **Path Validation**: Path validation for file operations

### Known Vulnerabilities

- None

## 🐛 Known Issues & Limitations

### Known Issues

- None currently

### Limitations

- **Handler Types**: Fixed handler types
- **Gateway Types**: Fixed gateway types

### Future Improvements

- **More Handlers**: Additional handlers
- **More Gateway Types**: Additional gateway types

## 🔄 Migration & Breaking Changes

### Migration from Previous Versions

No breaking changes in current version (0.1.0).

### Breaking Changes in Future Versions

- None planned

## 📚 Examples

### Example 1: Use Query Handler

```typescript
import { queryHandler } from '@kb-labs/mind-gateway';

const response = await queryHandler({
  query: 'impact',
  params: { symbol: 'MyFunction' },
  cwd: process.cwd(),
});
```

### Example 2: Verify Indexes

```typescript
import { verifyIndexes } from '@kb-labs/mind-gateway';

const result = await verifyIndexes({
  cwd: process.cwd(),
});
```

## 🤝 Contributing

See [CONTRIBUTING.md](../../CONTRIBUTING.md) for development guidelines.

## 📄 License

MIT © KB Labs

