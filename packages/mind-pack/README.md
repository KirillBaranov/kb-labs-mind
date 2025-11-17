# @kb-labs/mind-pack

Context pack builder for KB Labs Mind.

## Vision & Purpose

**@kb-labs/mind-pack** provides context pack builder for KB Labs Mind. It includes pack building, section builders, formatters, and bundle integration.

### Core Goals

- **Pack Building**: Build context packs from Mind indexes
- **Section Builders**: Build context sections (intent, API, diffs, snippets, etc.)
- **Formatting**: Format packs as JSON and Markdown
- **Bundle Integration**: Integrate with bundle system

## Package Status

- **Version**: 0.1.0
- **Stage**: Stable
- **Status**: Production Ready ✅

## Architecture

### High-Level Overview

```
Mind Pack
    │
    ├──► Pack Builder
    ├──► Section Builders
    ├──► Formatters
    └──► Bundle Integration
```

### Key Components

1. **API** (`api/`): Pack building API
2. **Builder** (`builder/`): Pack builder implementation
3. **Sections** (`sections/`): Section builders
4. **Formatter** (`formatter/`): Pack formatters
5. **Bundle** (`bundle/`): Bundle integration

## ✨ Features

- **Pack Building**: Build context packs from Mind indexes
- **Section Builders**: Build context sections (intent, API, diffs, snippets, configs, meta, docs)
- **Formatting**: Format packs as JSON and Markdown
- **Bundle Integration**: Integrate with bundle system
- **Token Budget**: Token budget management

## 📦 API Reference

### Main Exports

#### Pack Building

- `buildPack`: Build context pack from Mind indexes

#### Types

- `PackOptions`: Pack options type
- `PackResult`: Pack result type
- `PackContext`: Pack context type
- `SectionBuilder`: Section builder type

## 🔧 Configuration

### Configuration Options

All configuration via function parameters.

## 🔗 Dependencies

### Runtime Dependencies

- `@kb-labs/mind-core` (`link:../mind-core`): Mind core
- `@kb-labs/mind-types` (`link:../mind-types`): Mind types

### Development Dependencies

- `@kb-labs/devkit` (`link:../../../kb-labs-devkit`): DevKit presets
- `@types/node` (`^24.7.0`): Node.js types
- `tsup` (`^8.5.0`): TypeScript bundler
- `typescript` (`^5.6.3`): TypeScript compiler
- `vitest` (`^3.2.4`): Test runner

## 🧪 Testing

### Test Structure

```
src/__tests__/
└── (2 test files)
```

### Test Coverage

- **Current Coverage**: ~70%
- **Target Coverage**: 90%

## 📈 Performance

### Performance Characteristics

- **Time Complexity**: O(n) for pack building, O(n) for formatting
- **Space Complexity**: O(n) where n = pack size
- **Bottlenecks**: Large pack building

## 🔒 Security

### Security Considerations

- **Path Validation**: Path validation for file operations
- **Token Budget**: Token budget enforcement

### Known Vulnerabilities

- None

## 🐛 Known Issues & Limitations

### Known Issues

- None currently

### Limitations

- **Pack Size**: Performance degrades with very large packs
- **Section Types**: Fixed section types

### Future Improvements

- **More Section Types**: Additional section types
- **Performance**: Optimize for large packs

## 🔄 Migration & Breaking Changes

### Migration from Previous Versions

No breaking changes in current version (0.1.0).

### Breaking Changes in Future Versions

- None planned

## 📚 Examples

### Example 1: Build Pack

```typescript
import { buildPack } from '@kb-labs/mind-pack';

const result = await buildPack({
  cwd: process.cwd(),
  intent: 'Review this code change',
  budget: {
    totalTokens: 9000,
    caps: {},
    truncation: 'end',
  },
});
```

### Example 2: Use Pack Result

```typescript
const { json, markdown, tokensEstimate } = result;
console.log(`Pack built: ${tokensEstimate} tokens`);
```

## 🤝 Contributing

See [CONTRIBUTING.md](../../CONTRIBUTING.md) for development guidelines.

## 📄 License

MIT © KB Labs

