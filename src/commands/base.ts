import { Command } from 'commander';
import type { BaseCommand, CommandOptions, CommandResult } from './types.js';
import { ConfigLoader } from '../config/loader.js';
import type { DepOptimizerConfig } from '../config/types.js';
import { parsePackageVersionSpec, type PackageVersionSpec } from '../utils/packageVersionParser.js';
import createDebug from 'debug';

const debug = createDebug('depoptimize:command');

export abstract class AbstractCommand implements BaseCommand {
  abstract name: string;
  abstract description: string;
  abstract hasPackageArgument: boolean;

  register(program: Command): void {
    const command = program
      .command(this.name)
      .description(this.description)
      .option('--path <path>', 'Path to project directory', process.cwd())
      .option('--output <format>', 'Output format: console, json, or markdown', 'console')
      .option('--verbose', 'Enable verbose output')
      .option('--prod', 'Only include production dependencies (exclude dev dependencies)')
      .option('--config <path>', 'Path to configuration file')
      .option('--no-config', 'Disable configuration file loading');

    // Add package argument for specific commands
    if (this.hasPackageArgument) {
      command.argument('[package]', 'Package name to analyze (supports package@version format)');
    }

    // Add command-specific options
    this.addSpecificOptions(command);

    command.action(async (...args) => {
      try {
        // Handle different parameter patterns based on whether package argument is used
        const packageSpec = this.hasPackageArgument ? args[0] : undefined;
        const rawOptions = this.hasPackageArgument ? args[1] : args[0];
        
        const projectPath = rawOptions.path;
        debug(`Starting ${this.name} command with raw options: %O`, rawOptions);
        debug('Project path: %s', projectPath);
        
        // Parse package specification if provided
        let packageVersionSpec: PackageVersionSpec | undefined;
        if (this.hasPackageArgument && packageSpec) {
          try {
            packageVersionSpec = parsePackageVersionSpec(packageSpec);
            debug('Package spec: %O', packageVersionSpec);
          } catch (error: any) {
            console.error(`❌ Invalid package specification: ${packageSpec}`);
            console.error(`   ${error.message}`);
            process.exit(1);
          }
        }

        // Load configuration and apply defaults
        const config = await this.loadConfig(rawOptions, projectPath || process.cwd());
        const options = this.applyDefaults(rawOptions, config);
        debug(`Final options with defaults: %O`, options);

        // Validate output format
        const validOutputFormats = ['console', 'json', 'markdown'];
        if (options.output && !validOutputFormats.includes(options.output)) {
          console.error(`❌ Invalid output format: ${options.output}`);
          console.error(`   Valid formats: ${validOutputFormats.join(', ')}`);
          process.exit(1);
        }

        const result = await this.execute(options, packageVersionSpec);

        // Handle different output formats
        switch (options.output) {
          case 'json':
            console.log(JSON.stringify(result, null, 2));
            return;
            
          case 'markdown':
            console.log(this.formatMarkdownOutput(result, options));
            return;
            
          case 'console':
          default:
            this.displayConsoleOutput(result, options);
            break;
        }

      } catch (error: any) {
        debug(`${this.name} command failed with error: %O`, error);
        console.error(`\n❌ ${this.description} failed:`);
        console.error(`   ${error.message}`);
        process.exit(1);
      }
    });
  }

  abstract execute(options: CommandOptions, packageVersionSpec?: PackageVersionSpec): Promise<CommandResult>;

  protected abstract addSpecificOptions(command: Command): void;

  /**
   * Apply command-specific defaults and merge with config
   * Each command should implement this to handle its own defaulting logic
   */
  protected abstract applyDefaults(rawOptions: CommandOptions, config: any): CommandOptions;

  protected displayConsoleOutput(result: CommandResult, options: CommandOptions): void {
    console.log(`🔍 ${this.description}`);
    console.log('==============================\n');

    if (result.success) {
      console.log(`✅ ${result.summary || 'Command completed successfully'}`);
      if (result.data) {
        this.displayData(result.data, options);
      }
    } else {
      console.log(`❌ Command failed: ${result.errors?.join(', ')}`);
    }
  }

  protected abstract displayData(data: any, options: CommandOptions): void;

  protected formatMarkdownOutput(result: CommandResult, options: CommandOptions): string {
    const lines: string[] = [];
    
    // Header
    lines.push(`# ${this.description}`);
    lines.push('');
    
    // Summary
    const statusIcon = result.success ? '✅' : '❌';
    lines.push(`## Summary`);
    lines.push('');
    lines.push(`${statusIcon} ${result.summary || (result.success ? 'Command completed successfully' : 'Command failed')}`);
    lines.push('');
    
    // Data
    if (result.data) {
      const markdownContent = this.formatDataMarkdown(result.data, options);
      if (markdownContent) {
        lines.push('## Results');
        lines.push('');
        lines.push(markdownContent);
        lines.push('');
      }
    }
    
    return lines.join('\n');
  }

  protected abstract formatDataMarkdown(data: any, options: CommandOptions): string;

  /**
   * Load configuration for this command
   */
  protected async loadConfig(rawOptions: CommandOptions, projectPath: string): Promise<any> {
    // Skip config loading if explicitly disabled
    if (rawOptions.noConfig) {
      debug('Configuration loading disabled via --no-config');
      return {};
    }

    try {
      // Load configuration
      const config = await ConfigLoader.loadConfig(projectPath, {
        configPath: rawOptions.config,
        searchUp: true
      });

      if (config) {
        debug('Loaded configuration: %O', config);
        
        // Get command-specific config
        const commandConfig = ConfigLoader.getCommandConfig(config, this.name);
        debug('Command config for %s: %O', this.name, commandConfig);

        return commandConfig;
      } else {
        debug('No configuration found');
        return {};
      }
    } catch (error: any) {
      debug('Error loading configuration: %O', error);
      console.warn(`⚠️  Warning: Failed to load configuration: ${error.message}`);
      return {};
    }
  }
}
