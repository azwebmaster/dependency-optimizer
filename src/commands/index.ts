export { UnusedCommand } from './unused.js';
export { SizeCommand } from './size.js';
export { DuplicatesCommand } from './duplicates.js';
export { TreeCommand } from './tree.js';
export { DevCheckCommand } from './devcheck.js';
export { ConfigCommand } from './config.js';
export { ExamplesCommand } from './examples.js';
export { AbstractCommand } from './base.js';
export type { BaseCommand, CommandOptions, CommandResult, CommandWithPackage, CommandWithoutPackage } from './types.js';

import { UnusedCommand } from './unused.js';
import { SizeCommand } from './size.js';
import { DuplicatesCommand } from './duplicates.js';
import { TreeCommand } from './tree.js';
import { DevCheckCommand } from './devcheck.js';
import { ConfigCommand } from './config.js';
import { ExamplesCommand } from './examples.js';
import type { BaseCommand } from './types.js';

// Registry of all available commands
export const commands: { [key: string]: BaseCommand } = {
  unused: new UnusedCommand(),
  size: new SizeCommand(),
  duplicates: new DuplicatesCommand(),
  tree: new TreeCommand(),
  devcheck: new DevCheckCommand(),
  config: new ConfigCommand(),
  examples: new ExamplesCommand()
};

// Helper function to get available command names
export function getAvailableCommands(): string[] {
  return Object.keys(commands);
}

// Helper function to get a command by name
export function getCommand(name: string): BaseCommand | undefined {
  return commands[name];
}

// Helper function to validate command names
export function validateCommandNames(commandNames: string[]): { valid: string[]; invalid: string[] } {
  const availableCommands = getAvailableCommands();
  const valid: string[] = [];
  const invalid: string[] = [];

  for (const name of commandNames) {
    if (availableCommands.includes(name)) {
      valid.push(name);
    } else {
      invalid.push(name);
    }
  }

  return { valid, invalid };
}
