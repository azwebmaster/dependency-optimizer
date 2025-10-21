import { Command } from 'commander';
import { AbstractCommand } from './base.js';
import { ConfigLoader } from '../config/index.js';
import { type PackageVersionSpec } from '../utils/packageVersionParser.js';
import type { CommandOptions, CommandResult } from './types.js';
import createDebug from 'debug';

const debug = createDebug('depoptimize:command:config');

export class ConfigCommand extends AbstractCommand {
  name = 'config';
  description = 'Show configuration information';
  hasPackageArgument = false;

  protected addSpecificOptions(command: Command): void {
    command
      .option('--json', 'Output configuration in JSON format');
  }

  protected applyDefaults(rawOptions: CommandOptions, config: any): CommandOptions {
    return {
      ...rawOptions,
      // Config command doesn't need complex defaults
      verbose: rawOptions.verbose ?? config.verbose ?? false
    };
  }

  async execute(options: CommandOptions, packageVersionSpec?: PackageVersionSpec): Promise<CommandResult> {
    try {
      debug('Starting config command with options: %O', options);
      debug('Project path: %s', options.path);

      const config = await ConfigLoader.loadConfig(options.path!, {
        configPath: options.config,
        searchUp: true
      });

      if (!config) {
        return {
          success: true,
          data: { config: null },
          summary: 'No configuration found'
        };
      }

      return {
        success: true,
        data: { config },
        summary: 'Configuration loaded successfully'
      };

    } catch (error: any) {
      debug('Config command failed with error: %O', error);
      return {
        success: false,
        errors: [error.message]
      };
    }
  }

  protected displayData(data: any, options: CommandOptions): void {
    if (options.json) {
      console.log(JSON.stringify(data.config, null, 2));
      return;
    }

    console.log('⚙️  Dependency Optimizer Configuration');
    console.log('=====================================\n');

    if (!data.config) {
      console.log('❌ No configuration found');
      console.log('\n💡 Configuration can be provided via:');
      console.log('   • .depoptimizer.json file in project root');
      console.log('   • depoptimizer field in package.json');
      console.log('   • Command line options');
      return;
    }

    console.log('📁 Configuration source: Found in project');
    console.log('');

    if (data.config.verbose !== undefined) console.log(`🔊 Verbose: ${data.config.verbose}`);
    if (data.config.json !== undefined) console.log(`📄 JSON output: ${data.config.json}`);
    if (data.config.prod !== undefined) console.log(`🏭 Production only: ${data.config.prod}`);
    if (data.config.parallel !== undefined) console.log(`⚡ Parallel execution: ${data.config.parallel}`);

    if (data.config.defaults) {
      console.log('\n🔧 Default settings:');
      Object.entries(data.config.defaults).forEach(([key, value]) => {
        console.log(`   ${key}: ${value}`);
      });
    }

    if (data.config.analyses) {
      console.log('\n📋 Analysis configurations:');
      Object.entries(data.config.analyses).forEach(([analysisName, analysisConfig]) => {
        console.log(`\n🔍 ${analysisName}:`);
        if ((analysisConfig as any)?.enabled !== undefined) {
          console.log(`   enabled: ${(analysisConfig as any).enabled}`);
        }
        Object.entries(analysisConfig || {}).forEach(([key, value]) => {
          if (key !== 'enabled') {
            console.log(`   ${key}: ${value}`);
          }
        });
      });
    }
  }

  protected formatDataMarkdown(data: any, options: CommandOptions): string {
    const lines: string[] = [];
    
    lines.push('## Configuration');
    lines.push('');
    
    if (!data.config) {
      lines.push('No configuration found.');
      lines.push('');
      lines.push('Configuration can be provided via:');
      lines.push('- `.depoptimizer.json` file in project root');
      lines.push('- `depoptimizer` field in package.json');
      lines.push('- Command line options');
      lines.push('');
      return lines.join('\n');
    }
    
    lines.push('Configuration loaded successfully.');
    lines.push('');
    
    if (data.config.verbose !== undefined) lines.push(`- **Verbose:** ${data.config.verbose}`);
    if (data.config.json !== undefined) lines.push(`- **JSON output:** ${data.config.json}`);
    if (data.config.prod !== undefined) lines.push(`- **Production only:** ${data.config.prod}`);
    if (data.config.parallel !== undefined) lines.push(`- **Parallel execution:** ${data.config.parallel}`);
    
    if (data.config.defaults) {
      lines.push('');
      lines.push('### Default Settings');
      lines.push('');
      Object.entries(data.config.defaults).forEach(([key, value]) => {
        lines.push(`- **${key}:** ${value}`);
      });
    }
    
    if (data.config.analyses) {
      lines.push('');
      lines.push('### Analysis Configurations');
      lines.push('');
      Object.entries(data.config.analyses).forEach(([analysisName, analysisConfig]) => {
        lines.push(`#### ${analysisName}`);
        lines.push('');
        if ((analysisConfig as any)?.enabled !== undefined) {
          lines.push(`- **enabled:** ${(analysisConfig as any).enabled}`);
        }
        Object.entries(analysisConfig || {}).forEach(([key, value]) => {
          if (key !== 'enabled') {
            lines.push(`- **${key}:** ${value}`);
          }
        });
        lines.push('');
      });
    }
    
    return lines.join('\n');
  }
}
