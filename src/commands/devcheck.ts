import { Command } from 'commander';
import { AbstractCommand } from './base.js';
import { DevDependencyDetector } from '../devDependencyDetector.js';
import { type PackageVersionSpec } from '../utils/packageVersionParser.js';
import type { CommandOptions, CommandResult } from './types.js';
import type { DevCheckOptions } from '../types.js';
import createDebug from 'debug';

const debug = createDebug('depoptimize:command:devcheck');

export class DevCheckCommand extends AbstractCommand {
  name = 'devcheck';
  description = 'Check for common dev dependencies in production dependencies';
  hasPackageArgument = false;

  protected addSpecificOptions(command: Command): void {
    command
      .option('--fix', 'Automatically fix issues where possible')
      .option('--include <packages>', 'Additional packages to include in dev dependency check (comma-separated)')
      .option('--exclude <packages>', 'Packages to exclude from dev dependency check (comma-separated)');
  }

  protected applyDefaults(rawOptions: CommandOptions, config: any): CommandOptions {
    return {
      ...rawOptions,
      // Apply command-specific defaults
      include: rawOptions.include ?? config.include,
      exclude: rawOptions.exclude ?? config.exclude,
      // Fix is intentionally CLI-only for safety
      fix: rawOptions.fix ?? false,
      verbose: rawOptions.verbose ?? config.verbose ?? false
    };
  }

  async execute(options: CommandOptions, packageVersionSpec?: PackageVersionSpec): Promise<CommandResult> {
    try {
      debug('Starting devcheck command with options: %O', options);
      debug('Project path: %s', options.path);

      const devCheckOptions: DevCheckOptions = {
        fix: options.fix,
        json: options.json,
        include: Array.isArray(options.include) ? options.include : (options.include ? options.include.split(',').map((p: string) => p.trim()) : undefined),
        exclude: Array.isArray(options.exclude) ? options.exclude : (options.exclude ? options.exclude.split(',').map((p: string) => p.trim()) : undefined)
      };

      const detector = new DevDependencyDetector(devCheckOptions);
      debug('Created detector with options: %O', devCheckOptions);
      const result = await detector.check(options.path!);
      debug('Devcheck completed, found %d misplaced dependencies', result.misplacedDependencies.length);

      const summary = this.generateSummary(result, options.fix);

      return {
        success: true,
        data: result,
        summary
      };

    } catch (error: any) {
      debug('Devcheck command failed with error: %O', error);
      return {
        success: false,
        errors: [error.message]
      };
    }
  }

  protected displayData(data: any, options: CommandOptions): void {
    if (data && data.misplacedDependencies && data.misplacedDependencies.length > 0) {
      console.log('   ❌ Misplaced dev dependencies:');
      data.misplacedDependencies.forEach((dep: any) => {
        console.log(`     ${dep.name} (should be in devDependencies)`);
      });
    }
  }

  protected formatDataMarkdown(data: any, options: CommandOptions): string {
    const lines: string[] = [];
    
    if (data && data.misplacedDependencies && data.misplacedDependencies.length > 0) {
      lines.push('**Misplaced dev dependencies:**');
      lines.push('');
      data.misplacedDependencies.forEach((dep: any) => {
        lines.push(`- ${dep.name} (should be in devDependencies)`);
      });
      lines.push('');
    }
    
    return lines.join('\n');
  }

  private generateSummary(result: any, fixMode: boolean): string {
    if (result.misplacedDependencies.length === 0) {
      return 'No misplaced dev dependencies found';
    }

    if (fixMode && result.fixedDependencies && result.fixedDependencies.length > 0) {
      return `🔧 Fixed ${result.fixedDependencies.length} misplaced dev dependencies`;
    }

    return `❌ Found ${result.misplacedDependencies.length} misplaced dev dependencies`;
  }
}
