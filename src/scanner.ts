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

export class DependencyScanner {
  constructor(private options: ScanOptions = {}) {}

  async scan(projectPath: string = process.cwd()): Promise<ScanResult[]> {
    const results: ScanResult[] = [];
    
    if (this.options.recursive) {
      const workspaces = await this.findWorkspaces(projectPath);
      
      for (const workspace of workspaces) {
        if (this.options.workspace && !workspace.includes(this.options.workspace)) {
          continue;
        }
        
        const result = await this.scanSinglePackage(workspace);
        results.push(result);
      }
    } else {
      const result = await this.scanSinglePackage(projectPath);
      results.push(result);
    }

    return results;
  }

  private async findWorkspaces(projectPath: string): Promise<string[]> {
    const workspaces: string[] = [projectPath]; // Always include root
    
    try {
      const packageJsonPath = path.join(projectPath, 'package.json');
      const packageContent = await fs.readFile(packageJsonPath, 'utf-8');
      const packageJson: PackageJson = JSON.parse(packageContent);
      
      // Handle npm/yarn workspaces
      let workspacePatterns: string[] = [];
      if (packageJson.workspaces) {
        if (Array.isArray(packageJson.workspaces)) {
          workspacePatterns = packageJson.workspaces;
        } else if (packageJson.workspaces.packages) {
          workspacePatterns = packageJson.workspaces.packages;
        }
      }
      
      // Find workspace packages
      for (const pattern of workspacePatterns) {
        const workspacePaths = await globby(pattern, {
          cwd: projectPath,
          onlyDirectories: true,
          absolute: true
        });
        
        for (const workspacePath of workspacePaths) {
          const hasPackageJson = await this.fileExists(path.join(workspacePath, 'package.json'));
          if (hasPackageJson) {
            workspaces.push(workspacePath);
          }
        }
      }
      
      // Check for Lerna configuration
      const lernaPath = path.join(projectPath, 'lerna.json');
      if (await this.fileExists(lernaPath)) {
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
                  workspaces.push(workspacePath);
                }
              }
            }
          }
        } catch {
          // Ignore lerna.json parsing errors
        }
      }
      
    } catch {
      // If we can't read package.json, just scan the root
    }
    
    return workspaces;
  }

  private async scanSinglePackage(packagePath: string): Promise<ScanResult> {
    const result: ScanResult = {
      packagePath,
      unusedDependencies: [],
      errors: []
    };

    try {
      // Read package.json to get package name
      const packageJsonPath = path.join(packagePath, 'package.json');
      if (await this.fileExists(packageJsonPath)) {
        const packageContent = await fs.readFile(packageJsonPath, 'utf-8');
        const packageJson: PackageJson = JSON.parse(packageContent);
        result.packageName = packageJson.name;
      } else {
        throw new Error(`No package.json found in ${packagePath}`);
      }

      // Configure depcheck options with auto-detected specials
      const depcheckOptions = await this.buildDepcheckOptions(packagePath);

      if (this.options.verbose) {
        console.log(`🔍 Scanning ${packagePath}`);
        console.log(`   Using specials: ${depcheckOptions.specials?.map((s: any) => s.name || 'custom').join(', ') || 'none'}`);
      }

      // Run depcheck - use absolute path to ensure proper resolution
      const absolutePackagePath = path.resolve(packagePath);
      const depcheckResult = await depcheck(absolutePackagePath, depcheckOptions);

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

      // Auto-fix if requested
      if (this.options.fix && unusedDeps.length > 0) {
        result.fixedDependencies = await this.fixPackageJson(packagePath, unusedDeps);
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      result.errors = [errorMessage];
    }

    return result;
  }

  private async buildDepcheckOptions(packagePath: string) {
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

    // ESLint
    if (await this.fileExists(path.join(packagePath, '.eslintrc')) ||
        await this.fileExists(path.join(packagePath, '.eslintrc.js')) ||
        await this.fileExists(path.join(packagePath, '.eslintrc.json')) ||
        await this.fileExists(path.join(packagePath, 'eslint.config.js'))) {
      specials.push(depcheck.special.eslint);
    }

    // Babel
    if (await this.fileExists(path.join(packagePath, '.babelrc')) ||
        await this.fileExists(path.join(packagePath, 'babel.config.js')) ||
        await this.fileExists(path.join(packagePath, '.babelrc.js'))) {
      specials.push(depcheck.special.babel);
    }

    // Webpack
    if (await this.fileExists(path.join(packagePath, 'webpack.config.js')) ||
        await this.fileExists(path.join(packagePath, 'webpack.config.ts'))) {
      specials.push(depcheck.special.webpack);
    }

    // Jest
    if (await this.fileExists(path.join(packagePath, 'jest.config.js')) ||
        await this.fileExists(path.join(packagePath, 'jest.config.ts'))) {
      specials.push(depcheck.special.jest);
    }

    // Vitest
    if (await this.fileExists(path.join(packagePath, 'vitest.config.js')) ||
        await this.fileExists(path.join(packagePath, 'vitest.config.ts')) ||
        await this.fileExists(path.join(packagePath, 'vitest.config.mjs')) ||
        await this.fileExists(path.join(packagePath, 'vite.config.js')) ||
        await this.fileExists(path.join(packagePath, 'vite.config.ts')) ||
        await this.fileExists(path.join(packagePath, 'vite.config.mjs'))) {
      specials.push(vitest);
    }

    // Next.js
    if (await this.fileExists(path.join(packagePath, 'next.config.js'))) {
      specials.push(depcheck.special.webpack);
    }

    // Gatsby
    if (await this.fileExists(path.join(packagePath, 'gatsby-config.js'))) {
      specials.push(depcheck.special.gatsby);
    }

    // Binary scripts
    specials.push(depcheck.special.bin);

    options.specials = specials;
    return options;
  }

  private async fixPackageJson(packagePath: string, unusedDeps: UnusedDependency[]): Promise<UnusedDependency[]> {
    const fixed: UnusedDependency[] = [];
    
    try {
      const packageJsonPath = path.join(packagePath, 'package.json');
      const packageContent = await fs.readFile(packageJsonPath, 'utf-8');
      const packageJson: PackageJson = JSON.parse(packageContent);

      // Remove unused dependencies
      for (const dep of unusedDeps) {
        const depSection = packageJson[dep.type];
        if (depSection && depSection[dep.name]) {
          delete depSection[dep.name];
          fixed.push(dep);
        }
      }

      // Write back to file, preserving formatting
      const updatedContent = JSON.stringify(packageJson, null, 2) + '\n';
      await fs.writeFile(packageJsonPath, updatedContent, 'utf-8');

    } catch (error) {
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