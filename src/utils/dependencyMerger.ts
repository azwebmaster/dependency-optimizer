import * as fs from 'fs';
import * as path from 'path';
import type { PackageJson } from '../types.js';
import type { WorkspaceInfo } from './workspaceDetector.js';
import createDebug from 'debug';

const debug = createDebug('depoptimize:dependency-merger');

export interface MergedPackageInfo {
  originalDeps: PackageJson;
  rootDeps: PackageJson;
  mergedDeps: PackageJson;
  workspaceRoot: string;
  workspaceType: string | null;
}

export class DependencyMerger {
  /**
   * Merge dependencies from workspace root into workspace package
   */
  static async mergeDependenciesWithWorkspaceRoot(
    workspacePackagePath: string,
    workspaceInfo: WorkspaceInfo
  ): Promise<MergedPackageInfo> {
    debug('Merging dependencies for workspace package: %s', workspacePackagePath);
    debug('Workspace root: %s, type: %s', workspaceInfo.rootPath, workspaceInfo.workspaceType);

    // Read workspace package's package.json
    const workspacePackageJson = await this.readPackageJson(workspacePackagePath);
    if (!workspacePackageJson) {
      throw new Error(`No package.json found in workspace package: ${workspacePackagePath}`);
    }

    // Read workspace root's package.json
    const rootPackageJson = await this.readPackageJson(workspaceInfo.rootPath);
    if (!rootPackageJson) {
      debug('No root package.json found, using workspace package as-is');
      return {
        originalDeps: workspacePackageJson,
        rootDeps: workspacePackageJson,
        mergedDeps: workspacePackageJson,
        workspaceRoot: workspaceInfo.rootPath,
        workspaceType: workspaceInfo.workspaceType
      };
    }

    // Merge dependencies
    const mergedDeps = this.mergeDependencyObjects(workspacePackageJson, rootPackageJson);

    debug('Merged dependencies: %d total deps, %d dev deps, %d peer deps',
          Object.keys(mergedDeps.dependencies || {}).length,
          Object.keys(mergedDeps.devDependencies || {}).length,
          Object.keys(mergedDeps.peerDependencies || {}).length);

    return {
      originalDeps: workspacePackageJson,
      rootDeps: rootPackageJson,
      mergedDeps,
      workspaceRoot: workspaceInfo.rootPath,
      workspaceType: workspaceInfo.workspaceType
    };
  }

  /**
   * Read and parse package.json from a given path
   */
  private static async readPackageJson(packagePath: string): Promise<PackageJson | null> {
    const packageJsonPath = path.join(packagePath, 'package.json');
    
    try {
      if (!fs.existsSync(packageJsonPath)) {
        return null;
      }

      const content = await fs.promises.readFile(packageJsonPath, 'utf-8');
      return JSON.parse(content);
    } catch (error) {
      debug('Error reading package.json at %s: %O', packageJsonPath, error);
      return null;
    }
  }

  /**
   * Merge two package.json dependency objects
   * Workspace package dependencies take precedence over root dependencies
   */
  private static mergeDependencyObjects(
    workspacePackage: PackageJson,
    rootPackage: PackageJson
  ): PackageJson {
    const merged: PackageJson = {
      ...workspacePackage
    };

    // Merge dependencies
    merged.dependencies = this.mergeDependencySection(
      workspacePackage.dependencies,
      rootPackage.dependencies
    );

    // Merge devDependencies
    merged.devDependencies = this.mergeDependencySection(
      workspacePackage.devDependencies,
      rootPackage.devDependencies
    );

    // Merge peerDependencies
    merged.peerDependencies = this.mergeDependencySection(
      workspacePackage.peerDependencies,
      rootPackage.peerDependencies
    );

    // Merge optionalDependencies
    merged.optionalDependencies = this.mergeDependencySection(
      workspacePackage.optionalDependencies,
      rootPackage.optionalDependencies
    );

    return merged;
  }

  /**
   * Merge a specific dependency section (dependencies, devDependencies, etc.)
   */
  private static mergeDependencySection(
    workspaceDeps: Record<string, string> | undefined,
    rootDeps: Record<string, string> | undefined
  ): Record<string, string> | undefined {
    const merged: Record<string, string> = {};

    // Start with root dependencies
    if (rootDeps) {
      Object.assign(merged, rootDeps);
    }

    // Override with workspace dependencies (workspace takes precedence)
    if (workspaceDeps) {
      Object.assign(merged, workspaceDeps);
    }

    // Return undefined if no dependencies
    return Object.keys(merged).length > 0 ? merged : undefined;
  }

  /**
   * Get the effective lock file path for a workspace package
   * This will prefer the workspace root lock file over local lock files
   */
  static getEffectiveLockFilePath(workspacePackagePath: string, workspaceInfo: WorkspaceInfo): string | null {
    const lockFiles = [
      'package-lock.json',
      'bun.lock',
      'pnpm-lock.yaml',
      'yarn.lock'
    ];

    // First, try to find lock file in workspace root
    for (const lockFile of lockFiles) {
      const rootLockPath = path.join(workspaceInfo.rootPath, lockFile);
      if (fs.existsSync(rootLockPath)) {
        debug('Using workspace root lock file: %s', rootLockPath);
        return rootLockPath;
      }
    }

    // Fall back to local lock file
    for (const lockFile of lockFiles) {
      const localLockPath = path.join(workspacePackagePath, lockFile);
      if (fs.existsSync(localLockPath)) {
        debug('Using local lock file: %s', localLockPath);
        return localLockPath;
      }
    }

    debug('No lock file found for workspace package: %s', workspacePackagePath);
    return null;
  }

  /**
   * Get the effective node_modules path for a workspace package
   * This will check both workspace root and local node_modules
   */
  static getEffectiveNodeModulesPaths(workspacePackagePath: string, workspaceInfo: WorkspaceInfo): string[] {
    const paths: string[] = [];

    // Add workspace root node_modules
    const rootNodeModules = path.join(workspaceInfo.rootPath, 'node_modules');
    if (fs.existsSync(rootNodeModules)) {
      paths.push(rootNodeModules);
    }

    // Add local node_modules (if different from root)
    if (workspacePackagePath !== workspaceInfo.rootPath) {
      const localNodeModules = path.join(workspacePackagePath, 'node_modules');
      if (fs.existsSync(localNodeModules)) {
        paths.push(localNodeModules);
      }
    }

    debug('Effective node_modules paths: %O', paths);
    return paths;
  }
}

