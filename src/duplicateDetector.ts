import * as fs from 'fs';
import * as path from 'path';
import createDebug from 'debug';
import { LockFileParser } from './lockFileParser.js';
import { DependencyTreeBuilder } from './dependencyTreeBuilder.js';
import type { LockFileData } from './lockFileParser.js';
import type { DependencyTreeNode, DependencyTree, DuplicateInfo, DuplicateSummary } from './types.js';

const debug = createDebug('depoptimize:duplicate-detector');

export interface DuplicateDetectorOptions {
  checkVersions?: boolean;
  showPaths?: boolean;
  useLockFile?: boolean;
  showTree?: boolean;
  showFullDetails?: boolean;
  showLinks?: boolean;
  showNodeModulesPaths?: boolean;
  onlyVersionConflicts?: boolean;
  includeDevDependencies?: boolean;
}

export class DuplicateDetector {
  private options: DuplicateDetectorOptions;
  private packageMap: Map<string, DependencyTreeNode[]>;
  private visitedPaths: Set<string>;
  private rootDependencies: Set<string>;
  private lockFileParser: LockFileParser;
  private lockFileData: LockFileData | null = null;
  private reverseDependencyMap: Map<string, string[]> = new Map();
  private _dependencyTree: DependencyTree | null = null;

  // Add a setter to track when dependencyTree is cleared
  private set dependencyTree(value: DependencyTree | null) {
    if (this._dependencyTree && !value) {
      console.log('Dependency tree is being cleared!');
    }
    this._dependencyTree = value;
  }

  private get dependencyTree(): DependencyTree | null {
    return this._dependencyTree;
  }

  constructor(options: DuplicateDetectorOptions = {}) {
    this.options = {
      checkVersions: true,
      showPaths: true,
      useLockFile: true,
      showTree: false,
      showFullDetails: false,
      showLinks: false,
      showNodeModulesPaths: false,
      ...options
    };
    this.packageMap = new Map();
    this.visitedPaths = new Set();
    this.rootDependencies = new Set();
    this.lockFileParser = new LockFileParser();
  }

  async detectDuplicates(dependencyTree: DependencyTree, projectPath?: string): Promise<DuplicateSummary> {
    debug('Starting duplicate detection from dependency tree');

    // Clear previous state
    this.packageMap.clear();
    this.visitedPaths.clear();
    this.rootDependencies.clear();
    this.reverseDependencyMap.clear();

    // Store the dependency tree for version lookup
    this.dependencyTree = dependencyTree;

    // Debug: Log the dependency tree structure
    debug('Dependency tree root: %s@%s', dependencyTree.root.name, dependencyTree.root.version);
    debug('Dependency tree root children count: %d', dependencyTree.root.children?.length || 0);
    debug('All nodes count: %d', dependencyTree.allNodes.size);
    
    // Debug: Log some package names in allNodes
    const packageNames = Array.from(dependencyTree.allNodes.keys()).slice(0, 10);
    debug('Sample packages in allNodes: %s', packageNames.join(', '));

    // Build package map from dependency tree
    this.buildPackageMapFromTree(dependencyTree);

    // Calculate sizes for all nodes if project path is provided
    if (projectPath) {
      await this.calculateSizesForAllNodes(projectPath);
    }

    // Analyze duplicates
    const duplicates = this.analyzeDuplicates();

    // Calculate statistics
    const totalPackages = this.packageMap.size; // Count unique package names

    const totalDuplicateInstances = duplicates
      .reduce((sum, group) => sum + group.instances.length, 0);

    const duplicatePackages = duplicates.length;

    debug('Analysis complete. Found %d duplicate packages', duplicatePackages);

    return {
      totalPackages,
      duplicatePackages,
      totalDuplicateInstances,
      duplicates
    };
  }

