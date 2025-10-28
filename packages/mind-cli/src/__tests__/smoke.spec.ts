import { describe, it, expect } from 'vitest';
import { commands } from '../cli.manifest.js';

describe('Mind CLI Smoke Tests', () => {
  it('should have manifest with required commands', () => {
    expect(commands).toBeDefined();
    expect(Array.isArray(commands)).toBe(true);
    expect(commands.length).toBeGreaterThan(0);
    
    // Check for required commands
    const commandIds = commands.map(cmd => cmd.id);
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
    const queryCommand = commands.find(cmd => cmd.id === 'mind:query');
    expect(queryCommand).toBeDefined();
    
    const flagNames = queryCommand?.flags?.map(flag => flag.name) || [];
    expect(flagNames).toContain('query');
    expect(flagNames).toContain('json');
    expect(flagNames).toContain('ai-mode');
    expect(flagNames).toContain('cache-mode');
  });
});