import depcheck from 'depcheck';
import * as fs from 'fs/promises';
import * as path from 'path';
import type {
  ScanOptions,
  ScanResult,
  UnusedDependency,
  PackageJson
} from './types.js';
import { DependencyMerger } from './utils/dependencyMerger.js';
import { WorkspaceDetector } from './utils/workspaceDetector.js';
import vitest from './special/vitest.js';
import createDebug from 'debug';

const debug = createDebug('depoptimize:scanner');

export class DependencyScanner {
  constructor(private options: ScanOptions = {}) {}

  async scan(projectPath: string = process.cwd()): Promise<ScanResult[]> {
    debug('Starting scan at path: %s', projectPath);
    debug('Scan options: %O', this.options);
    
    // Detect workspace and merge dependencies if needed
    const workspaceInfo = await WorkspaceDetector.detectWorkspace(projectPath);
    debug('Workspace info: %O', workspaceInfo);
    
    // If recursive is enabled and this is a workspace, scan all workspace members
    if (this.options.recursive && workspaceInfo.workspaceType && workspaceInfo.memberPackages.length > 1) {
      debug('Recursive scan enabled, scanning %d workspace members', workspaceInfo.memberPackages.length);
      const results: ScanResult[] = [];
      
      for (const memberPath of workspaceInfo.memberPackages) {
        debug('Scanning workspace member: %s', memberPath);
        const memberWorkspaceInfo = await WorkspaceDetector.detectWorkspace(memberPath);
        const result = await this.scanSinglePackage(memberPath, memberWorkspaceInfo);
        results.push(result);
      }
      
      debug('Scan complete, returning %d results', results.length);
      return results;
    }
    
    const result = await this.scanSinglePackage(projectPath, workspaceInfo);
    
    debug('Scan complete, returning 1 result');
    return [result];
  }


  private async scanSinglePackage(packagePath: string, workspaceInfo: any): Promise<ScanResult> {
    debug('Scanning single package at: %s', packagePath);
    const result: ScanResult = {
      packagePath,
      unusedDependencies: [],
      errors: []
    };

    try {
      // Read package.json to get package name
      const packageJsonPath = path.join(packagePath, 'package.json');
      let packageJson: PackageJson;
      if (await this.fileExists(packageJsonPath)) {
        debug('Reading package.json from: %s', packageJsonPath);
        const packageContent = await fs.readFile(packageJsonPath, 'utf-8');
        packageJson = JSON.parse(packageContent);
        result.packageName = packageJson.name;
      } else {
        throw new Error(`No package.json found in ${packagePath}`);
      }

      // If this is a workspace member, merge dependencies from root
      let effectivePackageJson = packageJson;
      if (workspaceInfo.isWorkspaceMember) {
        debug('Merging dependencies from workspace root');
        const mergedInfo = await DependencyMerger.mergeDependenciesWithWorkspaceRoot(packagePath, workspaceInfo);
        effectivePackageJson = mergedInfo.mergedDeps;
        debug('Merged dependencies: %d total deps, %d dev deps', 
              Object.keys(effectivePackageJson.dependencies || {}).length,
              Object.keys(effectivePackageJson.devDependencies || {}).length);
      }

      // Configure depcheck options with auto-detected specials
      const depcheckOptions = await this.buildDepcheckOptions(packagePath);
      debug('Depcheck options: %O', depcheckOptions);

      if (this.options.verbose) {
        console.log(`🔍 Scanning ${packagePath}`);
        if (workspaceInfo.isWorkspaceMember) {
          console.log(`   Workspace member (root: ${workspaceInfo.rootPath})`);
        }
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