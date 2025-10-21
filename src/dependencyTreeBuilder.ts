import * as fs from 'fs';
import * as path from 'path';
import createDebug from 'debug';
import type { LockFileData } from './lockFileParser.js';
import type { DependencyTreeNode } from './types.js';

const debug = createDebug('depoptimize:tree-builder');

export interface DependencyNode {
  name: string;
  version: string;
  children: Map<string, DependencyNode>;
  parents: string[];
  isRoot: boolean;
}


export interface DependencyPath {
  packageName: string;
  version: string;
  path: string[];
}

export class DependencyTreeBuilder {
  private lockData: LockFileData | null = null;
  private rootDependencies: Set<string> = new Set();
  private packageDependencies: Map<string, string[]> = new Map();
  private packageVersions: Map<string, string> = new Map();

  constructor(lockData: LockFileData | null, projectPath: string, includeDev: boolean = false) {
    this.lockData = lockData;
    this.loadRootDependencies(projectPath, includeDev);
    this.parsePackageDependencies();
  }

  private loadRootDependencies(projectPath: string, includeDev: boolean = false): void {
    try {
      const packageJsonPath = path.join(projectPath, 'package.json');
      if (fs.existsSync(packageJsonPath)) {
        const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
        const allDeps = {
          ...packageJson.dependencies,
          ...(includeDev ? packageJson.devDependencies : {}),
          ...packageJson.peerDependencies,
          ...packageJson.optionalDependencies
        };

        for (const depName of Object.keys(allDeps)) {
          this.rootDependencies.add(depName);
        }
      }
    } catch (error) {
      debug('Error loading root dependencies: %O', error);
    }
  }

  private parsePackageDependencies(): void {
    if (!this.lockData) {
      return;
    }

    try {
      // Parse dependencies based on lock file type
      switch (this.lockData.type) {
        case 'bun':
          this.parseBunDependencies();
          break;
        case 'npm':
          this.parseNpmDependencies();
          break;
        case 'pnpm':
          this.parsePnpmDependencies();
          break;
        case 'yarn':
          this.parseYarnDependencies();
          break;
        default:
          debug('Unknown lock file type: %s', this.lockData.type);
      }

      debug('Parsed %d packages with dependencies', this.packageDependencies.size);
    } catch (error) {
      debug('Error parsing package dependencies: %O', error);
    }
  }