  private buildPackageMapFromTree(dependencyTree: DependencyTree): void {
    // Use the allNodes map from the dependency tree, but deduplicate identical paths
    for (const [compositeKey, nodes] of dependencyTree.allNodes.entries()) {
      // Extract package name from composite key (format: "name@version" or "@scope/package@version")
      let packageName: string;
      if (compositeKey.startsWith('@')) {
        // Scoped package: "@scope/package@version" -> "@scope/package"
        const lastAtIndex = compositeKey.lastIndexOf('@');
        packageName = compositeKey.substring(0, lastAtIndex);
      } else {
        // Regular package: "name@version" -> "name"
        packageName = compositeKey.split('@')[0];
      }
      
      // Skip empty package names (should not happen with proper composite keys)
      if (!packageName || packageName === '') {
        continue;
      }
      
      // Deduplicate nodes with identical paths and versions
      const uniqueNodes = this.deduplicateNodes(nodes);
      
      // Group by package name only for duplicate detection
      if (!this.packageMap.has(packageName)) {
        this.packageMap.set(packageName, []);
      }
      this.packageMap.get(packageName)!.push(...uniqueNodes);
    }

    // Identify root dependencies
    if (dependencyTree.root.children) {
      for (const node of dependencyTree.root.children) {
        this.rootDependencies.add(node.name);
      }
    }
  }

  private deduplicateNodes(nodes: DependencyTreeNode[]): DependencyTreeNode[] {
    const seen = new Set<string>();
    const uniqueNodes: DependencyTreeNode[] = [];

    for (const node of nodes) {
      // Create a unique key based on path and version
      const pathKey = node.path.join('→');
      const uniqueKey = `${node.name}@${node.version}:${pathKey}`;
      
      if (!seen.has(uniqueKey)) {
        seen.add(uniqueKey);
        uniqueNodes.push(node);
      }
    }
    return uniqueNodes;
  }

