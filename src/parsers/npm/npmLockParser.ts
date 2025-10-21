import * as fs from 'fs';
import * as path from 'path';
import { globby } from 'globby';
import createDebug from 'debug';
import type { DependencyInfo } from '../../lockFileParser.js';
import type { WorkspaceInfo } from '../../types.js';

const debug = createDebug('depoptimize:npm-parser');

// DependencyInfo is imported from the main lockFileParser

export interface NpmLockData {
  type: 'npm';
  dependencies: Record<string, DependencyInfo>;
}

export class NpmLockParser {
  async parsePackageLock(lockPath: string): Promise<NpmLockData> {
    debug('Parsing package-lock.json');
    const content = fs.readFileSync(lockPath, 'utf-8');
    const lockData = JSON.parse(content);

    const dependencies: Record<string, DependencyInfo> = {};

    // Handle both lockfileVersion 1 and 2/3 formats
    if (lockData.lockfileVersion === 1) {
      // v1 format: dependencies are nested
      this.parseV1Dependencies(lockData.dependencies || {}, dependencies, []);
    } else {
      // v2/v3 format: packages are flat with node_modules paths
      this.parseV2Packages(lockData.packages || {}, dependencies);
    }

    return {
      type: 'npm',
      dependencies
    };
  }

  private parseV1Dependencies(
    deps: any,
    result: Record<string, DependencyInfo>,
    parentPath: string[]
  ): void {
    for (const [name, depData] of Object.entries(deps)) {
      const depInfo: DependencyInfo = {
        name,
        version: (depData as any).version,
        resolved: (depData as any).resolved,
        integrity: (depData as any).integrity,
        parentPath: [...parentPath],
        dependencies: {}
      };

      // Create a unique key for this dependency instance
      const key = parentPath.length > 0
        ? `${parentPath.join('/')}/${name}`
        : name;

      result[key] = depInfo;

      // Recursively parse nested dependencies
      if ((depData as any).dependencies) {
        this.parseV1Dependencies(
          (depData as any).dependencies,
          result,
          [...parentPath, name]
        );
      }
    }
  }

  private parseV2Packages(packages: any, result: Record<string, DependencyInfo>): void {
    for (const [packagePath, packageData] of Object.entries(packages)) {
      // Skip the root package entry
      if (packagePath === '' || packagePath === '.') continue;

      // Extract package name and path from the key
      // e.g., "node_modules/react" or "node_modules/@types/node"
      const match = packagePath.match(/^node_modules\/(.+)$/);
      if (!match) continue;

      const fullName = match[1];
      const pathParts = packagePath.split('/').slice(1); // Remove 'node_modules'

      // Handle scoped packages
      let name: string;
      let parentPath: string[] = [];

      if (fullName.startsWith('@')) {
        // Scoped package like @types/node
        const scopedMatch = fullName.match(/^(@[^/]+\/[^/]+)(.*)$/);
        if (scopedMatch) {
          name = scopedMatch[1];
          const remainingPath = scopedMatch[2];
          if (remainingPath) {
            parentPath = remainingPath.split('/').filter(p => p);
          }
        } else {
          name = fullName;
        }
      } else {
        // Regular package
        const parts = pathParts;
        name = parts[0];
        parentPath = parts.slice(1);
      }

      const depInfo: DependencyInfo = {
        name,
        version: (packageData as any).version || 'unknown',
        resolved: (packageData as any).resolved,
        integrity: (packageData as any).integrity,
        parentPath,
        dependencies: {}
      };

      result[packagePath] = depInfo;
    }
  }

  buildNpmDependencyGraph(lockData: NpmLockData, graph: Map<string, string[]>): void {
    // For npm v2+ lock files, the parentPath is already calculated during parsing
    for (const [packagePath, depInfo] of Object.entries(lockData.dependencies)) {
      if (depInfo.parentPath.length > 0) {
        graph.set(depInfo.name, depInfo.parentPath);
      }
    }
  }

  buildNpmReverseDeps(
    lockData: NpmLockData,
    reverseDeps: Map<string, string[]>,
    rootDeps: Record<string, string>
  ): void {
    // For npm, we can use the parent path information
    for (const [packagePath, depInfo] of Object.entries(lockData.dependencies)) {
      if (!reverseDeps.has(depInfo.name)) {
        reverseDeps.set(depInfo.name, []);
      }

      if (rootDeps[depInfo.name]) {
        reverseDeps.get(depInfo.name)!.push('(your project)');
      } else if (depInfo.parentPath.length > 0) {
        // Show the full dependency chain
        const chain = depInfo.parentPath.join(' → ');
        reverseDeps.get(depInfo.name)!.push(`via: ${chain}`);
      } else {
        reverseDeps.get(depInfo.name)!.push('(root dependency)');
      }
    }
  }

  private versionMatches(requested: string, actual: string): boolean {
    // Simple version matching - in production, use semver library
    // Remove common prefixes like ^, ~, >=, etc.
    const cleanRequested = requested.replace(/^[\^~>=<]+/, '');
    const cleanActual = actual.replace(/^[\^~>=<]+/, '');

    return cleanActual.startsWith(cleanRequested) || cleanRequested.startsWith(cleanActual);
  }

  findDependencyInLockFile(lockData: NpmLockData, name: string, version: string): DependencyInfo | null {
    // Look for the dependency in the lock file
    for (const [key, depInfo] of Object.entries(lockData.dependencies)) {
      if (depInfo.name === name) {
        // For npm, we might have version ranges that need to be matched
        if (this.versionMatches(version, depInfo.version)) {
          return depInfo;
        }
      }
    }
    return null;
  }

