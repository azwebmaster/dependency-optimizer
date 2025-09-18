import * as fs from 'fs/promises';
import * as path from 'path';
import type { AnalyzeOptions, AnalyzeResult, PackageAnalysis } from './types.js';

export class NodeModulesAnalyzer {
  constructor(private options: AnalyzeOptions = {}) {}

  async analyze(projectPath: string = process.cwd()): Promise<AnalyzeResult> {
    const nodeModulesPath = path.join(projectPath, 'node_modules');
    const sizeThreshold = (this.options.sizeThreshold || 10) * 1024 * 1024; // Convert MB to bytes
    const depthThreshold = this.options.depthThreshold || 5;

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
        return result;
      }

      // Get all packages in node_modules
      const packages = await this.getAllPackages(nodeModulesPath);
      result.totalPackages = packages.length;

      // Analyze each package
      for (const pkg of packages) {
        const analysis = await this.analyzePackage(pkg.path, pkg.name);
        
        result.totalSize += analysis.size;

        // Check if package exceeds size threshold
        if (analysis.size > sizeThreshold) {
          result.largePackages.push(analysis);
        }

        // Check if package exceeds depth threshold
        if (analysis.depth > depthThreshold) {
          result.deepPackages.push(analysis);
        }
      }

      // Sort results by size/depth descending
      result.largePackages.sort((a, b) => b.size - a.size);
      result.deepPackages.sort((a, b) => b.depth - a.depth);

    } catch (error) {
      // Handle errors gracefully
      console.warn(`Warning: Failed to analyze node_modules: ${error}`);
    }

    return result;
  }

  private async getAllPackages(nodeModulesPath: string): Promise<{ name: string; path: string }[]> {
    const packages: { name: string; path: string }[] = [];

    try {
      const entries = await fs.readdir(nodeModulesPath, { withFileTypes: true });

      for (const entry of entries) {
        if (entry.isDirectory()) {
          const entryPath = path.join(nodeModulesPath, entry.name);

          if (entry.name.startsWith('@')) {
            // Scoped packages
            try {
              const scopedEntries = await fs.readdir(entryPath, { withFileTypes: true });
              for (const scopedEntry of scopedEntries) {
                if (scopedEntry.isDirectory()) {
                  const scopedPath = path.join(entryPath, scopedEntry.name);
                  const packageName = `${entry.name}/${scopedEntry.name}`;
                  
                  // Verify it's a valid package
                  if (await this.isValidPackage(scopedPath)) {
                    packages.push({ name: packageName, path: scopedPath });
                  }
                }
              }
            } catch {
              // Skip if can't read scoped directory
            }
          } else {
            // Regular packages
            if (await this.isValidPackage(entryPath)) {
              packages.push({ name: entry.name, path: entryPath });
            }
          }
        }
      }
    } catch {
      // Return empty array if can't read node_modules
    }

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
    const analysis: PackageAnalysis = {
      name: packageName,
      size: 0,
      depth: 0,
      path: packagePath
    };

    try {
      // Calculate package size
      analysis.size = await this.getDirectorySize(packagePath);

      // Calculate dependency depth
      analysis.depth = await this.getDependencyDepth(packagePath);

    } catch {
      // If we can't analyze, just return default values
    }

    return analysis;
  }

  private async getDirectorySize(dirPath: string): Promise<number> {
    let size = 0;

    try {
      const entries = await fs.readdir(dirPath, { withFileTypes: true });

      for (const entry of entries) {
        const entryPath = path.join(dirPath, entry.name);

        if (entry.isDirectory()) {
          // Skip nested node_modules to avoid double counting
          if (entry.name === 'node_modules') {
            continue;
          }
          size += await this.getDirectorySize(entryPath);
        } else if (entry.isFile()) {
          try {
            const stats = await fs.stat(entryPath);
            size += stats.size;
          } catch {
            // Skip files we can't read
          }
        }
      }
    } catch {
      // Return 0 if we can't read the directory
    }

    return size;
  }

  private async getDependencyDepth(packagePath: string, visited = new Set<string>()): Promise<number> {
    // Prevent infinite recursion
    if (visited.has(packagePath)) {
      return 0;
    }
    visited.add(packagePath);

    try {
      const packageJsonPath = path.join(packagePath, 'package.json');
      const packageContent = await fs.readFile(packageJsonPath, 'utf-8');
      const packageJson = JSON.parse(packageContent);

      const dependencies = {
        ...packageJson.dependencies,
        ...packageJson.peerDependencies
      };

      if (!dependencies || Object.keys(dependencies).length === 0) {
        return 0;
      }

      let maxDepth = 0;
      const nodeModulesPath = path.join(packagePath, 'node_modules');

      // Check if this package has its own node_modules
      if (await this.directoryExists(nodeModulesPath)) {
        for (const depName of Object.keys(dependencies)) {
          const depPath = await this.findDependencyPath(nodeModulesPath, depName);
          if (depPath) {
            const depthOfDep = await this.getDependencyDepth(depPath, visited);
            maxDepth = Math.max(maxDepth, depthOfDep + 1);
          }
        }
      }

      return maxDepth;

    } catch {
      return 0;
    }
  }

  private async findDependencyPath(nodeModulesPath: string, depName: string): Promise<string | null> {
    // Check for scoped package
    if (depName.includes('/')) {
      const depPath = path.join(nodeModulesPath, depName);
      if (await this.directoryExists(depPath)) {
        return depPath;
      }
    } else {
      const depPath = path.join(nodeModulesPath, depName);
      if (await this.directoryExists(depPath)) {
        return depPath;
      }
    }

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