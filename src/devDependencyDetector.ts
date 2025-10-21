import * as fs from 'fs/promises';
import * as path from 'path';
import type { DevCheckOptions, DevCheckResult, MisplacedDependency, PackageJson } from './types.js';
import createDebug from 'debug';

const debug = createDebug('depoptimize:devcheck');

interface DevDependencyPattern {
  pattern: string | RegExp;
  reason: string;
  category: string;
}

interface DevCheckOptionsWithIncludeExclude extends DevCheckOptions {
  include?: string[];
  exclude?: string[];
}

export class DevDependencyDetector {
  private readonly devPatterns: DevDependencyPattern[] = [
    // Testing frameworks
    { pattern: 'vitest', reason: 'Testing framework', category: 'testing' },
    { pattern: 'jest', reason: 'Testing framework', category: 'testing' },
    { pattern: 'mocha', reason: 'Testing framework', category: 'testing' },
    { pattern: 'chai', reason: 'Testing assertion library', category: 'testing' },
    { pattern: 'jasmine', reason: 'Testing framework', category: 'testing' },
    { pattern: 'karma', reason: 'Test runner', category: 'testing' },
    { pattern: 'ava', reason: 'Testing framework', category: 'testing' },
    { pattern: 'tape', reason: 'Testing framework', category: 'testing' },
    { pattern: /^@jest\//, reason: 'Jest testing utilities', category: 'testing' },
    { pattern: 'jest-environment-jsdom', reason: 'Jest DOM environment', category: 'testing' },
    { pattern: 'jest-environment-node', reason: 'Jest Node environment', category: 'testing' },
    
    // Type systems
    { pattern: 'typescript', reason: 'TypeScript compiler', category: 'types' },
    { pattern: /^@types\//, reason: 'TypeScript type definitions', category: 'types' },
    { pattern: 'ts-node', reason: 'TypeScript execution engine', category: 'types' },
    { pattern: 'tsx', reason: 'TypeScript execution engine', category: 'types' },
    { pattern: 'ts-jest', reason: 'TypeScript Jest transformer', category: 'types' },
    
    // Build tools
    { pattern: 'webpack', reason: 'Module bundler', category: 'build' },
    { pattern: /^webpack-/, reason: 'Webpack plugin/loader', category: 'build' },
    { pattern: 'rollup', reason: 'Module bundler', category: 'build' },
    { pattern: /^@rollup\//, reason: 'Rollup plugin', category: 'build' },
    { pattern: /^rollup-plugin-/, reason: 'Rollup plugin', category: 'build' },
    { pattern: 'vite', reason: 'Build tool', category: 'build' },
    { pattern: /^vite-plugin-/, reason: 'Vite plugin', category: 'build' },
    { pattern: 'parcel', reason: 'Module bundler', category: 'build' },
    { pattern: 'esbuild', reason: 'JavaScript bundler', category: 'build' },
    { pattern: 'babel', reason: 'JavaScript compiler', category: 'build' },
    { pattern: /^@babel\//, reason: 'Babel plugin/preset', category: 'build' },
    { pattern: /^babel-plugin-/, reason: 'Babel plugin', category: 'build' },
    { pattern: /^babel-preset-/, reason: 'Babel preset', category: 'build' },
    { pattern: /^babel-loader/, reason: 'Babel Webpack loader', category: 'build' },
    { pattern: 'terser', reason: 'JavaScript minifier', category: 'build' },
    { pattern: 'uglify-js', reason: 'JavaScript minifier', category: 'build' },
    { pattern: 'swc', reason: 'JavaScript/TypeScript compiler', category: 'build' },
    { pattern: /^@swc\//, reason: 'SWC compiler plugin', category: 'build' },
    
    // Linters and formatters
    { pattern: 'eslint', reason: 'JavaScript linter', category: 'linting' },
    { pattern: /^eslint-/, reason: 'ESLint plugin/config', category: 'linting' },
    { pattern: /^@eslint\//, reason: 'ESLint official plugin', category: 'linting' },
    { pattern: 'prettier', reason: 'Code formatter', category: 'linting' },
    { pattern: /^prettier-plugin-/, reason: 'Prettier plugin', category: 'linting' },
    { pattern: 'stylelint', reason: 'CSS linter', category: 'linting' },
    { pattern: /^stylelint-/, reason: 'Stylelint plugin/config', category: 'linting' },
    { pattern: 'tslint', reason: 'TypeScript linter (deprecated)', category: 'linting' },
    
    // Dev servers
    { pattern: 'nodemon', reason: 'Development server with auto-restart', category: 'dev-server' },
    { pattern: 'concurrently', reason: 'Run multiple commands concurrently', category: 'dev-server' },
    { pattern: 'npm-run-all', reason: 'Run multiple npm scripts', category: 'dev-server' },
    { pattern: 'serve', reason: 'Static file server', category: 'dev-server' },
    { pattern: 'http-server', reason: 'Static file server', category: 'dev-server' },
    
    // Documentation
    { pattern: 'typedoc', reason: 'TypeScript documentation generator', category: 'documentation' },
    { pattern: 'jsdoc', reason: 'JavaScript documentation generator', category: 'documentation' },
    { pattern: 'storybook', reason: 'UI component explorer', category: 'documentation' },
    { pattern: /^@storybook\//, reason: 'Storybook addon/framework', category: 'documentation' },
    { pattern: 'docusaurus', reason: 'Documentation site generator', category: 'documentation' },
    
    // Code coverage
    { pattern: 'nyc', reason: 'Code coverage tool', category: 'coverage' },
    { pattern: 'c8', reason: 'Code coverage tool', category: 'coverage' },
    { pattern: 'istanbul', reason: 'Code coverage tool', category: 'coverage' },
    { pattern: /^@vitest\/coverage-/, reason: 'Vitest coverage provider', category: 'coverage' },
    { pattern: 'jest-coverage-badges', reason: 'Coverage badge generator', category: 'coverage' },
    
    // Git hooks and commit tools
    { pattern: 'husky', reason: 'Git hooks manager', category: 'git-hooks' },
    { pattern: 'lint-staged', reason: 'Run linters on staged files', category: 'git-hooks' },
    { pattern: 'commitlint', reason: 'Commit message linter', category: 'git-hooks' },
    { pattern: /^@commitlint\//, reason: 'Commitlint config/plugin', category: 'git-hooks' },
    { pattern: 'standard-version', reason: 'Versioning and changelog', category: 'git-hooks' },
    { pattern: 'semantic-release', reason: 'Automated versioning', category: 'git-hooks' },
    
    // CSS processors
    { pattern: 'sass', reason: 'CSS preprocessor', category: 'css' },
    { pattern: 'node-sass', reason: 'CSS preprocessor (deprecated)', category: 'css' },
    { pattern: 'less', reason: 'CSS preprocessor', category: 'css' },
    { pattern: 'postcss', reason: 'CSS processor', category: 'css' },
    { pattern: /^postcss-/, reason: 'PostCSS plugin', category: 'css' },
    { pattern: 'autoprefixer', reason: 'CSS vendor prefix tool', category: 'css' },
    { pattern: 'tailwindcss', reason: 'CSS framework (dev mode)', category: 'css' },
    { pattern: 'cssnano', reason: 'CSS minifier', category: 'css' },
    { pattern: 'sass-loader', reason: 'Sass Webpack loader', category: 'css' },
    { pattern: 'css-loader', reason: 'CSS Webpack loader', category: 'css' },
    { pattern: 'style-loader', reason: 'Style Webpack loader', category: 'css' },
    
    // Changesets and versioning
    { pattern: /^@changesets\//, reason: 'Changesets versioning tool', category: 'versioning' },
    
    // Additional dev tools
    { pattern: 'rimraf', reason: 'Cross-platform file removal utility', category: 'utilities' },
    { pattern: 'cross-env', reason: 'Cross-platform environment variables', category: 'utilities' },
    { pattern: 'dotenv-cli', reason: 'Load environment variables from .env', category: 'utilities' },
    { pattern: 'npm-check-updates', reason: 'Dependency update checker', category: 'utilities' },
    { pattern: 'depcheck', reason: 'Dependency checker', category: 'utilities' },
  ];

  constructor(private options: DevCheckOptionsWithIncludeExclude = {}) {}

  async check(projectPath: string = process.cwd()): Promise<DevCheckResult> {
    debug('Starting dev dependency check for project: %s', projectPath);
    const result: DevCheckResult = {
      packagePath: projectPath,
      misplacedDependencies: [],
      errors: []
    };

    try {
      // Read package.json
      const packageJsonPath = path.join(projectPath, 'package.json');
      const packageContent = await fs.readFile(packageJsonPath, 'utf-8');
      const packageJson: PackageJson = JSON.parse(packageContent);
      result.packageName = packageJson.name;

      debug('Checking package: %s', result.packageName);

      // Get production dependencies
      const prodDependencies = packageJson.dependencies || {};
      debug('Found %d production dependencies', Object.keys(prodDependencies).length);

      // Check each production dependency
      for (const [depName, depVersion] of Object.entries(prodDependencies)) {
        const devCheck = this.isCommonDevDependency(depName);
        if (devCheck.isDev) {
          debug('Misplaced dependency detected: %s (reason: %s)', depName, devCheck.reason);
          result.misplacedDependencies.push({
            name: depName,
            currentLocation: 'dependencies',
            suggestedLocation: 'devDependencies',
            reason: devCheck.reason,
            pattern: devCheck.pattern
          });
        }
      }

      debug('Found %d misplaced dependencies', result.misplacedDependencies.length);

      // Auto-fix if requested
      if (this.options.fix && result.misplacedDependencies.length > 0) {
        debug('Auto-fix enabled, fixing package.json');
        result.fixedDependencies = await this.fixPackageJson(projectPath, result.misplacedDependencies);
        debug('Fixed %d dependencies', result.fixedDependencies?.length || 0);
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      debug('Error checking dev dependencies: %s', errorMessage);
      result.errors = [errorMessage];
    }

    return result;
  }

  private isCommonDevDependency(packageName: string): { isDev: boolean; reason: string; pattern: string } {
    // Check if package is explicitly excluded (exclude takes priority)
    if (this.options.exclude && this.isPackageInList(packageName, this.options.exclude)) {
      debug('Package %s is explicitly excluded from dev dependency check', packageName);
      return { isDev: false, reason: '', pattern: '' };
    }

    // Check default patterns first
    for (const { pattern, reason, category } of this.devPatterns) {
      if (typeof pattern === 'string') {
        if (packageName === pattern) {
          return { isDev: true, reason, pattern: packageName };
        }
      } else if (pattern instanceof RegExp) {
        if (pattern.test(packageName)) {
          return { isDev: true, reason, pattern: pattern.source };
        }
      }
    }

    // Check if package is explicitly included
    if (this.options.include && this.isPackageInList(packageName, this.options.include)) {
      debug('Package %s is explicitly included in dev dependency check', packageName);
      return { isDev: true, reason: 'Explicitly included in dev dependency check', pattern: packageName };
    }

    return { isDev: false, reason: '', pattern: '' };
  }

  private isPackageInList(packageName: string, list: string[]): boolean {
    return list.some(pattern => {
      if (pattern.startsWith('/') && pattern.endsWith('/')) {
        // Treat as regex pattern
        try {
          const regex = new RegExp(pattern.slice(1, -1));
          return regex.test(packageName);
        } catch (error) {
          debug('Invalid regex pattern in include/exclude list: %s', pattern);
          return false;
        }
      } else {
        // Treat as exact string match
        return packageName === pattern;
      }
    });
  }

  private async fixPackageJson(projectPath: string, misplaced: MisplacedDependency[]): Promise<MisplacedDependency[]> {
    debug('Fixing package.json at: %s', projectPath);
    debug('Moving %d misplaced dependencies', misplaced.length);
    const fixed: MisplacedDependency[] = [];

    try {
      const packageJsonPath = path.join(projectPath, 'package.json');
      const packageContent = await fs.readFile(packageJsonPath, 'utf-8');
      const packageJson: PackageJson = JSON.parse(packageContent);

      // Initialize devDependencies if it doesn't exist
      if (!packageJson.devDependencies) {
        packageJson.devDependencies = {};
      }

      // Move misplaced dependencies
      for (const dep of misplaced) {
        if (packageJson.dependencies && packageJson.dependencies[dep.name]) {
          const version = packageJson.dependencies[dep.name];
          debug('Moving %s@%s from dependencies to devDependencies', dep.name, version);
          
          // Add to devDependencies
          packageJson.devDependencies[dep.name] = version;
          
          // Remove from dependencies
          delete packageJson.dependencies[dep.name];
          
          fixed.push(dep);
        }
      }

      // Sort devDependencies alphabetically
      if (packageJson.devDependencies) {
        const sortedDevDeps = Object.keys(packageJson.devDependencies)
          .sort()
          .reduce((acc, key) => {
            acc[key] = packageJson.devDependencies![key];
            return acc;
          }, {} as Record<string, string>);
        packageJson.devDependencies = sortedDevDeps;
      }

      // Write back to file, preserving formatting
      const updatedContent = JSON.stringify(packageJson, null, 2) + '\n';
      debug('Writing updated package.json');
      await fs.writeFile(packageJsonPath, updatedContent, 'utf-8');
      debug('Successfully fixed %d dependencies', fixed.length);

    } catch (error) {
      debug('Failed to fix package.json: %O', error);
      throw error;
    }

    return fixed;
  }

  formatOutput(result: DevCheckResult): string {
    const lines: string[] = [];

    if (result.errors && result.errors.length > 0) {
      lines.push(`❌ Error checking ${result.packageName || result.packagePath}:`);
      result.errors.forEach(error => lines.push(`   ${error}`));
      return lines.join('\n');
    }

    if (result.misplacedDependencies.length === 0) {
      lines.push(`✅ ${result.packageName || path.basename(result.packagePath)}: No misplaced dependencies found`);
      return lines.join('\n');
    }

    lines.push(`📦 ${result.packageName || path.basename(result.packagePath)}:`);
    lines.push('');

    if (this.options.fix && result.fixedDependencies) {
      lines.push(`🔧 Fixed ${result.fixedDependencies.length} misplaced dependencies:`);
      result.fixedDependencies.forEach(dep => {
        lines.push(`  ✅ Moved ${dep.name} to devDependencies`);
        lines.push(`     Reason: ${dep.reason}`);
      });
    } else {
      lines.push(`⚠️  Found ${result.misplacedDependencies.length} misplaced dependencies in production:`);
      result.misplacedDependencies.forEach(dep => {
        lines.push(`  • ${dep.name}`);
        lines.push(`    Reason: ${dep.reason}`);
        lines.push(`    Should be in: ${dep.suggestedLocation}`);
      });
    }

    return lines.join('\n');
  }

  formatJson(result: DevCheckResult): string {
    return JSON.stringify(result, null, 2);
  }
}

