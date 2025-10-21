import * as fs from 'fs';
import * as path from 'path';
import { globby } from 'globby';
import createDebug from 'debug';
import * as yaml from 'js-yaml';
import { DependencyTreeNode } from '../../types.js';
import type { DependencyTree } from '../bun/bunLockParser.js';
import type { WorkspaceInfo } from '../../types.js';

const debug = createDebug('depoptimize:pnpm-lock-parser');

// DependencyTree interface is defined in bun parser to avoid duplication

export interface PnpmPackageInfo {
  name: string;
  version: string;
  resolution: {
    integrity?: string;
    tarball?: string;
    [key: string]: any;
  };
  engines?: Record<string, string>;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
  peerDependenciesMeta?: Record<string, { optional?: boolean }>;
  transitivePeerDependencies?: string[];
  [key: string]: any;
}

export interface PnpmImporterInfo {
  dependencies?: Record<string, { specifier: string; version: string }>;
  devDependencies?: Record<string, { specifier: string; version: string }>;
  [key: string]: any;
}

export interface PnpmLockData {
  lockfileVersion: string | number;
  settings?: {
    autoInstallPeers?: boolean;
    excludeLinksFromLockfile?: boolean;
    [key: string]: any;
  };
  importers: Record<string, PnpmImporterInfo>;
  packages: Record<string, PnpmPackageInfo>;
  snapshots?: Record<string, any>;
}

export class PnpmLockParser {
  private lockData: PnpmLockData | null = null;
  private rootImporter: PnpmImporterInfo | null = null;