  private parseBunDependencies(): void {
    // Read the lock file again to get the raw data
    const lockFilePath = path.join(process.cwd(), 'bun.lock');
    if (!fs.existsSync(lockFilePath)) return;

    let content = fs.readFileSync(lockFilePath, 'utf-8');
    content = content.replace(/,(\s*[}\]])/g, '$1'); // Fix trailing commas
    const lockData = JSON.parse(content);

    if (lockData.packages) {
      for (const [, packageArray] of Object.entries(lockData.packages)) {
        if (!Array.isArray(packageArray) || packageArray.length < 3) continue;

        const [fullVersion, , dependencyInfo] = packageArray;

        // Extract package name and version
        const nameVersionMatch = fullVersion.match(/^(.+)@([^@]+)$/);
        if (!nameVersionMatch) continue;

        const [, name, version] = nameVersionMatch;
        this.packageVersions.set(name, version);

        // Extract dependencies
        if (dependencyInfo && typeof dependencyInfo === 'object' && dependencyInfo.dependencies) {
          const dependencies = Object.keys(dependencyInfo.dependencies);
          this.packageDependencies.set(name, dependencies);
        } else {
          this.packageDependencies.set(name, []);
        }
      }
    }
  }

  private parseNpmDependencies(): void {
    // For npm, we need to read the actual package-lock.json to get dependency information
    const lockFilePath = path.join(process.cwd(), 'package-lock.json');
    if (!fs.existsSync(lockFilePath)) return;

    try {
      const content = fs.readFileSync(lockFilePath, 'utf-8');
      const lockData = JSON.parse(content);

      // Handle both lockfileVersion 1 and 2/3 formats
      if (lockData.lockfileVersion === 1) {
        this.parseNpmV1Dependencies(lockData);
      } else {
        this.parseNpmV2Dependencies(lockData);
      }
    } catch (error) {
      debug('Error parsing npm lock file: %O', error);
    }
  }

  private parseNpmV1Dependencies(lockData: any): void {
    // v1 format: dependencies are nested
    const parseDeps = (deps: any, parentName?: string) => {
      for (const [name, depData] of Object.entries(deps)) {
        const version = (depData as any).version;
        this.packageVersions.set(name, version);
        
        const dependencies: string[] = [];
        if ((depData as any).dependencies) {
          dependencies.push(...Object.keys((depData as any).dependencies));
        }
        
        this.packageDependencies.set(name, dependencies);
        
        // Recursively parse nested dependencies
        if ((depData as any).dependencies) {
          parseDeps((depData as any).dependencies, name);
        }
      }
    };

    if (lockData.dependencies) {
      parseDeps(lockData.dependencies);
    }
  }

  private parseNpmV2Dependencies(lockData: any): void {
    // v2/v3 format: packages are flat with node_modules paths
    for (const [packagePath, packageData] of Object.entries(lockData.packages || {})) {
      // Skip the root package entry
      if (packagePath === '' || packagePath === '.') continue;

      // Extract package name from the path
      const match = packagePath.match(/^node_modules\/(.+)$/);
      if (!match) continue;

      const fullName = match[1];
      let name: string;

      if (fullName.startsWith('@')) {
        // Scoped package like @types/node
        const scopedMatch = fullName.match(/^(@[^/]+\/[^/]+)/);
        if (scopedMatch) {
          name = scopedMatch[1];
        } else {
          name = fullName;
        }
      } else {
        // Regular package
        name = fullName.split('/')[0];
      }

      const version = (packageData as any).version || 'unknown';
      this.packageVersions.set(name, version);

      // Extract dependencies from the package data
      const dependencies: string[] = [];
      if ((packageData as any).dependencies) {
        // For npm v2/v3, the dependencies field contains the actual dependency names
        dependencies.push(...Object.keys((packageData as any).dependencies));
      }
      
      this.packageDependencies.set(name, dependencies);
    }
  }

  private parsePnpmDependencies(): void {
    // For pnpm, we can extract dependencies from the lockData.dependencies
    for (const [packageKey, depInfo] of Object.entries(this.lockData!.dependencies)) {
      const name = depInfo.name;
      const version = depInfo.version;
      
      this.packageVersions.set(name, version);
      
      // For pnpm, we'd need to parse the actual lock file structure
      // This is a simplified approach
      this.packageDependencies.set(name, []);
    }
  }

  private parseYarnDependencies(): void {
    // For yarn, we can extract dependencies from the lockData.dependencies
    for (const [packageKey, depInfo] of Object.entries(this.lockData!.dependencies)) {
      const name = depInfo.name;
      const version = depInfo.version;
      
      this.packageVersions.set(name, version);
      
      // For yarn, we'd need to parse the actual lock file structure
      // This is a simplified approach
      this.packageDependencies.set(name, []);
    }
  }

  // Find all paths from root dependencies to a target package
  findPathsToPackage(targetPackage: string): DependencyPath[] {
    const paths: DependencyPath[] = [];
    const visited = new Set<string>();

    // Start from each root dependency
    for (const rootDep of this.rootDependencies) {
      this.findPathsRecursive(rootDep, targetPackage, [rootDep], visited, paths, 0);
    }

    return paths;
  }

  private findPathsRecursive(
    currentPackage: string,
    targetPackage: string,
    currentPath: string[],
    visited: Set<string>,
    paths: DependencyPath[],
    depth: number = 0
  ): void {
    // Limit recursion depth to prevent stack overflow
    if (depth > 10) return;

    // Avoid cycles - check if current package is already in the path
    if (currentPath.slice(0, -1).includes(currentPackage)) {
      return;
    }

    // If we found the target, add the path
    if (currentPackage === targetPackage) {
      const version = this.packageVersions.get(targetPackage) || 'unknown';
      paths.push({
        packageName: targetPackage,
        version,
        path: [...currentPath]
      });
      return;
    }

    // Create a unique key for this search state
    const searchKey = `${currentPackage}->${targetPackage}:${depth}`;
    if (visited.has(searchKey)) return;
    visited.add(searchKey);

    // Recurse into dependencies
    const dependencies = this.packageDependencies.get(currentPackage) || [];
    for (const dep of dependencies) {
      this.findPathsRecursive(dep, targetPackage, [...currentPath, dep], visited, paths, depth + 1);
    }
  }

  // Get all packages that depend on a target package
  getPackagesDependingOn(targetPackage: string): string[] {
    const dependents: string[] = [];

    for (const [packageName, dependencies] of this.packageDependencies.entries()) {
      if (dependencies.includes(targetPackage)) {
        dependents.push(packageName);
      }
    }

    return dependents;
  }

  // Build a complete dependency tree for a package
  buildDependencyTree(packageName: string): string[] {
    const paths = this.findPathsToPackage(packageName);

    if (paths.length === 0) {
      // Check if it's a root dependency
      if (this.rootDependencies.has(packageName)) {
        return ['(your project)'];
      }
      return ['(not found in dependency tree)'];
    }

    // Format the paths for display
    const formattedPaths = paths.map(path => {
      if (path.path.length === 1) {
        return '(your project)';
      }
      return path.path.join(' → ');
    });

    // Remove duplicates and return
    return [...new Set(formattedPaths)];
  }

  // Get detailed information about all instances of a package
  getPackageInstances(packageName: string): Array<{path: string, version: string}> {
    const paths = this.findPathsToPackage(packageName);

    return paths.map(path => ({
      path: path.path.length === 1 ? '(your project)' : path.path.join(' → '),
      version: path.version
    }));
  }

  // Build a hierarchical dependency tree structure
  buildDependencyTreeStructure(maxDepth: number = 5): DependencyTreeNode[] {
    const tree: DependencyTreeNode[] = [];
    const visited = new Set<string>();

    for (const rootDep of this.rootDependencies) {
      const node = this.buildTreeNode(rootDep, 0, maxDepth, visited, []);
      if (node) {
        tree.push(node);
      }
    }

    return tree;
  }

  private buildTreeNode(packageName: string, depth: number, maxDepth: number, visited: Set<string>, parentPath: string[] = []): DependencyTreeNode | null {
    if (depth > maxDepth) return null;

    const version = this.packageVersions.get(packageName) || 'unknown';
    const nodeKey = `${packageName}@${version}`;

    // Avoid processing the same package version multiple times
    if (visited.has(nodeKey)) {
      return null;
    }

    visited.add(nodeKey);

    const node: DependencyTreeNode = {
      name: packageName,
      version,
      children: [],
      isRoot: depth === 0,
      depth,
      path: parentPath
    };

    if (depth < maxDepth) {
      const dependencies = this.packageDependencies.get(packageName) || [];
      for (const dep of dependencies) {
        const childNode = this.buildTreeNode(dep, depth + 1, maxDepth, visited, [...parentPath, packageName]);
        if (childNode) {
          if (!node.children) node.children = [];
          node.children.push(childNode);
        }
      }
    }

    return node;
  }
}