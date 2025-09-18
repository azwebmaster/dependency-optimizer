const depcheck = require('depcheck');
const fs = require('fs-extra');
const path = require('path');
const chalk = require('chalk');
const { glob } = require('glob');

class DependencyOptimizer {
  constructor() {
    this.workspacePackages = [];
  }

  /**
   * Scan for unused dependencies
   */
  async scan(options = {}) {
    const { fix = false, recursive = false, workspace = null, verbose = false } = options;
    
    console.log(chalk.blue('🔍 Scanning for unused dependencies...'));
    
    const packages = await this.findPackages(recursive, workspace);
    
    if (packages.length === 0) {
      console.log(chalk.yellow('No packages found to scan.'));
      return;
    }

    console.log(chalk.green(`Found ${packages.length} package(s) to scan`));
    
    let totalUnused = 0;
    const results = [];

    for (const pkg of packages) {
      console.log(chalk.cyan(`\nScanning: ${pkg.relativePath}`));
      
      const result = await this.scanPackage(pkg.path, verbose);
      
      if (result.unused.length > 0 || result.missing.length > 0) {
        results.push({ ...result, packagePath: pkg.path, relativePath: pkg.relativePath });
        totalUnused += result.unused.length;
        
        this.printResults(result, pkg.relativePath);
        
        if (fix) {
          await this.fixPackage(pkg.path, result);
        }
      } else {
        console.log(chalk.green('✅ No unused dependencies found'));
      }
    }

    console.log(chalk.blue(`\n📊 Summary: Found ${totalUnused} unused dependencies across ${results.length} packages`));
    
    return results;
  }

  /**
   * Find all packages to scan
   */
  async findPackages(recursive = false, workspacePattern = null) {
    const cwd = process.cwd();
    const packages = [];
    
    // Check if current directory has package.json
    const mainPackageJson = path.join(cwd, 'package.json');
    if (await fs.pathExists(mainPackageJson)) {
      packages.push({
        path: cwd,
        relativePath: '.'
      });
    }

    if (recursive) {
      // Look for workspace packages
      const workspaces = await this.findWorkspaces(cwd, workspacePattern);
      packages.push(...workspaces);
    }

    return packages;
  }

  /**
   * Find workspace packages
   */
  async findWorkspaces(rootPath, pattern = null) {
    const packages = [];
    const packageJsonPath = path.join(rootPath, 'package.json');
    
    if (!(await fs.pathExists(packageJsonPath))) {
      return packages;
    }

    try {
      const packageJson = await fs.readJson(packageJsonPath);
      let workspacePatterns = [];

      // Support both npm/yarn workspaces and lerna
      if (packageJson.workspaces) {
        if (Array.isArray(packageJson.workspaces)) {
          workspacePatterns = packageJson.workspaces;
        } else if (packageJson.workspaces.packages) {
          workspacePatterns = packageJson.workspaces.packages;
        }
      }

      // Also check for lerna.json
      const lernaPath = path.join(rootPath, 'lerna.json');
      if (await fs.pathExists(lernaPath)) {
        const lernaConfig = await fs.readJson(lernaPath);
        if (lernaConfig.packages) {
          workspacePatterns.push(...lernaConfig.packages);
        }
      }

      // Find all workspace packages
      for (const workspacePattern of workspacePatterns) {
        const workspacePaths = await glob(path.join(rootPath, workspacePattern), { onlyDirectories: true });
        
        for (const workspacePath of workspacePaths) {
          const pkgJsonPath = path.join(workspacePath, 'package.json');
          if (await fs.pathExists(pkgJsonPath)) {
            const relativePath = path.relative(rootPath, workspacePath);
            
            // Apply pattern filter if specified
            if (!pattern || relativePath.includes(pattern)) {
              packages.push({
                path: workspacePath,
                relativePath
              });
            }
          }
        }
      }
    } catch (error) {
      console.warn(chalk.yellow(`Warning: Could not parse workspace configuration: ${error.message}`));
    }

    return packages;
  }

  /**
   * Scan a single package for unused dependencies
   */
  async scanPackage(packagePath, verbose = false) {
    const options = {
      // Auto-enable specials based on detected file types
      specials: await this.detectSpecials(packagePath)
    };

    if (verbose) {
      const specialNames = options.specials.map(special => special.name || 'unnamed').join(', ');
      console.log(chalk.gray(`Using specials: ${specialNames}`));
    }

    return new Promise((resolve, reject) => {
      depcheck(packagePath, options, (result) => {
        if (result.error) {
          reject(result.error);
        } else {
          resolve({
            unused: result.dependencies || [],
            missing: Object.keys(result.missing || {}),
            invalidFiles: Object.keys(result.invalidFiles || {}),
            invalidDirs: Object.keys(result.invalidDirs || {})
          });
        }
      });
    });
  }

