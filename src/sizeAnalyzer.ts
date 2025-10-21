import * as fs from 'fs';
import * as path from 'path';
import createDebug from 'debug';

const debug = createDebug('depoptimize:size-analyzer');

export interface PackageSizeInfo {
  name: string;
  version: string;
  size: number;
  path: string;
  dependencies: PackageSizeInfo[];
}

export interface SizeAnalyzerOptions {
  showDependencies?: boolean;
  maxDepth?: number;
  includeDevDependencies?: boolean;
}

export class PackageSizeAnalyzer {
  private visitedPackages: Set<string>;
  private packageCache: Map<string, PackageSizeInfo>;
  private options: SizeAnalyzerOptions;

  constructor(options: SizeAnalyzerOptions = {}) {
    this.visitedPackages = new Set();
    this.packageCache = new Map();
    this.options = {
      showDependencies: true,
      maxDepth: Infinity,
      ...options
    };
  }

  async analyzePackageSize(projectPath: string, specificPackage?: string): Promise<PackageSizeInfo> {
    debug('Starting package size analysis for: %s, specific package: %s', projectPath, specificPackage);

    const nodeModulesPath = path.join(projectPath, 'node_modules');

    if (!fs.existsSync(nodeModulesPath)) {
      throw new Error(`No node_modules found at ${projectPath}. Please run npm/yarn install first.`);
    }

    // If analyzing a specific package
    if (specificPackage) {
      const packageInfo = await this.analyzePackage(specificPackage, nodeModulesPath, 0);
      if (!packageInfo) {
        throw new Error(`Package '${specificPackage}' not found in node_modules`);
      }
      return packageInfo;
    }

    // Otherwise analyze the entire project
    const packageJsonPath = path.join(projectPath, 'package.json');
    if (!fs.existsSync(packageJsonPath)) {
      throw new Error(`No package.json found at ${projectPath}`);
    }

    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));

    const rootPackageInfo: PackageSizeInfo = {
      name: packageJson.name || 'root',
      version: packageJson.version || '0.0.0',
      size: 0,
      path: projectPath,
      dependencies: []
    };

    const allDeps = {
      ...packageJson.dependencies,
      ...(this.options.includeDevDependencies !== false ? packageJson.devDependencies : {})
    };

    debug('Found %d dependencies to analyze', Object.keys(allDeps).length);

    for (const [depName, depVersion] of Object.entries(allDeps)) {
      const depInfo = await this.analyzePackage(depName, nodeModulesPath, 0);
      if (depInfo) {
        rootPackageInfo.dependencies.push(depInfo);
        // Add the dependency's total size (including its transitive dependencies) to the root package's size
        rootPackageInfo.size += depInfo.size;
      }
    }

    debug('Analysis complete. Total size: %d bytes', rootPackageInfo.size);
    return rootPackageInfo;
  }

  private async analyzePackage(
    packageName: string,
    nodeModulesPath: string,
    depth: number
  ): Promise<PackageSizeInfo | null> {
    const cacheKey = `${packageName}@${nodeModulesPath}`;

    if (this.packageCache.has(cacheKey)) {
      debug('Using cached result for %s', packageName);
      return this.packageCache.get(cacheKey)!;
    }

    if (depth >= this.options.maxDepth!) {
      debug('Max depth reached for %s', packageName);
      return null;
    }

    const packagePath = path.join(nodeModulesPath, packageName);

    if (!fs.existsSync(packagePath)) {
      debug('Package not found: %s', packagePath);
      return null;
    }

    const packageJsonPath = path.join(packagePath, 'package.json');
    let packageJson: any = {};

    try {
      if (fs.existsSync(packageJsonPath)) {
        packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
      }
    } catch (error) {
      debug('Error reading package.json for %s: %O', packageName, error);
    }

    const packageInfo: PackageSizeInfo = {
      name: packageName,
      version: packageJson.version || 'unknown',
      size: await this.calculateDirectorySize(packagePath),
      path: packagePath,
      dependencies: []
    };

    if (this.options.showDependencies && packageJson.dependencies) {
      const visitKey = `${packageName}@${depth}`;

      if (!this.visitedPackages.has(visitKey)) {
        this.visitedPackages.add(visitKey);

        for (const depName of Object.keys(packageJson.dependencies)) {
          const depInfo = await this.analyzePackage(
            depName,
            path.join(packagePath, 'node_modules'),
            depth + 1
          );

          if (!depInfo) {
            const parentDepInfo = await this.analyzePackage(
              depName,
              nodeModulesPath,
              depth + 1
            );
            if (parentDepInfo) {
              packageInfo.dependencies.push(parentDepInfo);
              // Add the dependency's total size (including its transitive dependencies) to this package's size
              packageInfo.size += parentDepInfo.size;
            }
          } else {
            packageInfo.dependencies.push(depInfo);
            // Add the dependency's total size (including its transitive dependencies) to this package's size
            packageInfo.size += depInfo.size;
          }
        }
      }
    }

    this.packageCache.set(cacheKey, packageInfo);
    return packageInfo;
  }

  private async calculateDirectorySize(dirPath: string): Promise<number> {
    let totalSize = 0;

    try {
      const items = fs.readdirSync(dirPath);

      for (const item of items) {
        if (item === 'node_modules') continue;

        const itemPath = path.join(dirPath, item);
        const stats = fs.statSync(itemPath);

        if (stats.isDirectory()) {
          totalSize += await this.calculateDirectorySize(itemPath);
        } else if (stats.isFile()) {
          totalSize += stats.size;
        }
      }
    } catch (error) {
      debug('Error calculating size for %s: %O', dirPath, error);
    }

    return totalSize;
  }

  formatSize(bytes: number): string {
    const units = ['B', 'KB', 'MB', 'GB'];
    let size = bytes;
    let unitIndex = 0;

    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }

    return `${size.toFixed(2)} ${units[unitIndex]}`;
  }

  generateTreeView(packageInfo: PackageSizeInfo, prefix = '', isLast = true): string {
    const lines: string[] = [];
    const connector = isLast ? '└── ' : '├── ';
    const sizeStr = this.formatSize(packageInfo.size);

    if (prefix === '') {
      lines.push(`📦 ${packageInfo.name}@${packageInfo.version} (${sizeStr})`);
    } else {
      lines.push(`${prefix}${connector}${packageInfo.name}@${packageInfo.version} (${sizeStr})`);
    }

    const childPrefix = prefix + (isLast ? '    ' : '│   ');

    packageInfo.dependencies.forEach((dep, index) => {
      const isLastDep = index === packageInfo.dependencies.length - 1;
      lines.push(this.generateTreeView(dep, childPrefix, isLastDep));
    });

    return lines.join('\n');
  }

  generateSummary(packageInfo: PackageSizeInfo): string {
    const lines: string[] = [];
    const allPackages = this.flattenPackages(packageInfo);

    const uniquePackages = new Map<string, PackageSizeInfo>();
    allPackages.forEach(pkg => {
      const existing = uniquePackages.get(pkg.name);
      if (!existing || pkg.size > existing.size) {
        uniquePackages.set(pkg.name, pkg);
      }
    });

    const sortedPackages = Array.from(uniquePackages.values())
      .sort((a, b) => b.size - a.size)
      .slice(0, 10);

    lines.push('\n📊 Size Summary');
    lines.push('═══════════════\n');
    lines.push(`Total size: ${this.formatSize(packageInfo.size)}`);
    lines.push(`Total packages: ${uniquePackages.size}\n`);

    if (sortedPackages.length > 0) {
      lines.push('🏆 Top 10 Largest Packages:');
      sortedPackages.forEach((pkg, index) => {
        const percentage = ((pkg.size / packageInfo.size) * 100).toFixed(1);
        lines.push(`  ${index + 1}. ${pkg.name}@${pkg.version}: ${this.formatSize(pkg.size)} (${percentage}%)`);
      });
    }

    return lines.join('\n');
  }

  private flattenPackages(packageInfo: PackageSizeInfo): PackageSizeInfo[] {
    const result: PackageSizeInfo[] = [packageInfo];
    packageInfo.dependencies.forEach(dep => {
      result.push(...this.flattenPackages(dep));
    });
    return result;
  }
}