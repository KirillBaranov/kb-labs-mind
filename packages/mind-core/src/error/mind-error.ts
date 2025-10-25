/**
 * @module @kb-labs/mind-core/error
 * Standardized error class for KB Labs Mind
 */

export class MindError extends Error {
  constructor(
    public code: string,
    message: string,
    public hint?: string,
    public meta?: any
  ) {
    super(message);
    this.name = 'MindError';
  }
}

/**
 * Maps MindError codes to CLI exit codes
 */
export function getExitCode(err: MindError): number {
  if (err.code === 'MIND_FORBIDDEN') return 3;
  if (err.code === 'MIND_NO_GIT') return 2;
  if (err.code === 'MIND_FS_TIMEOUT') return 2;
  if (err.code === 'MIND_PARSE_ERROR') return 1;
  if (err.code === 'MIND_PACK_BUDGET_EXCEEDED') return 1;
  if (err.code.startsWith('MIND_')) return 1;
  return 1;
}

/**
 * Error codes with their standard hints
 */
export const ERROR_HINTS = {
  MIND_NO_GIT: 'Initialize git repository or run from a git repository',
  MIND_FS_TIMEOUT: 'File system operation timed out - try increasing time budget',
  MIND_PARSE_ERROR: 'Failed to parse file - check syntax and try again',
  MIND_PACK_BUDGET_EXCEEDED: 'Context pack exceeds token budget - reduce content or increase budget',
  MIND_FORBIDDEN: 'Operation not permitted - check file permissions',
  MIND_TIME_BUDGET: 'Time budget exceeded - operation completed partially',
} as const;

export type ErrorCode = keyof typeof ERROR_HINTS;