  getDependencyPath(lockData: NpmLockData, packageName: string, version: string): string[] {
    // Look for the dependency in the lock file data
    for (const [path, depInfo] of Object.entries(lockData.dependencies)) {
      if (depInfo.name === packageName && this.versionMatches(version, depInfo.version)) {
        return depInfo.parentPath;
      }
    }

    return [];
  }

  getAllPackageInstances(lockData: NpmLockData, packageName: string): DependencyInfo[] {
    const instances: DependencyInfo[] = [];

    for (const [path, depInfo] of Object.entries(lockData.dependencies)) {
      if (depInfo.name === packageName) {
        instances.push(depInfo);
      }
    }

    return instances;
  }

  isRootDependency(lockData: NpmLockData, packageName: string, rootDeps: Record<string, string>): boolean {
    return packageName in rootDeps;
  }

  /**
   * Detect workspace information for npm projects
   */
  async detectWorkspace(projectPath: string): Promise<WorkspaceInfo> {
    debug('Detecting npm workspace for path: %s', projectPath);
    
    const workspaceRoot = await this.findWorkspaceRoot(projectPath);
    
    if (!workspaceRoot) {
      debug('No npm workspace root found, treating as standalone package');
      return {
        rootPath: projectPath,
        workspaceType: null,
        memberPackages: [projectPath],
        isWorkspaceMember: false
      };
    }

    debug('Found npm workspace root: %s', workspaceRoot);
    
    const memberPackages = await this.findWorkspaceMembers(workspaceRoot);
    const isWorkspaceMember = projectPath !== workspaceRoot;
    
    debug('Npm workspace info: members=%d, isMember=%s', memberPackages.length, isWorkspaceMember);

    return {
      rootPath: workspaceRoot,
      workspaceType: 'npm',
      memberPackages,
      isWorkspaceMember
    };
  }

  /**
   * Find the effective lock file path for npm workspaces
   */
  getEffectiveLockFilePath(projectPath: string, workspaceInfo: WorkspaceInfo): string | null {
    const lockFiles = ['package-lock.json'];

    // First, try to find lock file in workspace root
    for (const lockFile of lockFiles) {
      const rootLockPath = path.join(workspaceInfo.rootPath, lockFile);
      if (fs.existsSync(rootLockPath)) {
        debug('Using npm workspace root lock file: %s', rootLockPath);
        return rootLockPath;
      }
    }

    // Fall back to local lock file
    for (const lockFile of lockFiles) {
      const localLockPath = path.join(projectPath, lockFile);
      if (fs.existsSync(localLockPath)) {
        debug('Using npm local lock file: %s', localLockPath);
        return localLockPath;
      }
    }

    debug('No npm lock file found for project: %s', projectPath);
    return null;
  }

  /**
   * Traverse up directory tree to find npm workspace root
   */
  private async findWorkspaceRoot(startPath: string): Promise<string | null> {
    let currentPath = path.resolve(startPath);
    const rootPath = path.parse(currentPath).root;

    while (currentPath !== rootPath) {
      debug('Checking for npm workspace indicators in: %s', currentPath);
      
      // Check for package.json with workspaces field
      const packageJsonPath = path.join(currentPath, 'package.json');
      if (await this.fileExists(packageJsonPath)) {
        try {
          const packageContent = await fs.promises.readFile(packageJsonPath, 'utf-8');
          const packageJson = JSON.parse(packageContent);
          
          if (packageJson.workspaces) {
            debug('Found npm workspace configuration in package.json at: %s', currentPath);
            return currentPath;
          }
        } catch (error) {
          debug('Error reading package.json at %s: %O', currentPath, error);
        }
      }

      // Move up one directory
      const parentPath = path.dirname(currentPath);
      if (parentPath === currentPath) {
        break; // Reached root
      }
      currentPath = parentPath;
    }

    return null;
  }

  /**
   * Find all npm workspace member packages
   */
  private async findWorkspaceMembers(workspaceRoot: string): Promise<string[]> {
    const members: string[] = [workspaceRoot]; // Always include root

    try {
      const packageJsonPath = path.join(workspaceRoot, 'package.json');
      const content = await fs.promises.readFile(packageJsonPath, 'utf-8');
      const packageJson = JSON.parse(content);
      
      let workspacePatterns: string[] = [];
      if (packageJson.workspaces) {
        if (Array.isArray(packageJson.workspaces)) {
          workspacePatterns = packageJson.workspaces;
        } else if (packageJson.workspaces.packages) {
          workspacePatterns = packageJson.workspaces.packages;
        }
      }
      
      for (const pattern of workspacePatterns) {
        const workspacePaths = await globby(pattern, {
          cwd: workspaceRoot,
          onlyDirectories: true,
          absolute: true
        });
        
        for (const workspacePath of workspacePaths) {
          if (await this.hasPackageJson(workspacePath) && !members.includes(workspacePath)) {
            members.push(workspacePath);
          }
        }
      }
    } catch (error) {
      debug('Error finding npm workspace members: %O', error);
    }

    return members;
  }

  /**
   * Check if a file exists
   */
  private async fileExists(filePath: string): Promise<boolean> {
    try {
      await fs.promises.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Check if a directory has a package.json file
   */
  private async hasPackageJson(dirPath: string): Promise<boolean> {
    const packageJsonPath = path.join(dirPath, 'package.json');
    return await this.fileExists(packageJsonPath);
  }
}
