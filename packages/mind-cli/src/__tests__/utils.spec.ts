/**
 * Unit tests for CLI utilities
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { 
  colors, 
  safeColors, 
  safeSymbols, 
  TimingTracker, 
  formatTiming, 
  box, 
  keyValue, 
  createSpinner 
} from '../cli/utils.js';

describe('CLI Utilities', () => {
  describe('colors', () => {
    it('should apply red color', () => {
      const result = colors.red('test');
      expect(result).toContain('\x1b[31m');
      expect(result).toContain('test');
      expect(result).toContain('\x1b[0m');
    });

    it('should apply green color', () => {
      const result = colors.green('test');
      expect(result).toContain('\x1b[32m');
      expect(result).toContain('test');
    });

    it('should apply yellow color', () => {
      const result = colors.yellow('test');
      expect(result).toContain('\x1b[33m');
      expect(result).toContain('test');
    });

    it('should apply blue color', () => {
      const result = colors.blue('test');
      expect(result).toContain('\x1b[34m');
      expect(result).toContain('test');
    });

    it('should apply cyan color', () => {
      const result = colors.cyan('test');
      expect(result).toContain('\x1b[36m');
      expect(result).toContain('test');
    });

    it('should apply gray color', () => {
      const result = colors.gray('test');
      expect(result).toContain('\x1b[90m');
      expect(result).toContain('test');
    });

    it('should apply bold formatting', () => {
      const result = colors.bold('test');
      expect(result).toContain('\x1b[1m');
      expect(result).toContain('test');
    });

    it('should apply dim formatting', () => {
      const result = colors.dim('test');
      expect(result).toContain('\x1b[2m');
      expect(result).toContain('test');
    });
  });

  describe('safeColors', () => {
    it('should be same as colors', () => {
      expect(safeColors).toBe(colors);
    });
  });

  describe('safeSymbols', () => {
    it('should have all required symbols', () => {
      expect(safeSymbols.check).toBe('✓');
      expect(safeSymbols.cross).toBe('✗');
      expect(safeSymbols.arrow).toBe('→');
      expect(safeSymbols.bullet).toBe('•');
      expect(safeSymbols.info).toBe('ℹ');
      expect(safeSymbols.warning).toBe('⚠');
      expect(safeSymbols.error).toBe('✗');
    });
  });

  describe('TimingTracker', () => {
    let tracker: TimingTracker;

    beforeEach(() => {
      tracker = new TimingTracker();
    });

    it('should initialize with current time', () => {
      expect(tracker.getElapsed()).toBeGreaterThanOrEqual(0);
    });

    it('should track elapsed time', async () => {
      const initial = tracker.getElapsed();
      await new Promise(resolve => setTimeout(resolve, 10));
      const after = tracker.getElapsed();
      expect(after).toBeGreaterThan(initial);
    });

    it('should return elapsed time in milliseconds', () => {
      const elapsed = tracker.getElapsedMs();
      expect(elapsed).toBeGreaterThanOrEqual(0);
      expect(typeof elapsed).toBe('number');
    });
  });

  describe('formatTiming', () => {
    it('should format milliseconds correctly', () => {
      expect(formatTiming(500)).toBe('500ms');
      expect(formatTiming(999)).toBe('999ms');
    });

    it('should format seconds correctly', () => {
      expect(formatTiming(1000)).toBe('1.0s');
      expect(formatTiming(1500)).toBe('1.5s');
      expect(formatTiming(2000)).toBe('2.0s');
    });
  });

  describe('box', () => {
    it('should create a simple box', () => {
      const result = box('Hello World');
      expect(result).toContain('┌');
      expect(result).toContain('┐');
      expect(result).toContain('└');
      expect(result).toContain('┘');
      expect(result).toContain('Hello World');
    });

    it('should create a box with title', () => {
      const result = box('Content', 'Title');
      expect(result).toContain('Title');
      expect(result).toContain('Content');
      expect(result).toContain('├');
      expect(result).toContain('┤');
    });

    it('should handle multi-line content', () => {
      const result = box('Line 1\nLine 2\nLine 3');
      expect(result).toContain('Line 1');
      expect(result).toContain('Line 2');
      expect(result).toContain('Line 3');
    });

    it('should handle minimum width', () => {
      const result = box('Hi');
      expect(result).toContain('┌' + '─'.repeat(48) + '┐');
    });
  });

  describe('keyValue', () => {
    it('should format string value', () => {
      const result = keyValue('name', 'value');
      expect(result).toContain('name');
      expect(result).toContain('value');
      expect(result).toContain('\x1b[36m'); // cyan color
    });

    it('should format number value', () => {
      const result = keyValue('count', 42);
      expect(result).toContain('count');
      expect(result).toContain('42');
    });
  });

  describe('createSpinner', () => {
    let originalStdout: any;

    beforeEach(() => {
      originalStdout = process.stdout.write;
      process.stdout.write = vi.fn();
    });

    afterEach(() => {
      process.stdout.write = originalStdout;
    });

    it('should create spinner with text', () => {
      const spinner = createSpinner('Loading...');
      expect(spinner).toHaveProperty('stop');
      expect(typeof spinner.stop).toBe('function');
    });

    it('should stop spinner with final text', () => {
      const spinner = createSpinner('Loading...');
      spinner.stop('Done!');
      
      expect(process.stdout.write).toHaveBeenCalledWith(expect.stringContaining('Done!'));
    });

    it('should stop spinner without final text', () => {
      const spinner = createSpinner('Loading...');
      spinner.stop();
      
      expect(process.stdout.write).toHaveBeenCalledWith(expect.stringContaining('Loading...'));
    });
  });
});
