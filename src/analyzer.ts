import * as fs from 'fs/promises';
import * as path from 'path';
import type { AnalyzeOptions, AnalyzeResult, PackageAnalysis } from './types.js';
import createDebug from 'debug';

const debug = createDebug('depoptimize:analyzer');

export class NodeModulesAnalyzer {
  constructor(private options: AnalyzeOptions = {}) {}

  async analyze(projectPath: string = process.cwd()): Promise<AnalyzeResult> {
    debug('Starting analysis for project: %s', projectPath);
    const nodeModulesPath = path.join(projectPath, 'node_modules');
    const sizeThreshold = (this.options.sizeThreshold || 10) * 1024 * 1024; // Convert MB to bytes
    const depthThreshold = this.options.depthThreshold || 5;
    debug('Configuration - sizeThreshold: %d bytes, depthThreshold: %d', sizeThreshold, depthThreshold);

    const result: AnalyzeResult = {
      totalPackages: 0,
      totalSize: 0,
      largePackages: [],
      deepPackages: [],
      nodeModulesPath
    };

    try {
      // Check if node_modules exists
      const nodeModulesExists = await this.directoryExists(nodeModulesPath);
      if (!nodeModulesExists) {
        debug('node_modules not found at: %s', nodeModulesPath);
        return result;
      }
      debug('Found node_modules at: %s', nodeModulesPath);

      // Get all packages in node_modules
      const packages = await this.getAllPackages(nodeModulesPath);
      result.totalPackages = packages.length;
      debug('Found %d packages in node_modules', packages.length);

      // Analyze each package
      for (const pkg of packages) {
        debug('Analyzing package: %s', pkg.name);
        const analysis = await this.analyzePackage(pkg.path, pkg.name);
        
        result.totalSize += analysis.size;

        // Check if package exceeds size threshold
        if (analysis.size > sizeThreshold) {
          debug('Large package detected: %s (%d bytes)', pkg.name, analysis.size);
          result.largePackages.push(analysis);
        }

        // Check if package exceeds depth threshold
        if (analysis.depth > depthThreshold) {
          debug('Deep package detected: %s (depth: %d)', pkg.name, analysis.depth);
          result.deepPackages.push(analysis);
        }
      }

      // Sort results by size/depth descending
      result.largePackages.sort((a, b) => b.size - a.size);
      result.deepPackages.sort((a, b) => b.depth - a.depth);
      debug('Analysis complete - total size: %d bytes, large packages: %d, deep packages: %d',
            result.totalSize, result.largePackages.length, result.deepPackages.length);

    } catch (error) {
      // Handle errors gracefully
      debug('Error during analysis: %O', error);
      console.warn(`Warning: Failed to analyze node_modules: ${error}`);
    }

    return result;
  }

  private async getAllPackages(nodeModulesPath: string): Promise<{ name: string; path: string }[]> {
    debug('Scanning for packages in: %s', nodeModulesPath);
    const packages: { name: string; path: string }[] = [];

    try {
      const entries = await fs.readdir(nodeModulesPath, { withFileTypes: true });

      for (const entry of entries) {
        if (entry.isDirectory() || entry.isSymbolicLink()) {
          const entryPath = path.join(nodeModulesPath, entry.name);

          // For symlinks, check if they point to directories
          if (entry.isSymbolicLink()) {
            try {
              const stats = await fs.stat(entryPath);
              if (!stats.isDirectory()) {
                debug('Symlink %s does not point to a directory, skipping', entry.name);
                continue;
              }
              debug('Found symlinked directory: %s', entry.name);
            } catch (error) {
              debug('Failed to resolve symlink %s: %O', entry.name, error);
              continue;
            }
          }

          if (entry.name.startsWith('@')) {
            // Scoped packages
            debug('Processing scoped package directory: %s', entry.name);
            try {
              const scopedEntries = await fs.readdir(entryPath, { withFileTypes: true });
              for (const scopedEntry of scopedEntries) {
                if (scopedEntry.isDirectory() || scopedEntry.isSymbolicLink()) {
                  const scopedPath = path.join(entryPath, scopedEntry.name);

                  // For symlinks in scoped packages, check if they point to directories
                  if (scopedEntry.isSymbolicLink()) {
                    try {
                      const stats = await fs.stat(scopedPath);
                      if (!stats.isDirectory()) {
                        debug('Symlink %s/%s does not point to a directory, skipping', entry.name, scopedEntry.name);
                        continue;
                      }
                      debug('Found symlinked scoped package: %s/%s', entry.name, scopedEntry.name);
                    } catch (error) {
                      debug('Failed to resolve symlink %s/%s: %O', entry.name, scopedEntry.name, error);
                      continue;
                    }
                  }

                  const packageName = `${entry.name}/${scopedEntry.name}`;

                  // Verify it's a valid package
                  if (await this.isValidPackage(scopedPath)) {
                    debug('Found scoped package: %s', packageName);
                    packages.push({ name: packageName, path: scopedPath });
                  }
                }
              }
            } catch (error) {
              // Skip if can't read scoped directory
              debug('Failed to read scoped directory %s: %O', entry.name, error);
            }
          } else {
            // Regular packages
            if (await this.isValidPackage(entryPath)) {
              debug('Found package: %s', entry.name);
              packages.push({ name: entry.name, path: entryPath });
            }
          }
        }
      }
    } catch (error) {
      // Return empty array if can't read node_modules
      debug('Failed to read node_modules directory: %O', error);
    }

    debug('Total packages found: %d', packages.length);
    return packages;
  }

