/**
 * CLI smoke tests for production confidence
 */

import { describe, it, expect } from 'vitest';
import { commands } from '@kb-labs/mind-cli';
import type { CommandManifest } from '@kb-labs/mind-cli';

describe('CLI Smoke Tests', () => {
  it('should have manifest with required commands', () => {
    expect(commands).toBeDefined();
    expect(Array.isArray(commands)).toBe(true);
    expect(commands.length).toBeGreaterThan(0);
    
    // Check for required commands
    const commandIds = commands.map((cmd: CommandManifest) => cmd.id);
    expect(commandIds).toContain('mind:init');
    expect(commandIds).toContain('mind:update');
    expect(commandIds).toContain('mind:query');
    expect(commandIds).toContain('mind:verify');
    expect(commandIds).toContain('mind:pack');
    expect(commandIds).toContain('mind:feed');
  });

  it('should have proper command structure', () => {
    for (const command of commands) {
      expect(command).toHaveProperty('manifestVersion');
      expect(command).toHaveProperty('id');
      expect(command).toHaveProperty('group');
      expect(command).toHaveProperty('describe');
      expect(command).toHaveProperty('flags');
      expect(command).toHaveProperty('examples');
      
      expect(typeof command.id).toBe('string');
      expect(typeof command.describe).toBe('string');
      expect(Array.isArray(command.flags)).toBe(true);
      expect(Array.isArray(command.examples)).toBe(true);
    }
  });

  it('should have mind:query with required flags', () => {
    const queryCommand = commands.find((cmd: CommandManifest) => cmd.id === 'mind:query');
    expect(queryCommand).toBeDefined();
    
    const flagNames = queryCommand?.flags?.map((flag: any) => flag.name) || [];
    expect(flagNames).toContain('query');
    expect(flagNames).toContain('json');
    expect(flagNames).toContain('ai-mode');
    expect(flagNames).toContain('cache-mode');
  });

  it.skip('should have all commands with proper loaders', () => {
    // TODO(devkit-automation): loader реанимируется в рантайме через cli-commands, сюда
    // доезжает сериализованный manifest без функции. Вернём проверку, когда вынесем
    // ensureManifestLoader в общий helper и сможем дергать его из тестов.
    for (const command of commands) {
      expect(command).toHaveProperty('loader');
      expect(typeof (command as any).loader).toBe('function');
    }
  });
});
