import { Command } from 'commander';
import { AbstractCommand } from './base.js';
import { type PackageVersionSpec } from '../utils/packageVersionParser.js';
import type { CommandOptions, CommandResult } from './types.js';
import createDebug from 'debug';

const debug = createDebug('depoptimize:command:examples');

export class ExamplesCommand extends AbstractCommand {
  name = 'examples';
  description = 'Show usage examples';
  hasPackageArgument = false;

  protected addSpecificOptions(command: Command): void {
    // No specific options for examples command
  }

  protected applyDefaults(rawOptions: CommandOptions, config: any): CommandOptions {
    return {
      ...rawOptions,
      // Examples command doesn't need complex defaults
      verbose: rawOptions.verbose ?? config.verbose ?? false
    };
  }

  async execute(options: CommandOptions, packageVersionSpec?: PackageVersionSpec): Promise<CommandResult> {
    try {
      debug('Starting examples command');

      const examples = this.generateExamples();

      return {
        success: true,
        data: { examples },
        summary: 'Usage examples displayed'
      };

    } catch (error: any) {
      debug('Examples command failed with error: %O', error);
      return {
        success: false,
        errors: [error.message]
      };
    }
  }

  protected displayData(data: any, options: CommandOptions): void {
    console.log('📚 Dependency Optimizer Examples');
    console.log('=================================\n');

    console.log('🔍 Run individual commands:');
    console.log('   dependency-optimizer unused');
    console.log('   dependency-optimizer duplicates');
    console.log('   dependency-optimizer size');
    console.log('   dependency-optimizer tree');
    console.log('   dependency-optimizer devcheck\n');

    console.log('🔧 Run with fixes:');
    console.log('   dependency-optimizer unused --fix');
    console.log('   dependency-optimizer devcheck --fix\n');

    console.log('📁 Run in specific directory:');
    console.log('   dependency-optimizer unused --path /path/to/project\n');

    console.log('📄 JSON output:');
    console.log('   dependency-optimizer duplicates --output json\n');

    console.log('📝 Markdown output:');
    console.log('   dependency-optimizer size --output markdown\n');

    console.log('🎯 Analyze specific package:');
    console.log('   dependency-optimizer size typescript');
    console.log('   dependency-optimizer tree typescript\n');

    console.log('⚙️  Configuration:');
    console.log('   dependency-optimizer config');
    console.log('   dependency-optimizer config --json\n');

    console.log('📁 Use custom config file:');
    console.log('   dependency-optimizer unused --config ./my-config.json\n');

    console.log('🚫 Disable configuration:');
    console.log('   dependency-optimizer unused --no-config\n');

    console.log('💡 Tips:');
    console.log('   • Use individual commands for specific analysis (unused, duplicates, size, etc.)');
    console.log('   • Use --fix to automatically fix issues where possible');
    console.log('   • Use --output json for programmatic consumption');
    console.log('   • Use --output markdown for documentation and reports');
    console.log('   • Use --output console for interactive use (default)');
    console.log('   • Use --prod to exclude dev dependencies');
    console.log('   • Create .depoptimizer.json for project-specific settings');
    console.log('   • Add "depoptimizer" field to package.json for configuration');
  }

  protected formatDataMarkdown(data: any, options: CommandOptions): string {
    const lines: string[] = [];
    
    lines.push('# Dependency Optimizer Examples');
    lines.push('');
    
    lines.push('## Individual Commands');
    lines.push('');
    lines.push('```bash');
    lines.push('dependency-optimizer unused');
    lines.push('dependency-optimizer duplicates');
    lines.push('dependency-optimizer size');
    lines.push('dependency-optimizer tree');
    lines.push('dependency-optimizer devcheck');
    lines.push('```');
    lines.push('');
    
    lines.push('## Run with Fixes');
    lines.push('');
    lines.push('```bash');
    lines.push('dependency-optimizer unused --fix');
    lines.push('dependency-optimizer devcheck --fix');
    lines.push('```');
    lines.push('');
    
    lines.push('## Run in Specific Directory');
    lines.push('');
    lines.push('```bash');
    lines.push('dependency-optimizer unused --path /path/to/project');
    lines.push('```');
    lines.push('');
    
    lines.push('## JSON Output');
    lines.push('');
    lines.push('```bash');
    lines.push('dependency-optimizer duplicates --output json');
    lines.push('```');
    lines.push('');
    
    lines.push('## Markdown Output');
    lines.push('');
    lines.push('```bash');
    lines.push('dependency-optimizer size --output markdown');
    lines.push('```');
    lines.push('');
    
    lines.push('## Analyze Specific Package');
    lines.push('');
    lines.push('```bash');
    lines.push('dependency-optimizer size typescript');
    lines.push('dependency-optimizer tree typescript');
    lines.push('```');
    lines.push('');
    
    lines.push('## Configuration');
    lines.push('');
    lines.push('```bash');
    lines.push('dependency-optimizer config');
    lines.push('dependency-optimizer config --json');
    lines.push('```');
    lines.push('');
    
    lines.push('## Use Custom Config File');
    lines.push('');
    lines.push('```bash');
    lines.push('dependency-optimizer unused --config ./my-config.json');
    lines.push('```');
    lines.push('');
    
    lines.push('## Disable Configuration');
    lines.push('');
    lines.push('```bash');
    lines.push('dependency-optimizer unused --no-config');
    lines.push('```');
    lines.push('');
    
    lines.push('## Tips');
    lines.push('');
    lines.push('- Use individual commands for specific analysis (unused, duplicates, size, etc.)');
    lines.push('- Use `--fix` to automatically fix issues where possible');
    lines.push('- Use `--output json` for programmatic consumption');
    lines.push('- Use `--output markdown` for documentation and reports');
    lines.push('- Use `--output console` for interactive use (default)');
    lines.push('- Use `--prod` to exclude dev dependencies');
    lines.push('- Create `.depoptimizer.json` for project-specific settings');
    lines.push('- Add "depoptimizer" field to package.json for configuration');
    
    return lines.join('\n');
  }

  private generateExamples(): string[] {
    return [
      'dependency-optimizer unused',
      'dependency-optimizer duplicates',
      'dependency-optimizer size',
      'dependency-optimizer tree',
      'dependency-optimizer devcheck',
      'dependency-optimizer unused --fix',
      'dependency-optimizer devcheck --fix',
      'dependency-optimizer unused --path /path/to/project',
      'dependency-optimizer duplicates --output json',
      'dependency-optimizer size --output markdown',
      'dependency-optimizer size typescript',
      'dependency-optimizer tree typescript',
      'dependency-optimizer config',
      'dependency-optimizer config --json',
      'dependency-optimizer unused --config ./my-config.json',
      'dependency-optimizer unused --no-config'
    ];
  }
}
