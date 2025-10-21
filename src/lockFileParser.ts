import * as fs from 'fs';
import * as path from 'path';
import createDebug from 'debug';
import { BunLockParser } from './parsers/bun/index.js';
import { NpmLockParser } from './parsers/npm/index.js';
import { PnpmLockParser } from './parsers/pnpm/index.js';
import { YarnLockParser } from './parsers/yarn/index.js';
import { WorkspaceDetector } from './utils/workspaceDetector.js';
import { DependencyMerger } from './utils/dependencyMerger.js';

const debug = createDebug('depoptimize:lock-parser');

export interface DependencyInfo {
  name: string;
  version: string;
  resolved?: string;
  integrity?: string;
  dependencies?: Record<string, DependencyInfo>;
  parentPath: string[];
}

export interface LockFileData {
  type: 'npm' | 'yarn' | 'pnpm' | 'bun';
  dependencies: Record<string, DependencyInfo>;
}

export class LockFileParser {
  private bunParser = new BunLockParser();
  private npmParser = new NpmLockParser();
  private pnpmParser = new PnpmLockParser();
  private yarnParser = new YarnLockParser();

  async parseLockFile(projectPath: string): Promise<LockFileData | null> {
    debug('Attempting to parse lock file in: %s', projectPath);

    // Try different lock files in order of preference
    const lockFiles = [
      { file: 'package-lock.json', type: 'npm' as const, parser: this.npmParser },
      { file: 'bun.lock', type: 'bun' as const, parser: this.bunParser },
      { file: 'pnpm-lock.yaml', type: 'pnpm' as const, parser: this.pnpmParser },
      { file: 'yarn.lock', type: 'yarn' as const, parser: this.yarnParser }
    ];

    for (const { file, type, parser } of lockFiles) {
      // Detect workspace using the specific parser
      const workspaceInfo = await (parser as any).detectWorkspace(projectPath);
      const effectiveLockPath = (parser as any).getEffectiveLockFilePath(projectPath, workspaceInfo);
      
      if (effectiveLockPath) {
        debug('Found %s lock file: %s', type, file);
        try {
          switch (type) {
            case 'npm':
              return await this.npmParser.parsePackageLock(effectiveLockPath);
            case 'bun':
              const bunData = await this.bunParser.parseAndNormalize(effectiveLockPath);
              // Convert BunPackageInfo to DependencyInfo
              const bunDependencies: Record<string, DependencyInfo> = {};
              for (const [key, pkg] of Object.entries(bunData.packages)) {
                // Convert string dependencies to DependencyInfo format
                const dependencies: Record<string, DependencyInfo> = {};
                if (pkg.dependencies) {
                  for (const [depName, depVersion] of Object.entries(pkg.dependencies)) {
                    dependencies[depName] = {
                      name: depName,
                      version: depVersion,
                      parentPath: [],
                      dependencies: {}
                    };
                  }
                }
                
                bunDependencies[key] = {
                  name: pkg.name,
                  version: pkg.version,
                  resolved: pkg.resolution,
                  integrity: pkg.integrity,
                  parentPath: [], // Will be calculated later
                  dependencies: dependencies
                };
              }
              return {
                type: 'bun' as const,
                dependencies: bunDependencies
              };
            case 'pnpm':
              const pnpmData = await this.pnpmParser.parseAndNormalize(effectiveLockPath);
              // Convert PnpmPackageInfo to DependencyInfo
              const pnpmDependencies: Record<string, DependencyInfo> = {};
              for (const [key, pkg] of Object.entries(pnpmData.packages)) {
                pnpmDependencies[key] = {
                  name: pkg.name,
                  version: pkg.version,
                  resolved: pkg.resolution?.tarball || pkg.resolution?.integrity,
                  integrity: pkg.resolution?.integrity,
                  parentPath: [], // Will be calculated later
                  dependencies: {}
                };
              }
              return {
                type: 'pnpm' as const,
                dependencies: pnpmDependencies
              };
            case 'yarn':
              return await this.yarnParser.parseYarnLock(effectiveLockPath);
          }
        } catch (error) {
          debug('Error parsing %s: %O', file, error);
        }
      }
    }

    debug('No supported lock file found');
    return null;
  }


  // Build a dependency tree from the flat lock file data
  buildDependencyTree(lockData: LockFileData, packageJsonPath: string): Record<string, DependencyInfo> {
    const tree: Record<string, DependencyInfo> = {};

    if (!fs.existsSync(packageJsonPath)) {
      return tree;
    }

    try {
      const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
      const rootDeps = {
        ...packageJson.dependencies,
        ...packageJson.devDependencies,
        ...packageJson.peerDependencies,
        ...packageJson.optionalDependencies
      };

      // Build the complete dependency graph with parent paths
      const dependencyGraph = this.buildDependencyGraph(lockData, rootDeps);

      // Start with root dependencies
      for (const [depName, version] of Object.entries(rootDeps)) {
        const depInfo = this.findDependencyInLockFile(lockData, depName, version as string);
        if (depInfo) {
          tree[depName] = {
            ...depInfo,
            parentPath: []
          };
        }
      }

      return tree;
    } catch (error) {
      debug('Error building dependency tree: %O', error);
      return tree;
    }
  }

