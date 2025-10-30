/**
 * Mind CLI suggestions integration
 * Example of how to integrate with the shared CLI suggestions system
 */

import { 
  MultiCLISuggestions, 
  generateGroupSuggestions,
  type CommandSuggestion 
} from '@kb-labs/shared-cli-ui';
import { commands } from './cli.manifest.js';

/**
 * Generate mind-specific suggestions
 */
export function generateMindSuggestions(
  warningCodes: Set<string>,
  context: any
): CommandSuggestion[] {
  const suggestions: CommandSuggestion[] = [];

  // Mind-specific suggestions based on warning codes
  if (warningCodes.has('MIND_INDEX_MISSING')) {
    suggestions.push({
      id: 'MIND_INIT',
      command: 'kb mind init',
      args: [],
      description: 'Initialize mind workspace',
      impact: 'safe',
      when: 'MIND_INDEX_MISSING',
      available: true
    });
  }

  if (warningCodes.has('MIND_INDEX_STALE')) {
    suggestions.push({
      id: 'MIND_REINDEX',
      command: 'kb mind index',
      args: ['--force'],
      description: 'Reindex mind workspace',
      impact: 'disruptive',
      when: 'MIND_INDEX_STALE',
      available: true
    });
  }

  if (warningCodes.has('MIND_CONFIG_MISSING')) {
    suggestions.push({
      id: 'MIND_CONFIG_INIT',
      command: 'kb mind config init',
      args: [],
      description: 'Initialize mind configuration',
      impact: 'safe',
      when: 'MIND_CONFIG_MISSING',
      available: true
    });
  }

  return suggestions;
}

/**
 * Create a mind CLI suggestions manager
 */
export function createMindCLISuggestions(): MultiCLISuggestions {
  const manager = new MultiCLISuggestions();
  
  // Register mind CLI package
  manager.registerPackage({
    name: 'mind',
    group: 'mind',
    commands,
    priority: 80
  });

  return manager;
}

/**
 * Get all available mind commands
 */
export function getMindCommands(): string[] {
  return commands.map(cmd => cmd.id);
}
