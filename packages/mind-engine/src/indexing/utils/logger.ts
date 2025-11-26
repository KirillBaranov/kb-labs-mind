/**
 * Simple logger implementation for pipeline stages
 * Provides structured logging with different levels
 */

import type { Logger } from '../pipeline-types.js';

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
  SILENT = 4,
}

export interface ConsoleLoggerOptions {
  level?: LogLevel;
  prefix?: string;
  timestamps?: boolean;
  colors?: boolean;
}

/**
 * Console-based logger implementation
 */
export class ConsoleLogger implements Logger {
  private level: LogLevel;
  private prefix: string;
  private timestamps: boolean;
  private colors: boolean;

  constructor(options: ConsoleLoggerOptions = {}) {
    this.level = options.level ?? LogLevel.INFO;
    this.prefix = options.prefix ?? '';
    this.timestamps = options.timestamps ?? true;
    this.colors = options.colors ?? true;
  }

  debug(message: string, meta?: Record<string, unknown>): void {
    if (this.level <= LogLevel.DEBUG) {
      this.log('DEBUG', message, meta, '\x1b[36m'); // Cyan
    }
  }

  info(message: string, meta?: Record<string, unknown>): void {
    if (this.level <= LogLevel.INFO) {
      this.log('INFO', message, meta, '\x1b[32m'); // Green
    }
  }

  warn(message: string, meta?: Record<string, unknown>): void {
    if (this.level <= LogLevel.WARN) {
      this.log('WARN', message, meta, '\x1b[33m'); // Yellow
    }
  }

  error(message: string, meta?: Record<string, unknown>): void {
    if (this.level <= LogLevel.ERROR) {
      this.log('ERROR', message, meta, '\x1b[31m'); // Red
    }
  }

  private log(
    level: string,
    message: string,
    meta: Record<string, unknown> | undefined,
    color: string
  ): void {
    const parts: string[] = [];

    // Timestamp
    if (this.timestamps) {
      const now = new Date().toISOString();
      parts.push(`[${now}]`);
    }

    // Level
    if (this.colors) {
      parts.push(`${color}${level}\x1b[0m`);
    } else {
      parts.push(level);
    }

    // Prefix
    if (this.prefix) {
      parts.push(`[${this.prefix}]`);
    }

    // Message
    parts.push(message);

    // Meta (if provided)
    if (meta && Object.keys(meta).length > 0) {
      // CRITICAL OOM FIX: Use compact JSON (no pretty-print) to avoid split('\n') memory issues
      // V8's JSON.stringify(obj, null, 2) internally calls split('\n') which causes OOM on large objects
      // Also sanitize to remove large text fields
      const sanitized = this.sanitizeMeta(meta);
      const metaStr = JSON.stringify(sanitized); // Compact format - no pretty-print!
      parts.push(metaStr);
    }

    // Output
    console.log(parts.join(' '));
  }

  /**
   * Sanitize metadata to prevent OOM from large text fields
   */
  private sanitizeMeta(meta: Record<string, unknown>): Record<string, unknown> {
    const sanitized: Record<string, unknown> = {};
    const MAX_STRING_LENGTH = 1000;
    const MAX_ARRAY_LENGTH = 50;

    for (const [key, value] of Object.entries(meta)) {
      if (value == null) {
        sanitized[key] = value;
        continue;
      }

      // Truncate large strings
      if (typeof value === 'string') {
        if (value.length > MAX_STRING_LENGTH) {
          sanitized[key] = `${value.slice(0, MAX_STRING_LENGTH)}... [${value.length} chars]`;
        } else {
          sanitized[key] = value;
        }
        continue;
      }

      // Handle arrays - limit size and sanitize elements
      if (Array.isArray(value)) {
        const limitedArray = value.slice(0, MAX_ARRAY_LENGTH).map(item => {
          if (item && typeof item === 'object' && 'text' in item) {
            const itemObj = item as Record<string, unknown>;
            return {
              ...Object.keys(itemObj).reduce((acc, k) => {
                if (k !== 'text') acc[k] = itemObj[k];
                return acc;
              }, {} as Record<string, unknown>),
              text: `[omitted: ${(itemObj.text as string)?.length ?? 0} chars]`,
            };
          }
          return item;
        });
        if (value.length > MAX_ARRAY_LENGTH) {
          limitedArray.push(`... [${value.length - MAX_ARRAY_LENGTH} more items]`);
        }
        sanitized[key] = limitedArray;
        continue;
      }

      // Handle objects - check for text field
      if (typeof value === 'object') {
        const obj = value as Record<string, unknown>;
        if ('text' in obj && typeof obj.text === 'string') {
          sanitized[key] = {
            ...Object.keys(obj).reduce((acc, k) => {
              if (k !== 'text') acc[k] = obj[k];
              return acc;
            }, {} as Record<string, unknown>),
            text: `[omitted: ${obj.text.length} chars]`,
          };
        } else {
          // Recurse for nested objects (limit depth implicitly via max iterations)
          sanitized[key] = this.sanitizeMeta(obj as Record<string, unknown>);
        }
        continue;
      }

      // Primitives pass through
      sanitized[key] = value;
    }

    return sanitized;
  }

  /**
   * Create child logger with additional prefix
   */
  child(prefix: string): ConsoleLogger {
    return new ConsoleLogger({
      level: this.level,
      prefix: this.prefix ? `${this.prefix}:${prefix}` : prefix,
      timestamps: this.timestamps,
      colors: this.colors,
    });
  }

  /**
   * Set log level dynamically
   */
  setLevel(level: LogLevel): void {
    this.level = level;
  }

  /**
   * Get current log level
   */
  getLevel(): LogLevel {
    return this.level;
  }
}

/**
 * No-op logger for testing or silent mode
 */
export class SilentLogger implements Logger {
  debug(_message: string, _meta?: Record<string, unknown>): void {
    // No-op
  }

  info(_message: string, _meta?: Record<string, unknown>): void {
    // No-op
  }

  warn(_message: string, _meta?: Record<string, unknown>): void {
    // No-op
  }

  error(_message: string, _meta?: Record<string, unknown>): void {
    // No-op
  }
}

/**
 * Create a logger based on environment
 */
export function createLogger(options?: ConsoleLoggerOptions): Logger {
  // In test environment, use silent logger
  if (process.env.NODE_ENV === 'test') {
    return new SilentLogger();
  }

  // Parse log level from environment
  const envLevel = process.env.LOG_LEVEL?.toUpperCase();
  let level = options?.level;

  if (!level && envLevel) {
    switch (envLevel) {
      case 'DEBUG':
        level = LogLevel.DEBUG;
        break;
      case 'INFO':
        level = LogLevel.INFO;
        break;
      case 'WARN':
        level = LogLevel.WARN;
        break;
      case 'ERROR':
        level = LogLevel.ERROR;
        break;
      case 'SILENT':
        level = LogLevel.SILENT;
        break;
    }
  }

  return new ConsoleLogger({
    ...options,
    level,
  });
}
