/**
 * @module @kb-labs/mind-engine/index
 * Incremental indexing module for central index + local overlay architecture
 */

// Manifest types and utilities
export {
  type IndexManifest,
  type IndexStats,
  type IndexStorage,
  type IndexedFile,
  MANIFEST_VERSION,
  MANIFEST_FILENAME,
  createManifest,
  isCompatibleManifest,
  loadManifest,
  saveManifest,
  calculateChecksum,
  getDefaultIndexDir,
  getManifestPath,
} from './manifest.js';

// Git diff detection
export {
  type ChangedFile,
  type GitDiffOptions,
  GitDiffDetector,
  createGitDiffDetector,
} from './git-diff.js';

// Merged vector store
export {
  type MergedVectorStoreOptions,
  type MergedIndexStats,
  MergedVectorStore,
  createMergedVectorStore,
} from './merged-store.js';

// Incremental builder
export {
  type OverlayBuildOptions,
  type OverlayBuildProgress,
  type OverlayBuildResult,
  IncrementalIndexBuilder,
  buildAndStoreOverlay,
  createIncrementalBuilder,
} from './incremental-builder.js';

// Remote storage
export {
  type UpdateInfo,
  type RemoteIndexStorage,
  type DownloadOptions,
  type DownloadProgress,
  type StorageFactoryOptions,
  createRemoteStorage,
  LocalIndexStorage,
} from './remote-storage.js';

// Overlay manager
export {
  type OverlayManagerConfig,
  type OverlayStatus,
  OverlayManager,
  createOverlayManager,
} from './overlay-manager.js';
