/**
 * @module @kb-labs/mind-cli
 * Entry point aggregating all public surfaces of the Mind plugin.
 */

export { manifest } from './manifest.v2.js';
export { manifest as manifestV2 } from './manifest.v2.js';
export type { ManifestV2 } from '@kb-labs/plugin-manifest';

export * from './shared/index.js';
export * from './domain/index.js';
export * from './application/index.js';
export * from './infra/index.js';
export * from './cli/index.js';
export * from './rest/index.js';
export * from './studio/index';
