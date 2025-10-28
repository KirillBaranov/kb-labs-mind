/**
 * CLI command module type definition
 */

export type CommandContext = {
  presenter: {
    write: (text: string) => void;
    error: (text: string) => void;
    info: (text: string) => void;
    json: (data: any) => void;
  };
  cwd: string;
  flags: Record<string, any>;
  argv: string[];
};

export type CommandModule = {
  run: (ctx: CommandContext, argv: string[], flags: Record<string, any>) => Promise<number|void>;
};
