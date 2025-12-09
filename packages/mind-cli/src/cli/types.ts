/**
 * CLI command module type definition
 */

import type { CliContext, Output } from '@kb-labs/sdk';

/**
 * CommandContext extends CliContext with output support
 * presenter is kept for backwards compatibility but output is preferred
 */
export type CommandContext = CliContext & {
  // output is available via CliContext, but we ensure it's typed here
  output: Output;
  // presenter is kept for backwards compatibility (deprecated)
  presenter: CliContext['presenter'];
};

export type CommandModule = {
  run: (ctx: CommandContext, argv: string[], flags: Record<string, any>) => Promise<number|void>;
};
