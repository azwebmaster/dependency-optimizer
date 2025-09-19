import depcheck from 'depcheck';
import * as fs from 'fs/promises';
import * as path from 'path';
import { globby } from 'globby';
import type {
  ScanOptions,
  ScanResult,
  UnusedDependency,
  PackageJson,
  WorkspaceConfig
} from './types.js';
import vitest from './special/vitest.js';
import createDebug from 'debug';

const debug = createDebug('depoptimize:scanner');

export class DependencyScanner {
  constructor(private options: ScanOptions = {}) {}

  async scan(projectPath: string = process.cwd()): Promise<ScanResult[]> {
    debug('Starting scan at path: %s', projectPath);
    debug('Scan options: %O', this.options);
    const results: ScanResult[] = [];

    if (this.options.recursive) {
      debug('Recursive scan enabled');
      const workspaces = await this.findWorkspaces(projectPath);
      debug('Found %d workspaces', workspaces.length);

      for (const workspace of workspaces) {
        debug('Checking workspace: %s', workspace);
        if (this.options.workspace && !workspace.includes(this.options.workspace)) {
          debug('Skipping workspace %s (filter: %s)', workspace, this.options.workspace);
          continue;
        }
        
        const result = await this.scanSinglePackage(workspace);
        results.push(result);
      }
    } else {
      debug('Single package scan');
      const result = await this.scanSinglePackage(projectPath);
      results.push(result);
    }

    debug('Scan complete, returning %d results', results.length);
    return results;
  }

  private async findWorkspaces(projectPath: string): Promise<string[]> {
    debug('Finding workspaces in: %s', projectPath);
    const workspaces: string[] = [projectPath]; // Always include root
    
    try {
      const packageJsonPath = path.join(projectPath, 'package.json');
      const packageContent = await fs.readFile(packageJsonPath, 'utf-8');
      const packageJson: PackageJson = JSON.parse(packageContent);
      
      // Handle npm/yarn workspaces
      let workspacePatterns: string[] = [];
      if (packageJson.workspaces) {
        debug('Found workspace configuration in package.json');
        if (Array.isArray(packageJson.workspaces)) {
          workspacePatterns = packageJson.workspaces;
        } else if (packageJson.workspaces.packages) {
          workspacePatterns = packageJson.workspaces.packages;
        }
      }
      
      // Find workspace packages
      debug('Workspace patterns: %O', workspacePatterns);
      for (const pattern of workspacePatterns) {
        const workspacePaths = await globby(pattern, {
          cwd: projectPath,
          onlyDirectories: true,
          absolute: true
        });
        
        for (const workspacePath of workspacePaths) {
          const hasPackageJson = await this.fileExists(path.join(workspacePath, 'package.json'));
          if (hasPackageJson) {
            debug('Found workspace package at: %s', workspacePath);
            workspaces.push(workspacePath);
          }
        }
      }
      
      // Check for Lerna configuration
      const lernaPath = path.join(projectPath, 'lerna.json');
      if (await this.fileExists(lernaPath)) {
        debug('Found Lerna configuration');
        try {
          const lernaContent = await fs.readFile(lernaPath, 'utf-8');
          const lernaConfig = JSON.parse(lernaContent);
          
          if (lernaConfig.packages) {
            for (const pattern of lernaConfig.packages) {
              const workspacePaths = await globby(pattern, {
                cwd: projectPath,
                onlyDirectories: true,
                absolute: true
              });
              
              for (const workspacePath of workspacePaths) {
                const hasPackageJson = await this.fileExists(path.join(workspacePath, 'package.json'));
                if (hasPackageJson && !workspaces.includes(workspacePath)) {
                  debug('Found Lerna package at: %s', workspacePath);
                  workspaces.push(workspacePath);
                }
              }
            }
          }
        } catch (error) {
          // Ignore lerna.json parsing errors
          debug('Failed to parse lerna.json: %O', error);
        }
      }
      
    } catch (error) {
      // If we can't read package.json, just scan the root
      debug('Failed to read package.json: %O', error);
    }
    
    debug('Total workspaces found: %d', workspaces.length);
    return workspaces;
  }

