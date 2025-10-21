import * as fs from 'fs';
import * as path from 'path';
import { globby } from 'globby';
import createDebug from 'debug';
import type { DependencyInfo } from '../../lockFileParser.js';
import type { WorkspaceInfo } from '../../types.js';

const debug = createDebug('depoptimize:yarn-parser');

// DependencyInfo is imported from the main lockFileParser

export interface YarnLockData {
  type: 'yarn';
  dependencies: Record<string, DependencyInfo>;
}

export class YarnLockParser {
  async parseYarnLock(lockPath: string): Promise<YarnLockData> {
    debug('Parsing yarn.lock');
    const content = fs.readFileSync(lockPath, 'utf-8');
    const dependencies: Record<string, DependencyInfo> = {};

    // Basic yarn.lock parser - this is a simplified version
    // For production use, consider using a dedicated yarn.lock parser library
    const lines = content.split('\n');
    let currentPackage: string | null = null;
    let currentData: any = {};
    let indent = 0;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trim();

      if (!trimmed || trimmed.startsWith('#')) continue;

      const currentIndent = line.length - line.trimStart().length;

      // New package entry
      if (currentIndent === 0 && trimmed.includes('@') && trimmed.endsWith(':')) {
        // Save previous package
        if (currentPackage && currentData.version) {
          const name = currentPackage.split('@')[0].replace(/^"?([^"]+)"?.*$/, '$1');
          dependencies[currentPackage] = {
            name,
            version: currentData.version.replace(/"/g, ''),
            resolved: currentData.resolved?.replace(/"/g, ''),
            integrity: currentData.integrity?.replace(/"/g, ''),
            parentPath: [], // Yarn.lock doesn't have hierarchy info, we'll need to infer
            dependencies: {}
          };
        }

        currentPackage = trimmed.slice(0, -1).replace(/"/g, '');
        currentData = {};
      } else if (currentIndent > 0 && currentPackage) {
        // Package property
        const [key, ...valueParts] = trimmed.split(/:\s+/);
        if (valueParts.length > 0) {
          const value = valueParts.join(': ').replace(/"/g, '');
          currentData[key] = value;
        }
      }
    }

    // Save last package
    if (currentPackage && currentData.version) {
      const name = currentPackage.split('@')[0].replace(/^"?([^"]+)"?.*$/, '$1');
      dependencies[currentPackage] = {
        name,
        version: currentData.version.replace(/"/g, ''),
        resolved: currentData.resolved?.replace(/"/g, ''),
        integrity: currentData.integrity?.replace(/"/g, ''),
        parentPath: [],
        dependencies: {}
      };
    }

    return {
      type: 'yarn',
      dependencies
    };
  }

  buildYarnDependencyGraph(lockData: YarnLockData, graph: Map<string, string[]>, rootDeps: Record<string, string>): void {
    // Yarn.lock doesn't contain hierarchy info, so we use heuristics
    for (const [packageKey, depInfo] of Object.entries(lockData.dependencies)) {
      if (!rootDeps[depInfo.name]) {
        graph.set(depInfo.name, ['(transitive)']);
      }
    }
  }

  buildYarnReverseDeps(
    lockData: YarnLockData,
    reverseDeps: Map<string, string[]>,
    rootDeps: Record<string, string>
  ): void {
    // Yarn lock doesn't contain dependency tree info, so use root detection
    for (const [packageKey, depInfo] of Object.entries(lockData.dependencies)) {
      if (!reverseDeps.has(depInfo.name)) {
        if (rootDeps[depInfo.name]) {
          reverseDeps.set(depInfo.name, ['(root)']);
        } else {
          reverseDeps.set(depInfo.name, ['(transitive)']);
        }
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

  findDependencyInLockFile(lockData: YarnLockData, name: string, version: string): DependencyInfo | null {
    // Look for the dependency in the lock file
    for (const [key, depInfo] of Object.entries(lockData.dependencies)) {
      if (depInfo.name === name) {
        // For yarn, we might have version ranges that need to be matched
        if (this.versionMatches(version, depInfo.version)) {
          return depInfo;
        }
      }
    }
    return null;
  }

  getDependencyPath(lockData: YarnLockData, packageName: string, version: string): string[] {
    // Look for the dependency in the lock file data
    for (const [path, depInfo] of Object.entries(lockData.dependencies)) {
      if (depInfo.name === packageName && this.versionMatches(version, depInfo.version)) {
        return depInfo.parentPath;
      }
    }

    return [];
  }

  getAllPackageInstances(lockData: YarnLockData, packageName: string): DependencyInfo[] {
    const instances: DependencyInfo[] = [];

    for (const [path, depInfo] of Object.entries(lockData.dependencies)) {
      if (depInfo.name === packageName) {
        instances.push(depInfo);
      }
    }

    return instances;
  }

  isRootDependency(lockData: YarnLockData, packageName: string, rootDeps: Record<string, string>): boolean {
    return packageName in rootDeps;
  }

  /**
   * Detect workspace information for yarn projects
   */
  async detectWorkspace(projectPath: string): Promise<WorkspaceInfo> {
    debug('Detecting yarn workspace for path: %s', projectPath);
    
    const workspaceRoot = await this.findWorkspaceRoot(projectPath);
    
    if (!workspaceRoot) {
      debug('No yarn workspace root found, treating as standalone package');
      return {
        rootPath: projectPath,
        workspaceType: null,
        memberPackages: [projectPath],
        isWorkspaceMember: false
      };
    }

    debug('Found yarn workspace root: %s', workspaceRoot);
    
    const memberPackages = await this.findWorkspaceMembers(workspaceRoot);
    const isWorkspaceMember = projectPath !== workspaceRoot;
    
    debug('Yarn workspace info: members=%d, isMember=%s', memberPackages.length, isWorkspaceMember);

    return {
      rootPath: workspaceRoot,
      workspaceType: 'yarn',
      memberPackages,
      isWorkspaceMember
    };
  }

  /**
   * Find the effective lock file path for yarn workspaces
   */
  getEffectiveLockFilePath(projectPath: string, workspaceInfo: WorkspaceInfo): string | null {
    const lockFiles = ['yarn.lock'];

    // First, try to find lock file in workspace root
    for (const lockFile of lockFiles) {
      const rootLockPath = path.join(workspaceInfo.rootPath, lockFile);
      if (fs.existsSync(rootLockPath)) {
        debug('Using yarn workspace root lock file: %s', rootLockPath);
        return rootLockPath;
      }
    }

    // Fall back to local lock file
    for (const lockFile of lockFiles) {
      const localLockPath = path.join(projectPath, lockFile);
      if (fs.existsSync(localLockPath)) {
        debug('Using yarn local lock file: %s', localLockPath);
        return localLockPath;
      }
    }

    debug('No yarn lock file found for project: %s', projectPath);
    return null;
  }

  /**
   * Traverse up directory tree to find yarn workspace root
   */
  private async findWorkspaceRoot(startPath: string): Promise<string | null> {
    let currentPath = path.resolve(startPath);
    const rootPath = path.parse(currentPath).root;

    while (currentPath !== rootPath) {
      debug('Checking for yarn workspace indicators in: %s', currentPath);
      
      // Check for package.json with workspaces field
      const packageJsonPath = path.join(currentPath, 'package.json');
      if (await this.fileExists(packageJsonPath)) {
        try {
          const packageContent = await fs.promises.readFile(packageJsonPath, 'utf-8');
          const packageJson = JSON.parse(packageContent);
          
          if (packageJson.workspaces) {
            debug('Found yarn workspace configuration in package.json at: %s', currentPath);
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
   * Find all yarn workspace member packages
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
      debug('Error finding yarn workspace members: %O', error);
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