  private async isValidPackage(packagePath: string): Promise<boolean> {
    try {
      const packageJsonPath = path.join(packagePath, 'package.json');
      await fs.access(packageJsonPath);
      return true;
    } catch {
      return false;
    }
  }

  private async analyzePackage(packagePath: string, packageName: string): Promise<PackageAnalysis> {
    debug('Analyzing package details for: %s', packageName);
    const analysis: PackageAnalysis = {
      name: packageName,
      size: 0,
      depth: 0,
      path: packagePath
    };

    try {
      // Calculate package size
      analysis.size = await this.getDirectorySize(packagePath);
      debug('Package %s size: %d bytes', packageName, analysis.size);

      // Calculate dependency depth
      analysis.depth = await this.getDependencyDepth(packagePath);
      debug('Package %s depth: %d', packageName, analysis.depth);

    } catch (error) {
      // If we can't analyze, just return default values
      debug('Failed to analyze package %s: %O', packageName, error);
    }

    return analysis;
  }

  private async getDirectorySize(dirPath: string): Promise<number> {
    debug('Calculating size for directory: %s', dirPath);
    let size = 0;

    try {
      const entries = await fs.readdir(dirPath, { withFileTypes: true });

      for (const entry of entries) {
        const entryPath = path.join(dirPath, entry.name);

        if (entry.isDirectory()) {
          // Skip nested node_modules to avoid double counting
          if (entry.name === 'node_modules') {
            debug('Skipping nested node_modules in: %s', dirPath);
            continue;
          }
          size += await this.getDirectorySize(entryPath);
        } else if (entry.isSymbolicLink()) {
          try {
            const stats = await fs.stat(entryPath);
            if (stats.isDirectory()) {
              // Skip nested node_modules to avoid double counting
              if (entry.name === 'node_modules') {
                debug('Skipping symlinked nested node_modules in: %s', dirPath);
                continue;
              }
              debug('Following symlinked directory: %s', entryPath);
              size += await this.getDirectorySize(entryPath);
            } else if (stats.isFile()) {
              debug('Following symlinked file: %s', entryPath);
              size += stats.size;
            }
          } catch (error) {
            // Skip symlinks we can't resolve
            debug('Failed to resolve symlink %s: %O', entryPath, error);
          }
        } else if (entry.isFile()) {
          try {
            const stats = await fs.stat(entryPath);
            size += stats.size;
          } catch (error) {
            // Skip files we can't read
            debug('Failed to read file %s: %O', entryPath, error);
          }
        }
      }
    } catch (error) {
      // Return 0 if we can't read the directory
      debug('Failed to read directory %s: %O', dirPath, error);
    }

    debug('Total size for %s: %d bytes', dirPath, size);
    return size;
  }

  private async getDependencyDepth(packagePath: string, visited = new Set<string>()): Promise<number> {
    // Prevent infinite recursion
    if (visited.has(packagePath)) {
      debug('Circular dependency detected, skipping: %s', packagePath);
      return 0;
    }
    visited.add(packagePath);
    debug('Calculating depth for: %s', packagePath);

    try {
      const packageJsonPath = path.join(packagePath, 'package.json');
      const packageContent = await fs.readFile(packageJsonPath, 'utf-8');
      const packageJson = JSON.parse(packageContent);

      const dependencies = {
        ...packageJson.dependencies,
        ...packageJson.peerDependencies
      };

      if (!dependencies || Object.keys(dependencies).length === 0) {
        debug('No dependencies found for: %s', packagePath);
        return 0;
      }
      debug('Found %d dependencies for: %s', Object.keys(dependencies).length, packagePath);

      let maxDepth = 0;
      const nodeModulesPath = path.join(packagePath, 'node_modules');

      // Check if this package has its own node_modules
      if (await this.directoryExists(nodeModulesPath)) {
        debug('Checking nested node_modules: %s', nodeModulesPath);
        for (const depName of Object.keys(dependencies)) {
          const depPath = await this.findDependencyPath(nodeModulesPath, depName);
          if (depPath) {
            const depthOfDep = await this.getDependencyDepth(depPath, visited);
            maxDepth = Math.max(maxDepth, depthOfDep + 1);
          }
        }
      }

      debug('Max depth for %s: %d', packagePath, maxDepth);
      return maxDepth;

    } catch (error) {
      debug('Failed to calculate depth for %s: %O', packagePath, error);
      return 0;
    }
  }

  private async findDependencyPath(nodeModulesPath: string, depName: string): Promise<string | null> {
    debug('Looking for dependency %s in %s', depName, nodeModulesPath);
    // Check for scoped package
    if (depName.includes('/')) {
      const depPath = path.join(nodeModulesPath, depName);
      if (await this.directoryExists(depPath)) {
        debug('Found scoped dependency at: %s', depPath);
        return depPath;
      }
    } else {
      const depPath = path.join(nodeModulesPath, depName);
      if (await this.directoryExists(depPath)) {
        debug('Found dependency at: %s', depPath);
        return depPath;
      }
    }

    debug('Dependency %s not found in %s', depName, nodeModulesPath);
    return null;
  }

  private async directoryExists(dirPath: string): Promise<boolean> {
    try {
      const stats = await fs.stat(dirPath);
      return stats.isDirectory();
    } catch {
      return false;
    }
  }

  formatSize(bytes: number): string {
    const units = ['B', 'KB', 'MB', 'GB'];
    let size = bytes;
    let unitIndex = 0;

    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }

    return `${size.toFixed(1)}${units[unitIndex]}`;
  }
}