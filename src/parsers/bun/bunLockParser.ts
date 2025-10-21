import * as fs from 'fs';
import * as path from 'path';
import { globby } from 'globby';
import createDebug from 'debug';
import { DependencyTreeNode } from '../../types.js';
import type { WorkspaceInfo } from '../../types.js';

const debug = createDebug('depoptimize:bun-lock-parser');

export interface DependencyTree {
  root: DependencyTreeNode;
  allNodes: Map<string, DependencyTreeNode[]>;
  duplicates: Map<string, DependencyTreeNode[]>;
}

export interface BunPackageInfo {
  name: string;
  version: string;
  resolution: string;
  dependencies: Record<string, string>;
  integrity?: string;
  bin?: Record<string, string> | string;
  os?: string;
  cpu?: string;
}

export interface BunWorkspaceInfo {
  name: string;
  dependencies: Record<string, string>;
  devDependencies: Record<string, string>;
  peerDependencies: Record<string, string>;
  optionalDependencies: Record<string, string>;
}

export interface BunLockData {
  lockfileVersion: number;
  workspaces: Record<string, BunWorkspaceInfo>;
  packages: Record<string, BunPackageInfo>;
}

export class BunLockParser {
  private lockData: BunLockData | null = null;
  private rootWorkspace: BunWorkspaceInfo | null = null;

