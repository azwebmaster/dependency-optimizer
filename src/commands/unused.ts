import { Command } from 'commander';
import { AbstractCommand } from './base.js';
import { DependencyScanner } from '../scanner.js';
import { type PackageVersionSpec } from '../utils/packageVersionParser.js';
import type { CommandOptions, CommandResult } from './types.js';
import type { ScanOptions } from '../types.js';
import createDebug from 'debug';

const debug = createDebug('depoptimize:command:unused');

export class UnusedCommand extends AbstractCommand {
  name = 'unused';
  description = 'Scan for unused dependencies';
  hasPackageArgument = false;

  protected addSpecificOptions(command: Command): void {
    command
      .option('--fix', 'Automatically fix issues where possible');
  }

  protected applyDefaults(rawOptions: CommandOptions, config: any): CommandOptions {
    return {
      ...rawOptions,
      // Apply command-specific defaults
      includeDevDependencies: rawOptions.prod !== undefined ? !rawOptions.prod : (config.includeDevDependencies ?? true),
      verbose: rawOptions.verbose ?? config.verbose ?? false,
      // Fix is intentionally CLI-only for safety
      fix: rawOptions.fix ?? false
    };
  }

  async execute(options: CommandOptions, packageVersionSpec?: PackageVersionSpec): Promise<CommandResult> {
    try {
      debug('Starting unused command with options: %O', options);
      debug('Project path: %s', options.path);

      const scanOptions: ScanOptions = {
        fix: options.fix,
        verbose: options.verbose,
        includeDevDependencies: options.includeDevDependencies,
        packageName: packageVersionSpec?.name
      };

      const scanner = new DependencyScanner(scanOptions);
      debug('Created scanner with options: %O', scanOptions);
      const results = await scanner.scan(options.path!);
      debug('Scan completed, found %d results', results.length);

      // Process results
      let totalUnused = 0;
      let totalFixed = 0;
      const errors: string[] = [];

      for (const result of results) {
        debug('Processing result for package: %s', result.packageName || result.packagePath);
        if (result.errors && result.errors.length > 0) {
          debug('Errors found: %O', result.errors);
          errors.push(...result.errors);
          continue;
        }

        if (result.unusedDependencies.length === 0) {
          debug('No unused dependencies found for %s', result.packageName);
          continue;
        }

        totalUnused += result.unusedDependencies.length;
        debug('Found %d unused dependencies', result.unusedDependencies.length);

        if (options.fix && result.fixedDependencies) {
          totalFixed += result.fixedDependencies.length;
          debug('Fixed %d dependencies', result.fixedDependencies.length);
        }
      }

      const summary = this.generateSummary(results.length, totalUnused, totalFixed, options.fix);

      return {
        success: true,
        data: {
          results,
          totalUnused,
          totalFixed,
          packagesScanned: results.length
        },
        errors: errors.length > 0 ? errors : undefined,
        summary
      };

    } catch (error: any) {
      debug('Unused command failed with error: %O', error);
      return {
        success: false,
        errors: [error.message]
      };
    }
  }

  protected displayData(data: any, options: CommandOptions): void {
    if (data && data.results) {
      for (const result of data.results) {
        if (result.unusedDependencies.length > 0) {
          if (options.fix && result.fixedDependencies) {
            console.log('   🔧 Fixed package.json:');
            result.fixedDependencies.forEach((dep: any) => {
              console.log(`     ✅ Removed ${dep.name} from ${dep.type}`);
            });
          } else {
            console.log(`   ❌ Unused dependencies (${result.unusedDependencies.length}):`);
            result.unusedDependencies.forEach((dep: any) => {
              console.log(`     - ${dep.name} (${dep.type})`);
            });
          }
        }
      }
    }
  }

  protected formatDataMarkdown(data: any, options: CommandOptions): string {
    const lines: string[] = [];
    
    if (data && data.results) {
      for (const result of data.results) {
        if (result.unusedDependencies.length > 0) {
          if (options.fix && result.fixedDependencies) {
            lines.push('**Fixed package.json:**');
            lines.push('');
            result.fixedDependencies.forEach((dep: any) => {
              lines.push(`- ✅ Removed ${dep.name} from ${dep.type}`);
            });
          } else {
            lines.push(`**Unused dependencies (${result.unusedDependencies.length}):**`);
            lines.push('');
            result.unusedDependencies.forEach((dep: any) => {
              lines.push(`- ${dep.name} (${dep.type})`);
            });
          }
        }
      }
    }
    
    return lines.join('\n');
  }

  private generateSummary(packagesScanned: number, totalUnused: number, totalFixed: number, fixMode: boolean): string {
    if (packagesScanned === 1) {
      if (totalUnused === 0) {
        return 'No unused dependencies found';
      }
      if (fixMode) {
        return `🔧 Fixed ${totalFixed} unused dependencies`;
      }
      return `❌ Found ${totalUnused} unused dependencies`;
    }

    let summary = `📊 Summary: ${packagesScanned} packages scanned, ${totalUnused} unused dependencies`;
    if (fixMode) {
      summary += `, ${totalFixed} dependencies removed`;
    }
    return summary;
  }
}