  /**
   * Auto-detect specials based on file patterns
   */
  async detectSpecials(packagePath) {
    const specials = [depcheck.special.eslint, depcheck.special.babel];
    
    // Check for various config files and frameworks
    const checks = [
      { files: ['webpack.config.js', 'webpack.*.js'], special: depcheck.special.webpack },
      { files: ['rollup.config.js'], special: depcheck.special.rollup },
      { files: ['next.config.js'], special: depcheck.special.nextjs },
      { files: ['gatsby-*.js'], special: depcheck.special.gatsby },
      { files: ['jest.config.js', 'jest.config.json'], special: depcheck.special.jest },
      { files: ['**/*.test.js', '**/*.spec.js'], special: depcheck.special.mocha },
      { files: ['bin/**', 'scripts/**'], special: depcheck.special.bin }
    ];

    for (const check of checks) {
      for (const filePattern of check.files) {
        const files = await glob(path.join(packagePath, filePattern));
        if (files.length > 0) {
          specials.push(check.special);
          break;
        }
      }
    }

    return specials;
  }

  /**
   * Print scan results
   */
  printResults(result, packagePath) {
    if (result.unused.length > 0) {
      console.log(chalk.red(`\n❌ Unused dependencies (${result.unused.length}):`));
      result.unused.forEach(dep => console.log(chalk.red(`  - ${dep}`)));
    }

    if (result.missing.length > 0) {
      console.log(chalk.yellow(`\n⚠️  Missing dependencies (${result.missing.length}):`));
      result.missing.forEach(dep => console.log(chalk.yellow(`  - ${dep}`)));
    }

    if (result.invalidFiles.length > 0) {
      console.log(chalk.gray(`\n🔍 Files that couldn't be parsed (${result.invalidFiles.length}):`));
      result.invalidFiles.slice(0, 5).forEach(file => console.log(chalk.gray(`  - ${file}`)));
      if (result.invalidFiles.length > 5) {
        console.log(chalk.gray(`  ... and ${result.invalidFiles.length - 5} more`));
      }
    }
  }

  /**
   * Fix package by removing unused dependencies
   */
  async fixPackage(packagePath, result) {
    if (result.unused.length === 0) {
      return;
    }

    console.log(chalk.blue('\n🔧 Fixing package.json...'));
    
    const packageJsonPath = path.join(packagePath, 'package.json');
    const packageJson = await fs.readJson(packageJsonPath);
    
    let removedCount = 0;
    
    // Remove from dependencies
    if (packageJson.dependencies) {
      for (const dep of result.unused) {
        if (packageJson.dependencies[dep]) {
          delete packageJson.dependencies[dep];
          removedCount++;
          console.log(chalk.green(`  ✅ Removed ${dep} from dependencies`));
        }
      }
    }

    // Remove from devDependencies
    if (packageJson.devDependencies) {
      for (const dep of result.unused) {
        if (packageJson.devDependencies[dep]) {
          delete packageJson.devDependencies[dep];
          removedCount++;
          console.log(chalk.green(`  ✅ Removed ${dep} from devDependencies`));
        }
      }
    }

    if (removedCount > 0) {
      await fs.writeJson(packageJsonPath, packageJson, { spaces: 2 });
      console.log(chalk.green(`\n✅ Removed ${removedCount} unused dependencies from package.json`));
    }
  }

  /**
   * Analyze node_modules for large packages and deep dependencies
   */
  async analyze(options = {}) {
    const { sizeThreshold = 10, depthThreshold = 5, json = false } = options;
    const sizeThresholdBytes = parseFloat(sizeThreshold) * 1024 * 1024; // Convert MB to bytes
    
    console.log(chalk.blue('📊 Analyzing node_modules...'));
    
    const nodeModulesPath = path.join(process.cwd(), 'node_modules');
    
    if (!(await fs.pathExists(nodeModulesPath))) {
      console.log(chalk.yellow('No node_modules directory found. Run npm install first.'));
      return;
    }

    const analysis = {
      largePackages: [],
      deepDependencies: [],
      totalSize: 0,
      packageCount: 0
    };

    await this.analyzeDirectory(nodeModulesPath, analysis, sizeThresholdBytes, depthThreshold);
    
    if (json) {
      console.log(JSON.stringify(analysis, null, 2));
    } else {
      this.printAnalysis(analysis, sizeThreshold, depthThreshold);
    }

    return analysis;
  }