  async parseAndNormalize(lockPath: string): Promise<PnpmLockData> {
    debug('Parsing and normalizing pnpm-lock.yaml file: %s', lockPath);

    if (!fs.existsSync(lockPath)) {
      throw new Error(`Pnpm lock file not found: ${lockPath}`);
    }

    const content = fs.readFileSync(lockPath, 'utf-8');
    const isYaml = lockPath.endsWith('.yaml') || lockPath.endsWith('.yml');

    let rawData: any;
    try {
      if (isYaml) {
        rawData = yaml.load(content);
      } else {
        rawData = JSON.parse(content);
      }

      const normalized = this.normalizePnpmLockData(rawData);
      this.lockData = normalized;
      this.rootImporter = normalized.importers['.'] || normalized.importers[''] || Object.values(normalized.importers)[0];

      debug('Parsed and normalized pnpm-lock with %d packages and %d importers',
        Object.keys(normalized.packages).length,
        Object.keys(normalized.importers).length
      );

      return normalized;
    } catch (error) {
      throw new Error(`Failed to parse pnpm lock file: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  buildDependencyTree(maxDepth: number = 20, includeDevDependencies: boolean = true): DependencyTree {
    if (!this.lockData || !this.rootImporter) {
      throw new Error('Must parse lock file first before building dependency tree');
    }

    debug('Building dependency tree from lock data');

    const root: DependencyTreeNode = {
      name: 'root',
      version: '1.0.0',
      children: [],
      isRoot: true,
      depth: 0,
      path: []
    };

    const allNodes = new Map<string, DependencyTreeNode[]>();
    const processedPaths = new Set<string>();

    const allDirectDeps = this.collectAllDirectDependencies(includeDevDependencies);

    for (const [depName, depInfo] of Object.entries(allDirectDeps)) {
      const isDevDep = this.isDevDependency(depName);
      const depNode = this.buildNodeRecursively(
        depName,
        depInfo.version,
        [depName],
        1,
        isDevDep,
        allNodes,
        processedPaths,
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

  getPackageInfo(packageName: string): PnpmPackageInfo | null {
    if (!this.lockData) return null;

    // Try to find exact package match
    for (const [key, packageInfo] of Object.entries(this.lockData.packages)) {
      if (packageInfo.name === packageName) {
        return packageInfo;
      }
    }

    // Try to find by package key pattern (name@version)
    for (const [key, packageInfo] of Object.entries(this.lockData.packages)) {
      if (key.startsWith(`${packageName}@`)) {
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

  private collectAllDirectDependencies(includeDevDependencies: boolean = true): Record<string, { specifier: string; version: string }> {
    const allDeps: Record<string, { specifier: string; version: string }> = {};

    if (!this.rootImporter) return allDeps;

    // Collect dependencies
    if (this.rootImporter.dependencies) {
      Object.assign(allDeps, this.rootImporter.dependencies);
    }

    // Collect devDependencies
    if (includeDevDependencies && this.rootImporter.devDependencies) {
      Object.assign(allDeps, this.rootImporter.devDependencies);
    }

    return allDeps;
  }

  private isDevDependency(packageName: string): boolean {
    if (!this.rootImporter?.devDependencies) return false;
    return packageName in this.rootImporter.devDependencies;
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
      resolved: packageInfo.resolution?.tarball || packageInfo.resolution?.integrity,
      integrity: packageInfo.resolution?.integrity,
      isDirect: depth === 1,
      isDevDependency: isDevDependency,
      dependents: []
    };

    // Use composite key format: name@version (consistent with other parsers)
    const compositeKey = `${packageName}@${packageInfo.version}`;
    if (!allNodes.has(compositeKey)) {
      allNodes.set(compositeKey, []);
    }
    allNodes.get(compositeKey)!.push(node);

    // Build dependencies from snapshots if available
    if (this.lockData?.snapshots) {
      const snapshotKey = this.findSnapshotKey(packageName, packageInfo.version);
      if (snapshotKey && this.lockData.snapshots[snapshotKey]) {
        const snapshot = this.lockData.snapshots[snapshotKey];
        if (snapshot.dependencies) {
          for (const [depName, depVersion] of Object.entries(snapshot.dependencies)) {
            if (currentPath.includes(depName)) {
              debug('Skipping circular dependency: %s -> %s', packageName, depName);
              continue;
            }

            const childNode = this.buildNodeRecursively(
              depName,
              depVersion as string,
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
        }
      }
    } else {
      // Fallback to package dependencies
      const allDeps = {
        ...packageInfo.dependencies,
        ...packageInfo.peerDependencies
      };

      for (const [depName, depVersionRange] of Object.entries(allDeps || {})) {
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
    }

    return node;
  }

  private findPackageInLock(packageName: string, versionRange: string, parentPath?: string[]): PnpmPackageInfo | null {
    if (!this.lockData) return null;

    // Try to find by exact package key
    const exactKey = `${packageName}@${versionRange}`;
    if (this.lockData.packages[exactKey]) {
      return this.lockData.packages[exactKey];
    }

    // Try to find by package name match
    for (const [key, packageInfo] of Object.entries(this.lockData.packages)) {
      if (packageInfo.name === packageName) {
        return packageInfo;
      }
    }

    return null;
  }

  private findSnapshotKey(packageName: string, version: string): string | null {
    if (!this.lockData?.snapshots) return null;

    // Try exact match
    const exactKey = `${packageName}@${version}`;
    if (this.lockData.snapshots[exactKey]) {
      return exactKey;
    }

    // Try to find a matching snapshot
    for (const key of Object.keys(this.lockData.snapshots)) {
      if (key.startsWith(`${packageName}@`)) {
        return key;
      }
    }

    return null;
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

  private normalizePnpmLockData(rawData: any): PnpmLockData {
    const normalized: PnpmLockData = {
      lockfileVersion: rawData.lockfileVersion || '1.0',
      settings: rawData.settings || {},
      importers: {},
      packages: {},
      snapshots: rawData.snapshots || {}
    };

    // Normalize importers
    if (rawData.importers) {
      for (const [key, importer] of Object.entries(rawData.importers)) {
        normalized.importers[key] = {
          dependencies: (importer as any).dependencies || {},
          devDependencies: (importer as any).devDependencies || {}
        };
      }
    }

    // Normalize packages
    if (rawData.packages) {
      for (const [key, packageInfo] of Object.entries(rawData.packages)) {
        const pkg = packageInfo as any;
        normalized.packages[key] = {
          name: pkg.name || key.split('@')[0],
          version: pkg.version || key.split('@')[1] || '0.0.0',
          resolution: pkg.resolution || {},
          engines: pkg.engines,
          dependencies: pkg.dependencies,
          devDependencies: pkg.devDependencies,
          peerDependencies: pkg.peerDependencies,
          peerDependenciesMeta: pkg.peerDependenciesMeta,
          transitivePeerDependencies: pkg.transitivePeerDependencies
        };
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
   * Detect workspace information for pnpm projects
   */
  async detectWorkspace(projectPath: string): Promise<WorkspaceInfo> {
    debug('Detecting pnpm workspace for path: %s', projectPath);
    
    const workspaceRoot = await this.findWorkspaceRoot(projectPath);
    
    if (!workspaceRoot) {
      debug('No pnpm workspace root found, treating as standalone package');
      return {
        rootPath: projectPath,
        workspaceType: null,
        memberPackages: [projectPath],
        isWorkspaceMember: false
      };
    }

    debug('Found pnpm workspace root: %s', workspaceRoot);
    
    const memberPackages = await this.findWorkspaceMembers(workspaceRoot);
    const isWorkspaceMember = projectPath !== workspaceRoot;
    
    debug('Pnpm workspace info: members=%d, isMember=%s', memberPackages.length, isWorkspaceMember);

    return {
      rootPath: workspaceRoot,
      workspaceType: 'pnpm',
      memberPackages,
      isWorkspaceMember
    };
  }

  /**
   * Find the effective lock file path for pnpm workspaces
   */
  getEffectiveLockFilePath(projectPath: string, workspaceInfo: WorkspaceInfo): string | null {
    const lockFiles = ['pnpm-lock.yaml'];

    // First, try to find lock file in workspace root
    for (const lockFile of lockFiles) {
      const rootLockPath = path.join(workspaceInfo.rootPath, lockFile);
      if (fs.existsSync(rootLockPath)) {
        debug('Using pnpm workspace root lock file: %s', rootLockPath);
        return rootLockPath;
      }
    }

    // Fall back to local lock file
    for (const lockFile of lockFiles) {
      const localLockPath = path.join(projectPath, lockFile);
      if (fs.existsSync(localLockPath)) {
        debug('Using pnpm local lock file: %s', localLockPath);
        return localLockPath;
      }
    }

    debug('No pnpm lock file found for project: %s', projectPath);
    return null;
  }

  /**
   * Traverse up directory tree to find pnpm workspace root
   */
  private async findWorkspaceRoot(startPath: string): Promise<string | null> {
    let currentPath = path.resolve(startPath);
    const rootPath = path.parse(currentPath).root;

    while (currentPath !== rootPath) {
      debug('Checking for pnpm workspace indicators in: %s', currentPath);
      
      // Check for pnpm-workspace.yaml
      const pnpmWorkspacePath = path.join(currentPath, 'pnpm-workspace.yaml');
      if (await this.fileExists(pnpmWorkspacePath)) {
        debug('Found pnpm workspace configuration at: %s', currentPath);
        return currentPath;
      }

      // Check for package.json with workspaces field (fallback)
      const packageJsonPath = path.join(currentPath, 'package.json');
      if (await this.fileExists(packageJsonPath)) {
        try {
          const packageContent = await fs.promises.readFile(packageJsonPath, 'utf-8');
          const packageJson = JSON.parse(packageContent);
          
          if (packageJson.workspaces) {
            debug('Found pnpm workspace configuration in package.json at: %s', currentPath);
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
   * Find all pnpm workspace member packages
   */
  private async findWorkspaceMembers(workspaceRoot: string): Promise<string[]> {
    const members: string[] = [workspaceRoot]; // Always include root

    try {
      // First try pnpm-workspace.yaml
      const pnpmWorkspacePath = path.join(workspaceRoot, 'pnpm-workspace.yaml');
      if (await this.fileExists(pnpmWorkspacePath)) {
        const content = await fs.promises.readFile(pnpmWorkspacePath, 'utf-8');
        const patterns = this.parsePnpmWorkspacePatterns(content);
        
        for (const pattern of patterns) {
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
      } else {
        // Fallback to package.json workspaces
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
      }
    } catch (error) {
      debug('Error finding pnpm workspace members: %O', error);
    }

    return members;
  }

  /**
   * Parse pnpm workspace patterns from pnpm-workspace.yaml content
   */
  private parsePnpmWorkspacePatterns(content: string): string[] {
    const patterns: string[] = [];
    const lines = content.split('\n');
    
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#')) {
        // Remove quotes if present
        const pattern = trimmed.replace(/^['"]|['"]$/g, '');
        patterns.push(pattern);
      }
    }
    
    return patterns;
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