  private async scanSinglePackage(packagePath: string): Promise<ScanResult> {
    debug('Scanning single package at: %s', packagePath);
    const result: ScanResult = {
      packagePath,
      unusedDependencies: [],
      errors: []
    };

    try {
      // Read package.json to get package name
      const packageJsonPath = path.join(packagePath, 'package.json');
      if (await this.fileExists(packageJsonPath)) {
        debug('Reading package.json from: %s', packageJsonPath);
        const packageContent = await fs.readFile(packageJsonPath, 'utf-8');
        const packageJson: PackageJson = JSON.parse(packageContent);
        result.packageName = packageJson.name;
      } else {
        throw new Error(`No package.json found in ${packagePath}`);
      }

      // Configure depcheck options with auto-detected specials
      const depcheckOptions = await this.buildDepcheckOptions(packagePath);
      debug('Depcheck options: %O', depcheckOptions);

      if (this.options.verbose) {
        console.log(`🔍 Scanning ${packagePath}`);
        console.log(`   Using specials: ${depcheckOptions.specials?.map((s: any) => s.name || 'custom').join(', ') || 'none'}`);
      }

      // Run depcheck - use absolute path to ensure proper resolution
      const absolutePackagePath = path.resolve(packagePath);
      debug('Running depcheck on: %s', absolutePackagePath);
      const depcheckResult = await depcheck(absolutePackagePath, depcheckOptions);
      debug('Depcheck result - dependencies: %d, devDependencies: %d',
            depcheckResult.dependencies.length, depcheckResult.devDependencies.length);

      // Convert depcheck results to our format
      const unusedDeps: UnusedDependency[] = [];
      
      // Regular dependencies
      depcheckResult.dependencies.forEach(dep => {
        unusedDeps.push({ name: dep, type: 'dependencies' });
      });

      // Dev dependencies (if enabled)
      if (this.options.includeDevDependencies !== false) {
        depcheckResult.devDependencies.forEach(dep => {
          unusedDeps.push({ name: dep, type: 'devDependencies' });
        });
      }

      result.unusedDependencies = unusedDeps;
      debug('Found %d unused dependencies', unusedDeps.length);

      // Auto-fix if requested
      if (this.options.fix && unusedDeps.length > 0) {
        debug('Auto-fix enabled, fixing package.json');
        result.fixedDependencies = await this.fixPackageJson(packagePath, unusedDeps);
        debug('Fixed %d dependencies', result.fixedDependencies?.length || 0);
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      debug('Error scanning package: %s', errorMessage);
      result.errors = [errorMessage];
    }

    return result;
  }

  private async buildDepcheckOptions(packagePath: string) {
    debug('Building depcheck options for: %s', packagePath);
    const options: any = {
      // Use default parsers for optimal detection
      parsers: {
        '**/*.js': depcheck.parser.es6,
        '**/*.jsx': depcheck.parser.jsx,
        '**/*.ts': depcheck.parser.typescript,
        '**/*.tsx': depcheck.parser.typescript,
        '**/*.vue': depcheck.parser.vue
      },
      specials: [],
      // Skip certain files that might cause resolution issues
      ignoreBinPackage: false,
      skipMissing: false,
      ignoreMatches: [],
      ignorePatterns: [
        'sandbox',
        'dist',
        'bower_components',
        '.git',
        'node_modules',
      ]
    };

    // Auto-detect and enable appropriate specials
    const specials = [];
    debug('Auto-detecting project specials');

    // ESLint
    if (await this.fileExists(path.join(packagePath, '.eslintrc')) ||
        await this.fileExists(path.join(packagePath, '.eslintrc.js')) ||
        await this.fileExists(path.join(packagePath, '.eslintrc.json')) ||
        await this.fileExists(path.join(packagePath, 'eslint.config.js'))) {
      debug('Detected ESLint configuration');
      specials.push(depcheck.special.eslint);
    }

    // Babel
    if (await this.fileExists(path.join(packagePath, '.babelrc')) ||
        await this.fileExists(path.join(packagePath, 'babel.config.js')) ||
        await this.fileExists(path.join(packagePath, '.babelrc.js'))) {
      debug('Detected Babel configuration');
      specials.push(depcheck.special.babel);
    }

    // Webpack
    if (await this.fileExists(path.join(packagePath, 'webpack.config.js')) ||
        await this.fileExists(path.join(packagePath, 'webpack.config.ts'))) {
      debug('Detected Webpack configuration');
      specials.push(depcheck.special.webpack);
    }

    // Jest
    if (await this.fileExists(path.join(packagePath, 'jest.config.js')) ||
        await this.fileExists(path.join(packagePath, 'jest.config.ts'))) {
      debug('Detected Jest configuration');
      specials.push(depcheck.special.jest);
    }

    // Vitest
    if (await this.fileExists(path.join(packagePath, 'vitest.config.js')) ||
        await this.fileExists(path.join(packagePath, 'vitest.config.ts')) ||
        await this.fileExists(path.join(packagePath, 'vitest.config.mjs')) ||
        await this.fileExists(path.join(packagePath, 'vite.config.js')) ||
        await this.fileExists(path.join(packagePath, 'vite.config.ts')) ||
        await this.fileExists(path.join(packagePath, 'vite.config.mjs'))) {
      debug('Detected Vitest/Vite configuration');
      specials.push(vitest);
    }

    // Next.js
    if (await this.fileExists(path.join(packagePath, 'next.config.js'))) {
      debug('Detected Next.js configuration');
      specials.push(depcheck.special.webpack);
    }

    // Gatsby
    if (await this.fileExists(path.join(packagePath, 'gatsby-config.js'))) {
      debug('Detected Gatsby configuration');
      specials.push(depcheck.special.gatsby);
    }

    // Binary scripts
    debug('Adding binary scripts special');
    specials.push(depcheck.special.bin);

    options.specials = specials;
    debug('Total specials enabled: %d', specials.length);
    return options;
  }

  private async fixPackageJson(packagePath: string, unusedDeps: UnusedDependency[]): Promise<UnusedDependency[]> {
    debug('Fixing package.json at: %s', packagePath);
    debug('Removing %d unused dependencies', unusedDeps.length);
    const fixed: UnusedDependency[] = [];

    try {
      const packageJsonPath = path.join(packagePath, 'package.json');
      const packageContent = await fs.readFile(packageJsonPath, 'utf-8');
      const packageJson: PackageJson = JSON.parse(packageContent);

      // Remove unused dependencies
      debug('Current package.json structure loaded');
      for (const dep of unusedDeps) {
        const depSection = packageJson[dep.type];
        if (depSection && depSection[dep.name]) {
          debug('Removing %s from %s', dep.name, dep.type);
          delete depSection[dep.name];
          fixed.push(dep);
        }
      }

      // Write back to file, preserving formatting
      const updatedContent = JSON.stringify(packageJson, null, 2) + '\n';
      debug('Writing updated package.json');
      await fs.writeFile(packageJsonPath, updatedContent, 'utf-8');
      debug('Successfully fixed %d dependencies', fixed.length);

    } catch (error) {
      debug('Failed to fix package.json: %O', error);
      if (this.options.verbose) {
        console.warn(`Failed to fix ${packagePath}: ${error}`);
      }
    }

    return fixed;
  }

  private async fileExists(filePath: string): Promise<boolean> {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }
}