  /**
   * Recursively analyze directory
   */
  async analyzeDirectory(dirPath, analysis, sizeThreshold, depthThreshold, depth = 0) {
    try {
      const items = await fs.readdir(dirPath);
      
      for (const item of items) {
        if (item.startsWith('.')) continue;
        
        const itemPath = path.join(dirPath, item);
        const stat = await fs.stat(itemPath);
        
        if (stat.isDirectory()) {
          if (item.startsWith('@')) {
            // Scoped packages
            const scopedItems = await fs.readdir(itemPath);
            for (const scopedItem of scopedItems) {
              const scopedPath = path.join(itemPath, scopedItem);
              await this.analyzePackage(scopedPath, analysis, sizeThreshold, depthThreshold, depth);
            }
          } else {
            await this.analyzePackage(itemPath, analysis, sizeThreshold, depthThreshold, depth);
          }
        }
      }
    } catch (error) {
      // Ignore permission errors and continue
    }
  }

  /**
   * Analyze individual package
   */
  async analyzePackage(packagePath, analysis, sizeThreshold, depthThreshold, depth) {
    try {
      const packageJsonPath = path.join(packagePath, 'package.json');
      
      if (!(await fs.pathExists(packageJsonPath))) {
        return;
      }

      const packageJson = await fs.readJson(packageJsonPath);
      const packageName = packageJson.name;
      
      if (!packageName) return;

      analysis.packageCount++;
      
      // Calculate package size
      const size = await this.getDirectorySize(packagePath);
      analysis.totalSize += size;
      
      if (size > sizeThreshold) {
        analysis.largePackages.push({
          name: packageName,
          size: Math.round(size / (1024 * 1024) * 100) / 100, // MB with 2 decimal places
          path: packagePath
        });
      }

      // Check for deep transitive dependencies
      const nodeModulesPath = path.join(packagePath, 'node_modules');
      if (await fs.pathExists(nodeModulesPath)) {
        const transitiveDeps = await this.countTransitiveDependencies(nodeModulesPath);
        
        if (transitiveDeps > depthThreshold || depth > depthThreshold) {
          analysis.deepDependencies.push({
            name: packageName,
            depth: depth,
            transitiveDeps: transitiveDeps,
            path: packagePath
          });
        }

        // Recursively analyze nested dependencies
        await this.analyzeDirectory(nodeModulesPath, analysis, sizeThreshold, depthThreshold, depth + 1);
      }
    } catch (error) {
      // Ignore errors and continue
    }
  }

  /**
   * Get directory size recursively
   */
  async getDirectorySize(dirPath) {
    let totalSize = 0;
    
    try {
      const items = await fs.readdir(dirPath);
      
      for (const item of items) {
        const itemPath = path.join(dirPath, item);
        const stat = await fs.stat(itemPath);
        
        if (stat.isDirectory()) {
          totalSize += await this.getDirectorySize(itemPath);
        } else {
          totalSize += stat.size;
        }
      }
    } catch (error) {
      // Ignore permission errors
    }
    
    return totalSize;
  }

  /**
   * Count transitive dependencies
   */
  async countTransitiveDependencies(nodeModulesPath) {
    try {
      const items = await fs.readdir(nodeModulesPath);
      let count = 0;
      
      for (const item of items) {
        if (item.startsWith('.')) continue;
        
        const itemPath = path.join(nodeModulesPath, item);
        const stat = await fs.stat(itemPath);
        
        if (stat.isDirectory()) {
          if (item.startsWith('@')) {
            const scopedItems = await fs.readdir(itemPath);
            count += scopedItems.length;
          } else {
            count++;
          }
        }
      }
      
      return count;
    } catch (error) {
      return 0;
    }
  }

  /**
   * Print analysis results
   */
  printAnalysis(analysis, sizeThreshold, depthThreshold) {
    console.log(chalk.green(`\n📦 Total packages: ${analysis.packageCount}`));
    console.log(chalk.green(`💾 Total size: ${Math.round(analysis.totalSize / (1024 * 1024) * 100) / 100} MB`));
    
    if (analysis.largePackages.length > 0) {
      console.log(chalk.red(`\n🔴 Large packages (>${sizeThreshold}MB):`));
      analysis.largePackages
        .sort((a, b) => b.size - a.size)
        .slice(0, 10)
        .forEach(pkg => {
          console.log(chalk.red(`  ${pkg.name}: ${pkg.size}MB`));
        });
      
      if (analysis.largePackages.length > 10) {
        console.log(chalk.gray(`  ... and ${analysis.largePackages.length - 10} more`));
      }
    }

    if (analysis.deepDependencies.length > 0) {
      console.log(chalk.yellow(`\n🔶 Deep dependency trees (>${depthThreshold} levels or deps):`));
      analysis.deepDependencies
        .sort((a, b) => b.depth - a.depth)
        .slice(0, 10)
        .forEach(pkg => {
          console.log(chalk.yellow(`  ${pkg.name}: depth ${pkg.depth}, ${pkg.transitiveDeps} transitive deps`));
        });
      
      if (analysis.deepDependencies.length > 10) {
        console.log(chalk.gray(`  ... and ${analysis.deepDependencies.length - 10} more`));
      }
    }
  }
}

module.exports = DependencyOptimizer;