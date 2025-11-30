import { describe, it, expect } from 'vitest';
import { manifest } from '../manifest.v2';

describe('Mind CLI Smoke Tests', () => {
  it('should have manifest with required commands', () => {
    expect(manifest).toBeDefined();
    expect(manifest.cli).toBeDefined();
    expect(manifest.cli.commands).toBeDefined();
    expect(Array.isArray(manifest.cli.commands)).toBe(true);
    expect(manifest.cli.commands.length).toBeGreaterThan(0);
    
    // Check for required commands
    const commandIds = manifest.cli.commands.map(cmd => cmd.id);
    expect(commandIds).toContain('init');
    expect(commandIds).toContain('update');
    expect(commandIds).toContain('query');
    expect(commandIds).toContain('verify');
    expect(commandIds).toContain('pack');
    expect(commandIds).toContain('feed');
  });

  it('should have proper command structure', () => {
    for (const command of manifest.cli.commands) {
      expect(command).toHaveProperty('id');
      expect(command).toHaveProperty('group');
      expect(command).toHaveProperty('describe');
      expect(command).toHaveProperty('flags');
      expect(command).toHaveProperty('examples');
      expect(command).toHaveProperty('handler');
      
      expect(typeof command.id).toBe('string');
      expect(typeof command.describe).toBe('string');
      expect(Array.isArray(command.flags)).toBe(true);
      expect(Array.isArray(command.examples)).toBe(true);
    }
  });

  it('should have mind:query with required flags', () => {
    const queryCommand = manifest.cli.commands.find(cmd => cmd.id === 'query');
    expect(queryCommand).toBeDefined();
    
    const flagNames = queryCommand?.flags?.map(flag => flag.name) || [];
    expect(flagNames).toContain('query');
    expect(flagNames).toContain('json');
    expect(flagNames).toContain('ai-mode');
    expect(flagNames).toContain('cache-mode');
  });
});