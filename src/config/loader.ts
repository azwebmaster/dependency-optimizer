import * as fs from 'fs';
import * as path from 'path';
import type { DepOptimizerConfig, ConfigLoaderOptions } from './types.js';
import createDebug from 'debug';

const debug = createDebug('depoptimize:config');

export class ConfigLoader {
  private static readonly CONFIG_FILENAMES = [
    '.depoptimizer.json',
    '.depoptimizer.js',
    '.depoptimizer.mjs',
    'depoptimizer.json',
    'depoptimizer.js',
    'depoptimizer.mjs'
  ];

  private static readonly PACKAGE_JSON_KEY = 'depoptimizer';

  /**
   * Load configuration from package.json or .depoptimizer.json file
   */
  static async loadConfig(projectPath: string, options: ConfigLoaderOptions = {}): Promise<DepOptimizerConfig | null> {
    debug('Loading configuration for project: %s', projectPath);
    
    try {
      // Try to load from explicit config file first
      if (options.configPath) {
        const config = await this.loadFromFile(options.configPath);
        if (config) {
          debug('Loaded configuration from explicit path: %s', options.configPath);
          return config;
        }
      }

      // Search for config files in project directory and parent directories
      if (options.searchUp !== false) {
        const config = await this.searchForConfigFile(projectPath);
        if (config) {
          debug('Loaded configuration from config file: %s', config.filePath);
          return config.config;
        }
      }

      // Try to load from package.json
      const packageJsonPath = options.packageJsonPath || path.join(projectPath, 'package.json');
      const packageConfig = await this.loadFromPackageJson(packageJsonPath);
      if (packageConfig) {
        debug('Loaded configuration from package.json: %s', packageJsonPath);
        return packageConfig;
      }

      debug('No configuration found');
      return null;
    } catch (error: any) {
      debug('Error loading configuration: %O', error);
      return null;
    }
  }

  /**
   * Load configuration from a specific file
   */
  private static async loadFromFile(filePath: string): Promise<DepOptimizerConfig | null> {
    try {
      if (!fs.existsSync(filePath)) {
        return null;
      }

      const ext = path.extname(filePath).toLowerCase();
      const content = fs.readFileSync(filePath, 'utf8');

      if (ext === '.json') {
        return JSON.parse(content);
      } else if (ext === '.js' || ext === '.mjs') {
        // For JS files, we'd need to evaluate them, but for now we'll just read as JSON
        // In a real implementation, you might want to use a safe eval or require
        debug('JS config files not yet supported, treating as JSON');
        return JSON.parse(content);
      }

      return null;
    } catch (error: any) {
      debug('Error loading config file %s: %O', filePath, error);
      return null;
    }
  }

  /**
   * Search for configuration files in directory and parent directories
   */
  private static async searchForConfigFile(startPath: string): Promise<{ config: DepOptimizerConfig; filePath: string } | null> {
    let currentPath = startPath;
    const rootPath = path.parse(startPath).root;

    while (currentPath !== rootPath) {
      for (const filename of this.CONFIG_FILENAMES) {
        const configPath = path.join(currentPath, filename);
        const config = await this.loadFromFile(configPath);
        if (config) {
          return { config, filePath: configPath };
        }
      }

      // Move up one directory
      const parentPath = path.dirname(currentPath);
      if (parentPath === currentPath) {
        break; // Reached root
      }
      currentPath = parentPath;
    }

    return null;
  }

  /**
   * Load configuration from package.json
   */
  private static async loadFromPackageJson(packageJsonPath: string): Promise<DepOptimizerConfig | null> {
    try {
      if (!fs.existsSync(packageJsonPath)) {
        return null;
      }

      const content = fs.readFileSync(packageJsonPath, 'utf8');
      const packageJson = JSON.parse(content);

      if (packageJson[this.PACKAGE_JSON_KEY]) {
        return packageJson[this.PACKAGE_JSON_KEY];
      }

      return null;
    } catch (error: any) {
      debug('Error loading package.json config: %O', error);
      return null;
    }
  }

  /**
   * Get configuration for a specific command
   */
  static getCommandConfig(config: DepOptimizerConfig | null, commandName: string): any {
    if (!config) {
      return {};
    }
    
    return (config as any)[commandName] || {};
  }
}
