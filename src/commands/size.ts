import { Command } from 'commander';
import { AbstractCommand } from './base.js';
import { PackageSizeAnalyzer } from '../sizeAnalyzer.js';
import { type PackageVersionSpec } from '../utils/packageVersionParser.js';
import type { CommandOptions, CommandResult } from './types.js';
import type { SizeAnalyzerOptions } from '../sizeAnalyzer.js';
import createDebug from 'debug';

const debug = createDebug('depoptimize:command:size');

export class SizeCommand extends AbstractCommand {
  name = 'size';
  description = 'Analyze package sizes by traversing dependencies';
  hasPackageArgument = true;

  protected addSpecificOptions(command: Command): void {
    command
      .option('--max-depth <depth>', 'Maximum dependency depth to traverse', '3')
      .option('--no-dependencies', 'Only show direct dependencies without traversing');
  }

  protected applyDefaults(rawOptions: CommandOptions, config: any): CommandOptions {
    return {
      ...rawOptions,
      // Apply command-specific defaults
      maxDepth: rawOptions.maxDepth ?? config.maxDepth ?? 3,
      showDependencies: rawOptions.dependencies !== false ? (config.showDependencies ?? true) : false,
      summary: rawOptions.summary ?? config.summary ?? false,
      includeDevDependencies: rawOptions.prod !== undefined ? !rawOptions.prod : (config.includeDevDependencies ?? true),
      verbose: rawOptions.verbose ?? config.verbose ?? false
    };
  }

  async execute(options: CommandOptions, packageVersionSpec?: PackageVersionSpec): Promise<CommandResult> {
    try {
      debug('Starting size command with options: %O', options);
      debug('Project path: %s', options.path);
      debug('Package spec: %O', packageVersionSpec);

      const analyzerOptions: SizeAnalyzerOptions = {
        showDependencies: options.showDependencies,
        maxDepth: options.maxDepth,
        includeDevDependencies: options.includeDevDependencies
      };

      const analyzer = new PackageSizeAnalyzer(analyzerOptions);
      const packageName = packageVersionSpec?.name;
      const result = await analyzer.analyzePackageSize(options.path!, packageName);

      const summary = this.generateSummary(result, options, packageVersionSpec);

      return {
        success: true,
        data: {
          result,
          treeView: analyzer.generateTreeView(result),
          summary: options.summary ? analyzer.generateSummary(result) : undefined
        },
        summary
      };

    } catch (error: any) {
      debug('Size command failed with error: %O', error);
      return {
        success: false,
        errors: [error.message]
      };
    }
  }

  protected displayData(data: any, options: CommandOptions): void {
    if (data && data.treeView) {
      console.log('   📏 Package Size Tree:');
      console.log(data.treeView.split('\n').map((line: string) => `     ${line}`).join('\n'));
    }
  }

  protected formatDataMarkdown(data: any, options: CommandOptions): string {
    const lines: string[] = [];
    
    if (data && data.treeView) {
      lines.push('**Package Size Tree:**');
      lines.push('');
      lines.push('```');
      lines.push(data.treeView);
      lines.push('```');
      lines.push('');
    }
    
    return lines.join('\n');
  }

  private generateSummary(result: any, options: CommandOptions, packageVersionSpec?: PackageVersionSpec): string {
    const pkgName = packageVersionSpec 
      ? (packageVersionSpec.version ? `${packageVersionSpec.name}@${packageVersionSpec.version}` : packageVersionSpec.name)
      : 'project';
    return `📏 ${pkgName}: ${this.formatSize(result.size)} total size`;
  }

  private formatSize(bytes: number): string {
    const sizes = ['B', 'KB', 'MB', 'GB'];
    if (bytes === 0) return '0 B';
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
  }
}
