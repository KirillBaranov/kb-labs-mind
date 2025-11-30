# Phase 6: Testing & Bug Fixes

**Status:** 🚧 IN PROGRESS
**Started:** 2025-11-24
**Goal:** Fix remaining compilation errors, add tests, validate functionality

---

## Objectives

1. **Fix DTS Generation Errors** (Priority: High)
   - Fix module resolution issues
   - Fix type mismatches in old code (ast-typescript, compression, learning)
   - Ensure all packages generate valid .d.ts files

2. **Fix Test Files** (Priority: High)
   - Fix async/await issues in test files
   - Update test expectations for refactored code
   - Ensure all tests compile

3. **Add Tests for New Components** (Priority: Medium)
   - Unit tests for Phase 1-5 components
   - Integration tests for pipeline
   - Performance benchmarks

4. **Runtime Validation** (Priority: High)
   - Test indexing on sample codebase
   - Validate memory improvements
   - Validate speed improvements

---

## Tasks

### 1. Fix DTS Generation (Blocker)

**Current Errors:**
- Module resolution: Cannot find '@kb-labs/knowledge-contracts'
- Dynamic imports not supported
- ReasoningResult type missing properties

**Steps:**
1. Fix tsconfig module resolution
2. Fix or exclude old code from DTS generation
3. Validate all packages generate .d.ts

### 2. Fix Old Code Type Errors

**Files with errors:**
- `ast-typescript.ts` - TypeScript compiler API types missing
- `compression/context-compressor.ts` - LLM API type mismatch
- `learning/feedback.ts` - Missing 'payload' property
- `learning/query-history.ts` - Missing 'payload' property
- `output/json-formatter.ts` - ReasoningResult type incomplete

**Strategy:**
- Option A: Fix types to match contracts
- Option B: Mark as deprecated, exclude from build
- Option C: Remove entirely if not used

### 3. Fix Test Files

**Test files with errors:**
- `ast-typescript.spec.ts` - async/sync mismatch
- `line-based.spec.ts` - possibly undefined
- `complexity-detector.spec.ts` - MindLLMEngine interface
- `parallel-executor.spec.ts` - KnowledgeScope missing fields
- `query-planner.spec.ts` - MindLLMEngine interface
- `reasoning-engine.spec.ts` - KnowledgeQuery missing fields

**Strategy:**
- Update tests to await async functions
- Add null checks
- Update mocks to match new interfaces

### 4. Add New Tests

**Components needing tests:**
- Phase 1: StreamingUtilities
- Phase 2: Pipeline stages (Discovery, Chunking, Embedding, Storage)
- Phase 3: TreeSitterChunker + language chunkers
- Phase 4: WorkerPool, AutoScaler, ParallelChunking
- Phase 5: ContextBuilder, QueryExpander, RelevanceRanker

### 5. Runtime Validation

**Test scenarios:**
- Index small codebase (100 files)
- Index medium codebase (1k files)
- Measure memory usage
- Measure speed
- Validate chunk quality

---

## Success Criteria

✅ **Must Have:**
- All packages generate valid .d.ts files
- All non-test files compile without errors
- Runtime code works on sample codebase
- No memory crashes

✅ **Should Have:**
- Test files compile
- Basic unit tests for new components
- Performance benchmark results

✅ **Nice to Have:**
- Full test coverage
- Integration tests
- Stress tests

---

## Estimated Time

- Fix DTS generation: 2-3 hours
- Fix old code: 1-2 hours
- Fix test files: 2-3 hours
- Add new tests: 4-6 hours
- Runtime validation: 2-3 hours

**Total:** 1-2 days

---

## Progress Tracking

- [ ] Fix DTS generation errors
- [ ] Fix old code type errors
- [ ] Fix test file errors
- [ ] Add tests for Phase 1 components
- [ ] Add tests for Phase 2 components
- [ ] Add tests for Phase 3 components
- [ ] Add tests for Phase 4 components
- [ ] Add tests for Phase 5 components
- [ ] Runtime validation
- [ ] Performance benchmarks

---

**Next Step:** Start with fixing DTS generation (highest priority blocker)
