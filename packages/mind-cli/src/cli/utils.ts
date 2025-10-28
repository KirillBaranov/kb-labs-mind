// Simple CLI utilities for mind-cli
export const colors = {
  red: (text: string) => `\x1b[31m${text}\x1b[0m`,
  green: (text: string) => `\x1b[32m${text}\x1b[0m`,
  yellow: (text: string) => `\x1b[33m${text}\x1b[0m`,
  blue: (text: string) => `\x1b[34m${text}\x1b[0m`,
  cyan: (text: string) => `\x1b[36m${text}\x1b[0m`,
  gray: (text: string) => `\x1b[90m${text}\x1b[0m`,
  bold: (text: string) => `\x1b[1m${text}\x1b[0m`,
  dim: (text: string) => `\x1b[2m${text}\x1b[0m`,
};

export const safeColors = colors;

export const safeSymbols = {
  check: '✓',
  cross: '✗',
  arrow: '→',
  bullet: '•',
  info: 'ℹ',
  warning: '⚠',
  error: '✗',
};

export class TimingTracker {
  private startTime: number;
  
  constructor() {
    this.startTime = Date.now();
  }
  
  getElapsed(): number {
    return Date.now() - this.startTime;
  }
  
  getElapsedMs(): number {
    return this.getElapsed();
  }
}

export function formatTiming(ms: number): string {
  if (ms < 1000) {
    return `${ms}ms`;
  }
  return `${(ms / 1000).toFixed(1)}s`;
}

export function box(text: string, title?: string): string {
  const lines = text.split('\n');
  const maxWidth = Math.max(...lines.map(line => line.length));
  const width = Math.max(maxWidth + 4, 50);
  
  const top = '┌' + '─'.repeat(width - 2) + '┐';
  const bottom = '└' + '─'.repeat(width - 2) + '┘';
  
  let result = top + '\n';
  
  if (title) {
    result += '│ ' + title.padEnd(width - 4) + ' │\n';
    result += '├' + '─'.repeat(width - 2) + '┤\n';
  }
  
  for (const line of lines) {
    result += '│ ' + line.padEnd(width - 4) + ' │\n';
  }
  
  result += bottom;
  return result;
}

export function keyValue(key: string, value: string | number): string {
  return `${colors.cyan(key)}: ${value}`;
}

export function createSpinner(text: string) {
  const frames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
  let frame = 0;
  
  const interval = setInterval(() => {
    process.stdout.write(`\r${frames[frame]} ${text}`);
    frame = (frame + 1) % frames.length;
  }, 100);
  
  return {
    stop: (finalText?: string) => {
      clearInterval(interval);
      process.stdout.write(`\r${finalText || text}\n`);
    }
  };
}

