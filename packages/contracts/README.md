# @kb-labs/mind-contracts

Public contracts for the KB Labs Mind plugin. This package defines the artifacts, commands, workflows, and API guarantees that other plugins, tools, and surfaces can rely on when integrating with Mind.

## What is included?

- **Contract manifest** – `pluginContractsManifest` is the single source of truth for the plugin's public capabilities.
- **Type definitions** – canonical TypeScript types for artifacts, commands, workflows, and API shapes.
- **Zod schemas** – runtime validation helpers to ensure data exchanged between plugins stays compatible.
- **Versioning metadata** – the contract version is tracked independently from the npm package version using SemVer rules.

## Usage

```ts
import { pluginContractsManifest } from '@kb-labs/mind-contracts';
import { parsePluginContracts } from '@kb-labs/mind-contracts/schema';

parsePluginContracts(pluginContractsManifest);
```

Consumers can import specific schemas to validate payloads at runtime:

```ts
import { MindPackResponseSchema } from '@kb-labs/mind-contracts/schema';
```

## Versioning rules

- `contractsVersion` follows [Semantic Versioning](https://semver.org/).
- Breaking changes to the public contract **must** bump the major version.
- Non-breaking additions (new artifacts, optional fields) increment the minor version.
- Patch releases are reserved for documentation and schema fixes that do not affect consumers.

## Development

```bash
pnpm install
pnpm build
pnpm test
```

Run `pnpm devkit:paths` from the repository root after adding new exports so TypeScript path aliases stay in sync.