  async parseAndNormalize(lockPath: string): Promise<BunLockData> {
    debug('Parsing and normalizing bun.lock file: %s', lockPath);

    if (!fs.existsSync(lockPath)) {
      throw new Error(`Bun lock file not found: ${lockPath}`);
    }

    let content = fs.readFileSync(lockPath, 'utf-8');
    content = this.sanitizeBunLockContent(content);

    try {
      const rawData = JSON.parse(content);
      const normalized = this.normalizeBunLockData(rawData);

      this.lockData = normalized;
      this.rootWorkspace = normalized.workspaces[''] || Object.values(normalized.workspaces)[0];

      debug('Parsed and normalized bun.lock with %d packages and %d workspaces',
        Object.keys(normalized.packages).length,
        Object.keys(normalized.workspaces).length
      );

      return normalized;
    } catch (error) {
      throw new Error(`Failed to parse bun.lock file: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  buildDependencyTree(maxDepth: number = 20, includeDevDependencies: boolean = true): DependencyTree {
    if (!this.lockData || !this.rootWorkspace) {
      throw new Error('Must parse lock file first before building dependency tree');
    }

    debug('Building dependency tree from lock data');

    const root: DependencyTreeNode = {
      name: this.rootWorkspace.name || 'root',
      version: '1.0.0',
      children: [],
      isRoot: true,
      depth: 0,
      path: []
    };

    const allNodes = new Map<string, DependencyTreeNode[]>();
    const globalProcessedPaths = new Set<string>();

    const allDirectDeps = {
      ...this.rootWorkspace.dependencies,
      ...(includeDevDependencies ? this.rootWorkspace.devDependencies : {}),
      ...this.rootWorkspace.peerDependencies,
      ...this.rootWorkspace.optionalDependencies
    };

    const devDeps = new Set(Object.keys(this.rootWorkspace.devDependencies || {}));

    for (const [depName, versionRange] of Object.entries(allDirectDeps)) {
      const isDevDep = devDeps.has(depName);
      const depNode = this.buildNodeRecursively(
        depName,
        versionRange,
        [depName],
        1,
        isDevDep,
        allNodes,
        globalProcessedPaths,
        maxDepth
      );

      if (depNode) {
        if (!root.children) root.children = [];
        root.children.push(depNode);
      }
    }

    for (const [packageName, instances] of allNodes.entries()) {
      // Note: Duplicate detection is now handled by a separate module
    }

    debug('Built dependency tree with %d total nodes, %d unique packages',
      this.countTotalNodes(root),
      allNodes.size
    );

    return {
      root,
      allNodes,
      duplicates: new Map()
    };
  }

  getPackageInstances(tree: DependencyTree, packageName: string): DependencyTreeNode[] {
    return tree.allNodes.get(packageName) || [];
  }

  getDependencyPath(node: DependencyTreeNode): string {
    // For now, return a simple path representation
    return `${node.name}@${node.version}`;
  }

  findAllPathsToPackage(tree: DependencyTree, packageName: string): string[] {
    const instances = this.getPackageInstances(tree, packageName);
    return instances.map(instance => this.getDependencyPath(instance)).filter(Boolean);
  }

  getPackageInfo(packageName: string): BunPackageInfo | null {
    if (!this.lockData) return null;

    for (const [, packageInfo] of Object.entries(this.lockData.packages)) {
      if (packageInfo.name === packageName) {
        return packageInfo;
      }
    }
    return null;
  }

  hasDuplicates(tree: DependencyTree, packageName: string): boolean {
    // Duplicate detection is now handled by a separate module
    const instances = tree.allNodes.get(packageName) || [];
    return instances.length > 1;
  }

  getDuplicatesSummary(tree: DependencyTree): {
    totalPackages: number;
    duplicatePackages: number;
    totalDuplicateInstances: number;
    duplicates: Array<{
      name: string;
      instances: DependencyTreeNode[];
      versions: string[];
    }>;
  } {
    // Duplicate detection is now handled by a separate module
    const duplicates: Array<{
      name: string;
      instances: DependencyTreeNode[];
      versions: string[];
    }> = [];

    for (const [packageName, instances] of tree.allNodes.entries()) {
      if (instances.length > 1) {
        duplicates.push({
          name: packageName,
          instances,
          versions: [...new Set(instances.map((i: DependencyTreeNode) => i.version as string))]
        });
      }
    }

    return {
      totalPackages: tree.allNodes.size,
      duplicatePackages: duplicates.length,
      totalDuplicateInstances: duplicates.reduce((sum, dup) => sum + dup.instances.length, 0),
      duplicates
    };
  }

  exportTreeAsJson(tree: DependencyTree): string {
    const serializable = {
      root: this.nodeToSerializable(tree.root),
      summary: this.getDuplicatesSummary(tree)
    };

    return JSON.stringify(serializable, null, 2);
  }

  private buildNodeRecursively(
    packageName: string,
    versionRange: string,
    currentPath: string[],
    depth: number,
    isDevDependency: boolean,
    allNodes: Map<string, DependencyTreeNode[]>,
    processedPaths: Set<string>,
    maxDepth: number = 20
  ): DependencyTreeNode | null {
    const pathKey = currentPath.join('→');
    if (processedPaths.has(pathKey) || depth > maxDepth) {
      debug('Skipping %s due to circular dependency or max depth', packageName);
      return null;
    }
    processedPaths.add(pathKey);

    const packageInfo = this.findPackageInLock(packageName, versionRange, currentPath.slice(0, -1));
    if (!packageInfo) {
      debug('Package not found in lock file: %s@%s', packageName, versionRange);
      return null;
    }

    const node: DependencyTreeNode = {
      name: packageName,
      version: packageInfo.version,
      children: [],
      isRoot: depth === 0,
      depth,
      path: currentPath.slice(0, -1), // Remove the current package from the path
      resolved: packageInfo.resolution,
      integrity: packageInfo.integrity,
      isDirect: depth === 1,
      isDevDependency: isDevDependency,
      dependents: []
    };

    // Use composite key of name@version to properly group different versions
    const compositeKey = `${packageName}@${packageInfo.version}`;
    if (!allNodes.has(compositeKey)) {
      allNodes.set(compositeKey, []);
    }
    allNodes.get(compositeKey)!.push(node);

    for (const [depName, depVersionRange] of Object.entries(packageInfo.dependencies || {})) {
      if (currentPath.includes(depName)) {
        debug('Skipping circular dependency: %s -> %s', packageName, depName);
        continue;
      }

      const childNode = this.buildNodeRecursively(
        depName,
        depVersionRange,
        [...currentPath, depName],
        depth + 1,
        isDevDependency,
        allNodes,
        processedPaths,
        maxDepth
      );

      if (childNode) {
        if (!node.children) node.children = [];
        node.children.push(childNode);
      }
    }

    return node;
  }

  private findPackageInLock(packageName: string, versionRange: string, parentPath?: string[]): BunPackageInfo | null {
    if (!this.lockData) return null;

    // Try to find the package in the context of its parent path
    if (parentPath && parentPath.length > 0) {
      const contextPath = `${parentPath[parentPath.length - 1]}/${packageName}`;
      if (this.lockData.packages[contextPath]) {
        const packageInfo = this.lockData.packages[contextPath];
        // Verify this package matches the version range
        if (packageInfo.name === packageName && this.satisfiesVersion(packageInfo.version, versionRange)) {
          debug('Found package %s@%s at context path %s', packageName, packageInfo.version, contextPath);
          return packageInfo;
        }
      }
    }

    // First, try to find the main package entry (not nested under another package)
    if (this.lockData.packages[packageName]) {
      const packageInfo = this.lockData.packages[packageName];
      if (packageInfo.name === packageName && this.satisfiesVersion(packageInfo.version, versionRange)) {
        debug('Found package %s@%s at root path %s', packageName, packageInfo.version, packageName);
        return packageInfo;
      }
    }

    // Look for the package that matches the version range
    // In Bun lock files, the key format is "packageName@version" or "parent/packageName"
    for (const [lockPath, packageInfo] of Object.entries(this.lockData.packages)) {
      if (packageInfo.name === packageName) {
        // Check if this version satisfies the version range
        if (this.satisfiesVersion(packageInfo.version, versionRange)) {
          debug('Found package %s@%s at lock path %s', packageName, packageInfo.version, lockPath);
          return packageInfo;
        }
      }
    }

    // If no version satisfies the range, return null instead of falling back to wrong version
    debug('No package found for %s@%s that satisfies version range', packageName, versionRange);
    return null;
  }

  private satisfiesVersion(version: string, range: string): boolean {
    // Simple version range matching - this could be enhanced with proper semver parsing
    if (range.startsWith('^')) {
      const rangeVersion = range.substring(1);
      const rangeMajor = rangeVersion.split('.')[0];
      const versionMajor = version.split('.')[0];
      return versionMajor === rangeMajor;
    } else if (range.startsWith('~')) {
      const rangeVersion = range.substring(1);
      const rangeParts = rangeVersion.split('.');
      const versionParts = version.split('.');
      return rangeParts[0] === versionParts[0] && rangeParts[1] === versionParts[1];
    } else if (range === version) {
      return true;
    }
    // For exact version matches
    return version === range;
  }

  private sanitizeBunLockContent(content: string): string {
    content = content.replace(/,(\s*[}\]])/g, '$1');
    return content;
  }

  private countTotalNodes(node: DependencyTreeNode): number {
    let count = 1;
    if (node.children) {
      for (const child of node.children) {
        count += this.countTotalNodes(child);
      }
    }
    return count;
  }

  private parsePackageArray(packageKey: string, packageArray: any[]): BunPackageInfo | null {
    if (!Array.isArray(packageArray) || packageArray.length < 3) {
      debug('Invalid package array format for %s', packageKey);
      return null;
    }

    const [fullVersion, resolution, dependencyInfo, integrity] = packageArray;

    const nameVersionMatch = fullVersion.match(/^(.+)@([^@]+)$/);
    if (!nameVersionMatch) {
      debug('Could not parse name and version from: %s', fullVersion);
      return null;
    }

    const [, name, version] = nameVersionMatch;

    const packageInfo: BunPackageInfo = {
      name,
      version,
      resolution: resolution || '',
      dependencies: {},
      integrity
    };

    if (dependencyInfo && typeof dependencyInfo === 'object') {
      if (dependencyInfo.dependencies) {
        packageInfo.dependencies = dependencyInfo.dependencies;
      }
      if (dependencyInfo.bin) {
        packageInfo.bin = dependencyInfo.bin;
      }
      if (dependencyInfo.os) {
        packageInfo.os = dependencyInfo.os;
      }
      if (dependencyInfo.cpu) {
        packageInfo.cpu = dependencyInfo.cpu;
      }
    }

    return packageInfo;
  }

  private normalizeBunLockData(rawData: any): BunLockData {
    const normalized: BunLockData = {
      lockfileVersion: rawData.lockfileVersion || 1,
      workspaces: {},
      packages: {}
    };

    if (rawData.workspaces) {
      for (const [key, workspace] of Object.entries(rawData.workspaces)) {
        normalized.workspaces[key] = {
          name: (workspace as any).name || '',
          dependencies: (workspace as any).dependencies || {},
          devDependencies: (workspace as any).devDependencies || {},
          peerDependencies: (workspace as any).peerDependencies || {},
          optionalDependencies: (workspace as any).optionalDependencies || {}
        };
      }
    }

    if (rawData.packages) {
      for (const [key, packageArray] of Object.entries(rawData.packages)) {
        const packageInfo = this.parsePackageArray(key, packageArray as any[]);
        if (packageInfo) {
          normalized.packages[key] = packageInfo;
        }
      }
    }

    return normalized;
  }

  private nodeToSerializable(node: DependencyTreeNode): any {
    return {
      name: node.name,
      version: node.version,
      depth: node.depth,
      isRoot: node.isRoot,
      childrenCount: node.children?.length || 0
    };
  }

  /**
   * Detect workspace information for bun projects
   */
  async detectWorkspace(projectPath: string): Promise<WorkspaceInfo> {
    debug('Detecting bun workspace for path: %s', projectPath);
    
    const workspaceRoot = await this.findWorkspaceRoot(projectPath);
    
    if (!workspaceRoot) {
      debug('No bun workspace root found, treating as standalone package');
      return {
        rootPath: projectPath,
        workspaceType: null,
        memberPackages: [projectPath],
        isWorkspaceMember: false
      };
    }

    debug('Found bun workspace root: %s', workspaceRoot);
    
    const memberPackages = await this.findWorkspaceMembers(workspaceRoot);
    const isWorkspaceMember = projectPath !== workspaceRoot;
    
    debug('Bun workspace info: members=%d, isMember=%s', memberPackages.length, isWorkspaceMember);

    return {
      rootPath: workspaceRoot,
      workspaceType: 'npm', // Bun workspaces use npm-style configuration
      memberPackages,
      isWorkspaceMember
    };
  }

  /**
   * Find the effective lock file path for bun workspaces
   */
  getEffectiveLockFilePath(projectPath: string, workspaceInfo: WorkspaceInfo): string | null {
    const lockFiles = ['bun.lock'];

    // First, try to find lock file in workspace root
    for (const lockFile of lockFiles) {
      const rootLockPath = path.join(workspaceInfo.rootPath, lockFile);
      if (fs.existsSync(rootLockPath)) {
        debug('Using bun workspace root lock file: %s', rootLockPath);
        return rootLockPath;
      }
    }

    // Fall back to local lock file
    for (const lockFile of lockFiles) {
      const localLockPath = path.join(projectPath, lockFile);
      if (fs.existsSync(localLockPath)) {
        debug('Using bun local lock file: %s', localLockPath);
        return localLockPath;
      }
    }

    debug('No bun lock file found for project: %s', projectPath);
    return null;
  }

  /**
   * Traverse up directory tree to find bun workspace root
   */
  private async findWorkspaceRoot(startPath: string): Promise<string | null> {
    let currentPath = path.resolve(startPath);
    const rootPath = path.parse(currentPath).root;

    while (currentPath !== rootPath) {
      debug('Checking for bun workspace indicators in: %s', currentPath);
      
      // Check for package.json with workspaces field
      const packageJsonPath = path.join(currentPath, 'package.json');
      if (await this.fileExists(packageJsonPath)) {
        try {
          const packageContent = await fs.promises.readFile(packageJsonPath, 'utf-8');
          const packageJson = JSON.parse(packageContent);
          
          if (packageJson.workspaces) {
            debug('Found bun workspace configuration in package.json at: %s', currentPath);
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
   * Find all bun workspace member packages
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
      debug('Error finding bun workspace members: %O', error);
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