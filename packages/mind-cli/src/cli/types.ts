/**
 * CLI command module type definition
 */

import type { CliHandlerContext } from '@kb-labs/core-sandbox';
import type { Output } from '@kb-labs/core-sys';

/**
 * CommandContext extends CliHandlerContext with output support
 * presenter is kept for backwards compatibility but output is preferred
 */
export type CommandContext = CliHandlerContext & {
  // output is available via CliHandlerContext, but we ensure it's typed here
  output: Output;
  // presenter is kept for backwards compatibility (deprecated)
  presenter: CliHandlerContext['presenter'];
};

export type CommandModule = {
  run: (ctx: CommandContext, argv: string[], flags: Record<string, any>) => Promise<number|void>;
};