  // Build a complete dependency graph with parent paths
  private buildDependencyGraph(lockData: LockFileData, rootDeps: Record<string, string>): Map<string, string[]> {
    const graph = new Map<string, string[]>();

    // Mark root dependencies
    for (const depName of Object.keys(rootDeps)) {
      graph.set(depName, []);
    }

    // Build the graph based on lock file type
    switch (lockData.type) {
      case 'bun':
        // Use bun parser's dependency tree building
        break;
      case 'npm':
        this.npmParser.buildNpmDependencyGraph(lockData as any, graph);
        break;
      case 'pnpm':
        // Use pnpm parser's dependency tree building
        break;
      case 'yarn':
        this.yarnParser.buildYarnDependencyGraph(lockData as any, graph, rootDeps);
        break;
    }

    return graph;
  }


  private findDependencyInLockFile(lockData: LockFileData, name: string, version: string): DependencyInfo | null {
    // Use the appropriate parser based on lock file type
    switch (lockData.type) {
      case 'npm':
        return this.npmParser.findDependencyInLockFile(lockData as any, name, version);
      case 'yarn':
        return this.yarnParser.findDependencyInLockFile(lockData as any, name, version);
      case 'bun':
      case 'pnpm':
        // For bun and pnpm, use basic search
        for (const [key, depInfo] of Object.entries(lockData.dependencies)) {
          if (depInfo.name === name) {
            return depInfo;
          }
        }
        return null;
      default:
        return null;
    }
  }

  // Get the dependency path for a specific package
  getDependencyPath(lockData: LockFileData, packageName: string, version: string): string[] {
    // Use the appropriate parser based on lock file type
    switch (lockData.type) {
      case 'npm':
        return this.npmParser.getDependencyPath(lockData as any, packageName, version);
      case 'yarn':
        return this.yarnParser.getDependencyPath(lockData as any, packageName, version);
      case 'bun':
      case 'pnpm':
        // For bun and pnpm, use basic search
        for (const [path, depInfo] of Object.entries(lockData.dependencies)) {
          if (depInfo.name === packageName) {
            return depInfo.parentPath;
          }
        }
        return [];
      default:
        return [];
    }
  }

  // Get all instances of a package across the dependency tree
  getAllPackageInstances(lockData: LockFileData, packageName: string): DependencyInfo[] {
    // Use the appropriate parser based on lock file type
    switch (lockData.type) {
      case 'npm':
        return this.npmParser.getAllPackageInstances(lockData as any, packageName);
      case 'yarn':
        return this.yarnParser.getAllPackageInstances(lockData as any, packageName);
      case 'bun':
      case 'pnpm':
        // For bun and pnpm, use basic search
        const instances: DependencyInfo[] = [];
        for (const [path, depInfo] of Object.entries(lockData.dependencies)) {
          if (depInfo.name === packageName) {
            instances.push(depInfo);
          }
        }
        return instances;
      default:
        return [];
    }
  }

  // Check if a package is a root dependency
  isRootDependency(lockData: LockFileData, packageName: string, rootDeps: Record<string, string>): boolean {
    // Use the appropriate parser based on lock file type
    switch (lockData.type) {
      case 'npm':
        return this.npmParser.isRootDependency(lockData as any, packageName, rootDeps);
      case 'yarn':
        return this.yarnParser.isRootDependency(lockData as any, packageName, rootDeps);
      case 'bun':
      case 'pnpm':
        return packageName in rootDeps;
      default:
        return false;
    }
  }

  // Build a reverse dependency map to show which packages depend on what
  buildReverseDependencyMap(lockData: LockFileData, projectPath: string): Map<string, string[]> {
    const reverseDeps = new Map<string, string[]>();

    try {
      const packageJsonPath = path.join(projectPath, 'package.json');
      if (!fs.existsSync(packageJsonPath)) {
        return reverseDeps;
      }

      const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
      const rootDeps = {
        ...packageJson.dependencies,
        ...packageJson.devDependencies,
        ...packageJson.peerDependencies,
        ...packageJson.optionalDependencies
      };

      // Based on lock file type, build the reverse dependency map
      switch (lockData.type) {
        case 'bun':
          // Use bun parser's reverse dependency building
          break;
        case 'npm':
          this.npmParser.buildNpmReverseDeps(lockData as any, reverseDeps, rootDeps);
          break;
        case 'pnpm':
          // Use pnpm parser's reverse dependency building
          break;
        case 'yarn':
          this.yarnParser.buildYarnReverseDeps(lockData as any, reverseDeps, rootDeps);
          break;
      }

      return reverseDeps;
    } catch (error) {
      debug('Error building reverse dependency map: %O', error);
      return reverseDeps;
    }
  }

}