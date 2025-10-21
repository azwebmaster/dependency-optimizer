import type { Command } from 'commander';
import type { PackageVersionSpec } from '../utils/packageVersionParser.js';

export interface CommandOptions {
  path?: string;
  output?: 'console' | 'json' | 'markdown';
  verbose?: boolean;
  prod?: boolean;
  config?: string;
  noConfig?: boolean;
  [key: string]: any;
}

export interface CommandResult {
  success: boolean;
  data?: any;
  summary?: string;
  errors?: string[];
}

export interface BaseCommand {
  name: string;
  description: string;
  register(program: Command): void;
  execute(options: CommandOptions, packageVersionSpec?: PackageVersionSpec): Promise<CommandResult>;
}

export interface CommandWithPackage extends BaseCommand {
  hasPackageArgument: boolean;
}

export interface CommandWithoutPackage extends BaseCommand {
  hasPackageArgument: false;
}