  private async loadRootDependencies(projectPath: string): Promise<void> {
    const packageJsonPath = path.join(projectPath, 'package.json');

    if (fs.existsSync(packageJsonPath)) {
      try {
        const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));

        // Add all dependencies from package.json
        const allDeps = {
          ...packageJson.dependencies,
          ...packageJson.devDependencies,
          ...packageJson.peerDependencies,
          ...packageJson.optionalDependencies
        };

        for (const depName of Object.keys(allDeps)) {
          this.rootDependencies.add(depName);
        }

        debug('Loaded %d root dependencies from package.json', this.rootDependencies.size);
      } catch (error) {
        debug('Error reading project package.json: %O', error);
      }
    }
  }

    // Legacy methods for backward compatibility - these now work with dependency trees
  async detectDuplicatesFromPath(projectPath: string): Promise<DuplicateSummary> {
    // This method is kept for backward compatibility
    // In a real implementation, you'd parse the lock file and build a dependency tree
    throw new Error('Use detectDuplicates with a DependencyTree instead. This method is deprecated.');
  }
  private determinePhysicalPath(nodeModulesPath: string, packageName: string, parentPath: string[], lockPath: string): string {
    // If the lock path has no slash, it's a root-level dependency
    if (!lockPath.includes('/')) {
      return path.join(nodeModulesPath, packageName);
    }

    // Parse the lock path to understand the nesting
    // Example: "glob/minimatch" means minimatch is nested under glob
    // Example: "@manypkg/find-root/fs-extra" means fs-extra is nested under @manypkg/find-root
    const lockPathParts = lockPath.split('/');

    // Build the physical path by following the lock file structure
    let currentPath = nodeModulesPath;

    // Walk through each part of the lock path except the last (which is the target package)
    for (let i = 0; i < lockPathParts.length - 1; i++) {
      const part = lockPathParts[i];

      // Handle scoped packages - check if this part starts with @ and we have a next part
      if (part.startsWith('@') && i + 1 < lockPathParts.length) {
        // Check if the next part is the second part of a scoped package name (doesn't start with @)
        const nextPart = lockPathParts[i + 1];
        if (!nextPart.startsWith('@')) {
          const scopedName = `${part}/${nextPart}`;
          currentPath = path.join(currentPath, scopedName, 'node_modules');
          i++; // Skip the next part since we consumed it
        } else {
          // This @ part is a standalone package (shouldn't happen but handle it)
          currentPath = path.join(currentPath, part, 'node_modules');
        }
      } else {
        currentPath = path.join(currentPath, part, 'node_modules');
      }
    }

    // Add the final package
    return path.join(currentPath, packageName);
  }

  // Helper method to determine possible physical paths for a package
  private getPossiblePhysicalPaths(nodeModulesPath: string, packageName: string, parentPath: string[]): string[] {
    const paths: string[] = [];

    // First, check if it's at the root level
    paths.push(path.join(nodeModulesPath, packageName));

    // If it's a scoped package
    if (packageName.startsWith('@')) {
      const [scope, name] = packageName.split('/');
      paths.push(path.join(nodeModulesPath, scope, name));
    }

    // Then check nested paths based on parent dependencies
    if (parentPath.length > 0) {
      // Build nested path from parent dependencies
      let currentPath = nodeModulesPath;
      for (const parent of parentPath) {
        // Remove version from parent if present
        const parentName = parent.replace(/@[^@]+$/, '');
        currentPath = path.join(currentPath, parentName, 'node_modules');
        paths.push(path.join(currentPath, packageName));

        if (packageName.startsWith('@')) {
          const [scope, name] = packageName.split('/');
          paths.push(path.join(currentPath, scope, name));
        }
      }
    }


    return paths;
  }

  // Build complete parent chain back to root dependencies
  private buildCompleteParentChain(parentPath: string[]): string[] {
    if (parentPath.length === 0) {
      return [];
    }

    // Find the root dependency that leads to this chain
    const firstParent = parentPath[0];

    // Check if the first parent is already a root dependency
    if (this.rootDependencies.has(firstParent)) {
      return parentPath;
    }

    // If not, try to find which root dependency leads to this first parent
    const rootDep = this.findRootDependencyFor(firstParent);
    if (rootDep && rootDep !== firstParent) {
      return [rootDep, ...parentPath];
    }

    return parentPath;
  }

  // Find which root dependency leads to a given package
  private findRootDependencyFor(packageName: string): string | null {
    if (!this.lockFileData) return null;

    // Look through lock file to find dependency paths
    for (const [, depInfo] of Object.entries(this.lockFileData.dependencies)) {
      if (depInfo.name === packageName && depInfo.parentPath.length > 0) {
        // Find the root of this parent path
        const rootCandidate = depInfo.parentPath[0];
        if (this.rootDependencies.has(rootCandidate)) {
          return rootCandidate;
        }
        // Recursively look for the root
        return this.findRootDependencyFor(rootCandidate);
      }
    }

    return null;
  }

  // Build a visual dependency tree with versions for each package
  private buildDependencyTreeWithVersions(parentChain: string[], targetPackage: string, targetVersion: string, dependencyTree?: DependencyTree): string {
    const lines: string[] = [];
    const fullChain = [...parentChain, targetPackage];

    // If the chain is too long and --full is not specified, implement smart truncation with ... in the middle
    if (fullChain.length > 8 && !this.options.showFullDetails) {
      // Show first 3 packages, then ..., then last 3 packages
      const firstPart = fullChain.slice(0, 3);
      const lastPart = fullChain.slice(-3);
      
      // Add first part
      for (let i = 0; i < firstPart.length; i++) {
        const packageName = firstPart[i];
        const indent = '       ' + '  '.repeat(i);
        const connector = '└─ ';
        
        let version: string;
        if (i === firstPart.length - 1 && firstPart.length === fullChain.length) {
          version = targetVersion;
        } else {
          // Pass the context path up to this point
          const contextPath = firstPart.slice(0, i);
          version = this.getPackageVersionFromTree(packageName, dependencyTree, contextPath) || 'unknown';
        }
        const versionStr = `@${version}`;
        const rootIndicator = this.rootDependencies.has(packageName) ? ' (root)' : '';
        
        // Get size information for this package
        const sizeInfo = this.getPackageSizeInfo(packageName, version, dependencyTree);
        const sizeStr = sizeInfo ? ` (${this.formatSize(sizeInfo)})` : '';
        
        // Add npm link if showLinks is enabled
        const npmLink = this.options.showLinks ? ` 🔗 https://www.npmjs.com/package/${packageName}/v/${version}` : '';
        
        lines.push(`${indent}${connector}${packageName}${versionStr}${sizeStr}${rootIndicator}${npmLink}`);
      }
      
      // Add truncation indicator
      const truncateIndent = '       ' + '  '.repeat(3);
      lines.push(`${truncateIndent}└─ ... (${fullChain.length - 6} packages)`);
      
      // Add last part
      for (let i = 0; i < lastPart.length; i++) {
        const packageName = lastPart[i];
        const originalIndex = fullChain.length - 3 + i;
        const indent = '       ' + '  '.repeat(originalIndex);
        const connector = '└─ ';
        
        let version: string;
        if (originalIndex === fullChain.length - 1) {
          version = targetVersion;
        } else {
          // Pass the context path up to this point
          const contextPath = fullChain.slice(0, originalIndex);
          version = this.getPackageVersionFromTree(packageName, dependencyTree, contextPath) || 'unknown';
        }
        const versionStr = `@${version}`;
        const rootIndicator = this.rootDependencies.has(packageName) ? ' (root)' : '';
        
        // Get size information for this package
        const sizeInfo = this.getPackageSizeInfo(packageName, version, dependencyTree);
        const sizeStr = sizeInfo ? ` (${this.formatSize(sizeInfo)})` : '';
        
        // Add npm link if showLinks is enabled
        const npmLink = this.options.showLinks ? ` 🔗 https://www.npmjs.com/package/${packageName}/v/${version}` : '';
        
        lines.push(`${indent}${connector}${packageName}${versionStr}${sizeStr}${rootIndicator}${npmLink}`);
      }
    } else {
      // Normal processing for shorter chains or when --full is specified (show all packages)
      for (let i = 0; i < fullChain.length; i++) {
        const packageName = fullChain[i];
        const indent = '       ' + '  '.repeat(i);

        // In a dependency chain, each item is typically the only child of its parent
        // So we use └─ for all items except when we need to check if there are actually siblings
        const connector = '└─ ';

        // Get version for this package
        let version: string;
        if (i === fullChain.length - 1) {
          // For the target package, use the specific version from the instance
          version = targetVersion;
        } else {
          // For parent packages, try to get version from our data
          // Pass the context path up to this point
          const contextPath = fullChain.slice(0, i);
          version = this.getPackageVersionFromTree(packageName, dependencyTree, contextPath) || 'unknown';
        }
        const versionStr = `@${version}`;

        // Determine if this is a root dependency
        const rootIndicator = this.rootDependencies.has(packageName) ? ' (root)' : '';

        // Get size information for this package
        const sizeInfo = this.getPackageSizeInfo(packageName, version, dependencyTree);
        const sizeStr = sizeInfo ? ` (${this.formatSize(sizeInfo)})` : '';

        // Add npm link if showLinks is enabled
        const npmLink = this.options.showLinks ? ` 🔗 https://www.npmjs.com/package/${packageName}/v/${version}` : '';

        lines.push(`${indent}${connector}${packageName}${versionStr}${sizeStr}${rootIndicator}${npmLink}`);
      }
    }

    return lines.join('\n');
  }

  // Get size information for a package
  private getPackageSizeInfo(packageName: string, version: string, dependencyTree?: DependencyTree): number | null {
    // First try to get from package map
    const instances = this.packageMap.get(packageName);
    if (instances && instances.length > 0) {
      // Find the instance with matching version
      const matchingInstance = instances.find(instance => instance.version === version);
      if (matchingInstance && matchingInstance.size !== undefined) {
        return matchingInstance.size;
      }
      // If no matching version, return the first instance's size
      if (instances[0].size !== undefined) {
        return instances[0].size;
      }
    }

    // Try to find in the dependency tree
    if (dependencyTree) {
      const allNodes = dependencyTree.allNodes;
      const packageInstances = allNodes.get(packageName);
      if (packageInstances && packageInstances.length > 0) {
        // Find the instance with matching version
        const matchingInstance = packageInstances.find(instance => instance.version === version);
        if (matchingInstance && matchingInstance.size !== undefined) {
          return matchingInstance.size;
        }
        // If no matching version, return the first instance's size
        if (packageInstances[0].size !== undefined) {
          return packageInstances[0].size;
        }
      }
    }

    return null;
  }

  // Get version of a package from our package map or lock file data
  private getPackageVersion(packageName: string): string | null {
    
    // First try to get from package map
    const instances = this.packageMap.get(packageName);
    console.log(`Package map check for ${packageName}:`, instances ? `${instances.length} instances` : 'not found');
    if (instances && instances.length > 0) {
      console.log(`Returning version from package map: ${instances[0].version}`);
      return instances[0].version;
    }

    // Try to find in the dependency tree by searching through all nodes
    console.log(`Checking dependencyTree for ${packageName}:`, this.dependencyTree ? 'exists' : 'null');
    if (this.dependencyTree) {
      const allNodes = this.dependencyTree.allNodes;
      console.log(`Searching for ${packageName} in ${allNodes.size} package groups`);
      
      // Check if the package exists in allNodes
      if (allNodes.has(packageName)) {
        const nodeList = allNodes.get(packageName)!;
        console.log(`Found package group for ${packageName} with ${nodeList.length} instances`);
        for (const node of nodeList) {
          if (node.name === packageName) {
            console.log(`Found version for ${packageName}: ${node.version}`);
            return node.version;
          }
        }
      } else {
        console.log(`Package ${packageName} not found in allNodes map`);
      }
      
      // If not found in allNodes, try to find by traversing the tree
      const foundVersion = this.findVersionInTree(this.dependencyTree.root, packageName);
      if (foundVersion) {
        debug('Found version for %s by tree traversal: %s', packageName, foundVersion);
        return foundVersion;
      }
      
      debug('Package %s not found in dependency tree', packageName);
    }

    // Fallback to lock file data
    if (this.lockFileData) {
      for (const [, depInfo] of Object.entries(this.lockFileData.dependencies)) {
        if (depInfo.name === packageName) {
          debug('Found version for %s in lock file: %s', packageName, depInfo.version);
          return depInfo.version;
        }
      }
    }

    debug('Could not find version for %s', packageName);
    return null;
  }

  // Get version of a package from a specific dependency tree
  private getPackageVersionFromTree(packageName: string, dependencyTree?: DependencyTree, contextPath?: string[]): string | null {
    if (!dependencyTree) {
      return null;
    }

    // Try to find in the dependency tree by searching through all nodes
    const allNodes = dependencyTree.allNodes;
    
    // Check if the package exists in allNodes (now using composite keys)
    for (const [compositeKey, nodeList] of allNodes.entries()) {
      if (compositeKey.startsWith(`${packageName}@`)) {
        for (const node of nodeList) {
          if (node.name === packageName) {
            // If we have a context path, try to match it
            if (contextPath && contextPath.length > 0) {
              // Check if this node's path matches the context
              const nodePathStr = node.path.join('/');
              const contextPathStr = contextPath.join('/');
              
              // More precise matching: check if the context path is a prefix of the node path
              // or if they match exactly
              if (nodePathStr === contextPathStr || nodePathStr.startsWith(contextPathStr + '/')) {
                return node.version;
              }
            } else {
              // No context, return the first version found
              return node.version;
            }
          }
        }
      }
    }
    
    // If not found in allNodes, try to find by traversing the tree
    const foundVersion = this.findVersionInTree(dependencyTree.root, packageName);
    if (foundVersion) {
      return foundVersion;
    }
    return null;
  }

  // Recursively search for a package version in the dependency tree
  private findVersionInTree(node: DependencyTreeNode, packageName: string): string | null {
    if (node.name === packageName) {
      return node.version;
    }
    
    if (node.children) {
      for (const child of node.children) {
        const found = this.findVersionInTree(child, packageName);
        if (found) {
          return found;
        }
      }
    }
    
    return null;
  }

  private async scanDirectory(dirPath: string, parentPackages: string[]): Promise<void> {
    // Avoid scanning the same physical path twice (handles symlinks)
    const realPath = fs.realpathSync(dirPath);
    if (this.visitedPaths.has(realPath)) {
      debug('Skipping already visited path: %s', dirPath);
      return;
    }
    this.visitedPaths.add(realPath);

    const items = fs.readdirSync(dirPath);

    for (const item of items) {
      // Skip hidden directories and files
      if (item.startsWith('.')) continue;

      const itemPath = path.join(dirPath, item);
      const stats = fs.statSync(itemPath);

      if (stats.isDirectory()) {
        // Check if this is a package directory
        const packageJsonPath = path.join(itemPath, 'package.json');

        if (fs.existsSync(packageJsonPath)) {
          try {
            const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
            const packageName = packageJson.name || item;
            const packageVersion = packageJson.version || 'unknown';

            // Calculate package size
            const size = await this.calculateDirectorySize(itemPath);

            // When no lock file is available, use filesystem-based detection
            const isActualRoot = this.rootDependencies.has(packageName) && parentPackages.length === 0;
            const effectiveParentPackages = isActualRoot ? [] : [...parentPackages];

            // Create package instance
            const instance: DependencyTreeNode = {
              name: packageName,
              version: packageVersion,
              resolved: itemPath,
              integrity: '',
              isDirect: false,
              isDevDependency: false,
              dependents: [],
              dependencies: [],
              depth: parentPackages.length,
              path: effectiveParentPackages,
              size: size
            };

            // Add to map
            if (!this.packageMap.has(packageName)) {
              this.packageMap.set(packageName, []);
            }
            this.packageMap.get(packageName)!.push(instance);

            debug('Found package: %s@%s at %s', packageName, packageVersion, itemPath);

            // Recursively scan node_modules within this package
            const nestedNodeModules = path.join(itemPath, 'node_modules');
            if (fs.existsSync(nestedNodeModules)) {
              await this.scanDirectory(nestedNodeModules, [...parentPackages, `${packageName}@${packageVersion}`]);
            }
          } catch (error) {
            debug('Error reading package.json at %s: %O', itemPath, error);
          }
        } else if (item === '@types' || item.startsWith('@')) {
          // Handle scoped packages
          await this.scanDirectory(itemPath, parentPackages);
        }
      }
    }
  }

  private analyzeDuplicates(): DuplicateInfo[] {
    const duplicates: DuplicateInfo[] = [];

    for (const [packageName, instances] of this.packageMap.entries()) {
      if (instances.length <= 1) continue;

      let duplicateInstances: DependencyTreeNode[] = [];

      if (this.options.checkVersions) {
        // Group by version and find duplicates
        const versionMap = new Map<string, DependencyTreeNode[]>();

        for (const instance of instances) {
          if (!versionMap.has(instance.version)) {
            versionMap.set(instance.version, []);
          }
          versionMap.get(instance.version)!.push(instance);
        }

        if (this.options.onlyVersionConflicts) {
          // Only show packages with multiple versions (version conflicts)
          if (versionMap.size > 1) {
            duplicateInstances = instances;
          }
        } else {
          // Find versions with multiple instances
          for (const [, versionInstances] of versionMap.entries()) {
            if (versionInstances.length > 1) {
              duplicateInstances.push(...versionInstances);
            }
          }

          // Also check if there are multiple versions (version conflicts)
          if (versionMap.size > 1) {
            // Add all instances as duplicates when there are version conflicts
            duplicateInstances = instances;
          }
        }
      } else {
        // Without version checking, all instances of the same package are duplicates
        duplicateInstances = instances;
      }

      if (duplicateInstances.length > 1) {
        // Get unique versions
        const versions = Array.from(new Set(duplicateInstances.map(i => i.version)));

        duplicates.push({
          name: packageName,
          instances: duplicateInstances,
          versions
        });
      }
    }

    // Sort by number of instances
    duplicates.sort((a, b) => b.instances.length - a.instances.length);

    return duplicates;
  }

  private async calculateDirectorySize(dirPath: string): Promise<number> {
    let totalSize = 0;

    try {
      const items = fs.readdirSync(dirPath);

      for (const item of items) {
        // Skip node_modules within packages to avoid double counting
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

  // Calculate size for a package given its name and potential paths
  async calculatePackageSize(packageName: string, nodeModulesPath: string, parentPath: string[] = []): Promise<number> {
    // Try different possible paths for the package
    const possiblePaths = this.getPossiblePhysicalPaths(nodeModulesPath, packageName, parentPath);
    
    for (const packagePath of possiblePaths) {
      if (fs.existsSync(packagePath)) {
        try {
          return await this.calculateDirectorySize(packagePath);
        } catch (error) {
          debug('Error calculating size for %s at %s: %O', packageName, packagePath, error);
        }
      }
    }
    
    debug('Package %s not found in any expected location', packageName);
    return 0;
  }

  // Calculate sizes for all nodes in the package map
  private async calculateSizesForAllNodes(projectPath: string): Promise<void> {
    const nodeModulesPath = path.join(projectPath, 'node_modules');
    
    if (!fs.existsSync(nodeModulesPath)) {
      debug('No node_modules found at %s', nodeModulesPath);
      return;
    }

    debug('Calculating sizes for %d package groups', this.packageMap.size);
    
    for (const [packageName, instances] of this.packageMap.entries()) {
      for (const instance of instances) {
        if (instance.size === undefined) {
          // Try to find the physical path for this package instance
          const physicalPath = this.findPhysicalPathForInstance(instance, nodeModulesPath);
          if (physicalPath && fs.existsSync(physicalPath)) {
            try {
              const size = await this.calculateDirectorySize(physicalPath);
              instance.size = size;
              debug('Calculated size for %s@%s at %s: %d bytes', packageName, instance.version, physicalPath, size);
            } catch (error) {
              debug('Error calculating size for %s@%s: %O', packageName, instance.version, error);
              instance.size = 0;
            }
          } else {
            debug('Physical path not found for %s@%s', packageName, instance.version);
            instance.size = 0;
          }
        }
      }
    }
  }

  // Find the physical file system path for a package instance
  private findPhysicalPathForInstance(instance: DependencyTreeNode, nodeModulesPath: string): string | null {
    // If the instance has a resolved path, use it
    if (instance.resolved && fs.existsSync(instance.resolved)) {
      return instance.resolved;
    }

    // First, try to construct the path based on the dependency chain
    const possiblePaths = this.getPossiblePhysicalPaths(nodeModulesPath, instance.name, instance.path);
    
    for (const possiblePath of possiblePaths) {
      if (fs.existsSync(possiblePath)) {
        // Verify that this path contains the correct version
        const packageJsonPath = path.join(possiblePath, 'package.json');
        if (fs.existsSync(packageJsonPath)) {
          try {
            const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
            if (packageJson.version === instance.version) {
              return possiblePath;
            }
          } catch (error) {
            debug('Error reading package.json at %s: %O', packageJsonPath, error);
          }
        }
      }
    }

    // If not found through dependency chain, do a more comprehensive search
    // This will search recursively through all node_modules directories
    return this.findPackageByVersion(nodeModulesPath, instance.name, instance.version);
  }

  // Comprehensive search for a package by name and version
  private findPackageByVersion(nodeModulesPath: string, packageName: string, version: string): string | null {
    try {
      debug('Starting comprehensive search for %s@%s in %s', packageName, version, nodeModulesPath);
      // Search recursively through node_modules
      const foundPath = this.searchNodeModulesRecursively(nodeModulesPath, packageName, version);
      if (foundPath) {
        debug('Found %s@%s at %s', packageName, version, foundPath);
        return foundPath;
      } else {
        debug('Package %s@%s not found in recursive search', packageName, version);
      }
    } catch (error) {
      debug('Error during recursive search for %s@%s: %O', packageName, version, error);
    }

    return null;
  }

  // Recursively search through node_modules directories
  private searchNodeModulesRecursively(dirPath: string, packageName: string, version: string, depth: number = 0): string | null {
    // Prevent infinite recursion
    if (depth > 10) {
      return null;
    }

    try {
      const items = fs.readdirSync(dirPath);
      debug('Searching in %s (depth %d), found %d items', dirPath, depth, items.length);
      
      for (const item of items) {
        // Skip hidden directories and files
        if (item.startsWith('.')) continue;

        const itemPath = path.join(dirPath, item);
        const stats = fs.statSync(itemPath);

        if (stats.isDirectory()) {
          debug('Checking directory: %s', itemPath);
          
          // Check if this is the package we're looking for
          if (item === packageName || (packageName.startsWith('@') && item === packageName.split('/')[0])) {
            const packageJsonPath = path.join(itemPath, 'package.json');
            if (fs.existsSync(packageJsonPath)) {
              try {
                const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
                debug('Found package %s@%s at %s, looking for %s@%s', packageJson.name, packageJson.version, itemPath, packageName, version);
                if (packageJson.name === packageName && packageJson.version === version) {
                  debug('MATCH! Found %s@%s at %s', packageName, version, itemPath);
                  return itemPath;
                }
              } catch (error) {
                debug('Error reading package.json at %s: %O', packageJsonPath, error);
              }
            }
          }

          // If this is a scoped package directory, check inside it
          if (packageName.startsWith('@') && item === packageName.split('/')[0]) {
            const scopedPackagePath = path.join(itemPath, packageName.split('/')[1]);
            if (fs.existsSync(scopedPackagePath)) {
              const packageJsonPath = path.join(scopedPackagePath, 'package.json');
              if (fs.existsSync(packageJsonPath)) {
                try {
                  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
                  debug('Found scoped package %s@%s at %s, looking for %s@%s', packageJson.name, packageJson.version, scopedPackagePath, packageName, version);
                  if (packageJson.name === packageName && packageJson.version === version) {
                    debug('MATCH! Found %s@%s at %s', packageName, version, scopedPackagePath);
                    return scopedPackagePath;
                  }
                } catch (error) {
                  debug('Error reading package.json at %s: %O', packageJsonPath, error);
                }
              }
            }
          }

          // Recursively search in node_modules subdirectories
          const nodeModulesPath = path.join(itemPath, 'node_modules');
          if (fs.existsSync(nodeModulesPath)) {
            debug('Found node_modules in %s, recursing...', itemPath);
            const found = this.searchNodeModulesRecursively(nodeModulesPath, packageName, version, depth + 1);
            if (found) {
              return found;
            }
          }

          // Also search inside the directory itself (for cases where packages are nested)
          const found = this.searchNodeModulesRecursively(itemPath, packageName, version, depth + 1);
          if (found) {
            return found;
          }
        }
      }
    } catch (error) {
      debug('Error reading directory %s: %O', dirPath, error);
    }

    return null;
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

  formatOutput(result: DuplicateSummary, dependencyTree?: DependencyTree): string {
    const lines: string[] = [];

    lines.push('🔍 Duplicate Package Analysis');
    lines.push('══════════════════════════════\n');

    if (result.duplicates.length === 0) {
      lines.push('✅ No duplicate packages found!\n');
      lines.push(`📦 Total packages scanned: ${result.totalPackages}`);
      return lines.join('\n');
    }

    lines.push(`📦 Total packages: ${result.totalPackages}`);
    lines.push(`🔄 Duplicate packages: ${result.duplicatePackages}`);
    lines.push(`� Total duplicate instances: ${result.totalDuplicateInstances}\n`);

    for (const group of result.duplicates) {
      const versionStr = group.versions.length > 1
        ? `(${group.versions.length} different versions)`
        : `(${group.versions[0]})`;

      lines.push(`📦 ${group.name} ${versionStr}`);
      lines.push(`   Instances: ${group.instances.length}`);

      if (this.options.showPaths) {
        for (const instance of group.instances) {
          let parentStr: string;
          if (instance.path.length > 0) {
            const fullPath = instance.path.join(' → ');
            if (fullPath.length > 100) {
              // Smart truncation: show more context to distinguish between paths
              const parts = instance.path;
              if (parts.length > 4) {
                // Show first 2 packages, ellipsis, then last 2 packages
                const truncatedPath = `${parts.slice(0, 2).join(' → ')} → ... → ${parts.slice(-2).join(' → ')}`;
                parentStr = ` → ${truncatedPath}`;
              } else if (parts.length > 3) {
                // Show first package, ellipsis, then last 2 packages
                const truncatedPath = `${parts[0]} → ... → ${parts.slice(-2).join(' → ')}`;
                parentStr = ` → ${truncatedPath}`;
              } else {
                // If not too many parts, just truncate the string
                parentStr = ` → ${fullPath.substring(0, 97)}...`;
              }
            } else {
              parentStr = ` → ${fullPath}`;
            }
          } else if (this.rootDependencies.has(instance.name) || (instance.path.length === 0 && instance.isDirect)) {
            parentStr = ' (root)';
          } else {
            // This should not happen if lock file parsing is correct
            // All packages should have proper dependency paths from the lock file
            parentStr = ' (unknown path)';
          }
          // Add size information right after version if available
          const sizeStr = (instance.size !== undefined && instance.size > 0) ? ` (${this.formatSize(instance.size)})` : '';
          
          let instanceLine = `   • ${instance.version}${sizeStr}${parentStr}`;

          // Add full details if requested
          if (this.options.showFullDetails) {
            instanceLine += `\n     📁 Path: ${instance.path.join('/')}`;
            if (instance.resolved) {
              instanceLine += `\n     � Resolved: ${instance.resolved}`;
            }
            if (instance.size !== undefined && instance.size > 0) {
              instanceLine += `\n     📏 Size: ${this.formatSize(instance.size)}`;
            }
            
            // Add npm link if showLinks is enabled
            if (this.options.showLinks) {
              instanceLine += `\n     🔗 npm: https://www.npmjs.com/package/${instance.name}/v/${instance.version}`;
            }
            
            // Add node_modules path if showNodeModulesPaths is enabled
            if (this.options.showNodeModulesPaths) {
              const nodeModulesPath = path.join(process.cwd(), 'node_modules');
              const physicalPath = this.findPhysicalPathForInstance(instance, nodeModulesPath);
              if (physicalPath) {
                instanceLine += `\n     📂 node_modules: ${physicalPath}`;
              }
            }

            // Add detailed dependency tree with versions
            if (instance.path.length > 0) {
              instanceLine += `\n\n     🌳 Dependency Tree:`;
              const treeOutput = this.buildDependencyTreeWithVersions(instance.path, instance.name, instance.version, dependencyTree || this.dependencyTree || undefined);
              instanceLine += `\n${treeOutput}`;
            }
          }

          lines.push(instanceLine);
        }
      }

      lines.push('');
    }

    return lines.join('\n');
  }

  formatJson(result: DuplicateSummary): string {
    return JSON.stringify(result, null, 2);
  }
}