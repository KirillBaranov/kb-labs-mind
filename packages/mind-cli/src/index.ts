/**
 * @module @kb-labs/mind-cli
 * Entry point aggregating all public surfaces of the Mind plugin.
 */

export { manifest } from './manifest.v2';
export { manifest as manifestV2 } from './manifest.v2';
export type { ManifestV2 } from '@kb-labs/plugin-manifest';

export * from './shared/index';
export * from './domain/index';
export * from './application/index';
export * from './infra/index';
export * from './cli/index';
export * from './rest/index';
export * from './studio/index';
