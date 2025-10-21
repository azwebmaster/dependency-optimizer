import { Command } from 'commander';
import { AbstractCommand } from './base.js';
import { DuplicateDetector } from '../duplicateDetector.js';
import { buildDependencyTreeFromLockData } from '../index.js';
import { LockFileParser } from '../lockFileParser.js';
import { matchesPackageVersionSpec, type PackageVersionSpec } from '../utils/packageVersionParser.js';
import type { CommandOptions, CommandResult } from './types.js';
import type { DuplicateDetectorOptions } from '../duplicateDetector.js';
import createDebug from 'debug';

const debug = createDebug('depoptimize:command:duplicates');

export class DuplicatesCommand extends AbstractCommand {
  name = 'duplicates';
  description = 'Find duplicate packages and version conflicts';
  hasPackageArgument = true;

  protected addSpecificOptions(command: Command): void {
    command
      .option('--ignore-versions', 'Group all versions of the same package as duplicates')
      .option('--no-paths', 'Hide package paths in output')
      .option('--no-lock-file', 'Disable lock file parsing for dependency hierarchy')
      .option('--tree', 'Show dependency tree for each duplicate package')
      .option('--node-modules-paths', 'Show physical node_modules paths for each duplicate package')
      .option('--links', 'Show npmjs links for packages and versions');
  }

  protected applyDefaults(rawOptions: CommandOptions, config: any): CommandOptions {
    return {
      ...rawOptions,
      // Apply command-specific defaults
      checkVersions: rawOptions.ignoreVersions !== undefined ? !rawOptions.ignoreVersions : (config.checkVersions ?? true),
      showPaths: rawOptions.paths !== false ? (config.showPaths ?? true) : false,
      useLockFile: rawOptions.lockFile !== false ? (config.useLockFile ?? true) : false,
      showTree: rawOptions.tree ?? config.showTree ?? false,
      showFullDetails: rawOptions.full ?? config.showFullDetails ?? false,
      showLinks: rawOptions.links ?? config.showLinks ?? false,
      showNodeModulesPaths: rawOptions.nodeModulesPaths ?? config.showNodeModulesPaths ?? false,
      includeDevDependencies: rawOptions.prod !== undefined ? !rawOptions.prod : (config.includeDevDependencies ?? true),
      verbose: rawOptions.verbose ?? config.verbose ?? false
    };
  }

  async execute(options: CommandOptions, packageVersionSpec?: PackageVersionSpec): Promise<CommandResult> {
    try {
      debug('Starting duplicates command with options: %O', options);
      debug('Project path: %s', options.path);

      // Parse lock file and build dependency tree
      const lockFileParser = new LockFileParser();
      const lockFileData = await lockFileParser.parseLockFile(options.path!);
      
      if (!lockFileData) {
        return {
          success: false,
          errors: ['No lock file found. Duplicates analysis requires a lock file.']
        };
      }

      const dependencyTree = await buildDependencyTreeFromLockData(
        lockFileData, 
        options.path!, 
        options.includeDevDependencies
      );

      const detectorOptions: DuplicateDetectorOptions = {
        checkVersions: options.checkVersions,
        showPaths: options.showPaths,
        useLockFile: options.useLockFile,
        showTree: options.showTree,
        showFullDetails: options.showTree || options.showFullDetails, // Enable full details when --tree is used
        showLinks: options.showLinks,
        showNodeModulesPaths: options.showNodeModulesPaths,
        onlyVersionConflicts: !packageVersionSpec,
        includeDevDependencies: options.includeDevDependencies
      };

      const detector = new DuplicateDetector(detectorOptions);
      const result = await detector.detectDuplicates(dependencyTree, options.path!);

      // Filter results if a specific package is requested
      let filteredResult = result;
      if (packageVersionSpec) {
        const filteredDuplicates = result.duplicates.filter(dup => {
          // If version is specified, match both name and version
          if (packageVersionSpec.version) {
            return dup.instances.some(instance => 
              matchesPackageVersionSpec(instance, packageVersionSpec)
            );
          }
          // If only name is specified, match by name
          return dup.name === packageVersionSpec.name || dup.name.includes(packageVersionSpec.name);
        });

        if (filteredDuplicates.length === 0) {
          const packageDisplay = packageVersionSpec.version 
            ? `${packageVersionSpec.name}@${packageVersionSpec.version}`
            : packageVersionSpec.name;
          return {
            success: true,
            data: { 
              result: { 
                ...result, 
                duplicates: [], 
                duplicatePackages: 0, 
                totalDuplicateInstances: 0 
              }, 
              dependencyTree 
            },
            summary: `✅ No duplicates found for package '${packageDisplay}'`
          };
        }

        filteredResult = {
          ...result,
          duplicates: filteredDuplicates,
          duplicatePackages: filteredDuplicates.length,
          totalDuplicateInstances: filteredDuplicates.reduce((sum, group) => sum + group.instances.length, 0)
        };
      }

      const summary = this.generateSummary(filteredResult);

      return {
        success: true,
        data: { result: filteredResult, dependencyTree },
        summary
      };

    } catch (error: any) {
      debug('Duplicates command failed with error: %O', error);
      return {
        success: false,
        errors: [error.message]
      };
    }
  }

  protected displayData(data: any, options: CommandOptions): void {
    if (data && data.result && data.result.duplicates.length > 0) {
      if (options.showTree) {
        // Use DuplicateDetector's formatOutput method for detailed tree display
        const detectorOptions: DuplicateDetectorOptions = {
          checkVersions: options.checkVersions,
          showPaths: options.showPaths,
          useLockFile: options.useLockFile,
          showTree: options.showTree,
          showFullDetails: options.showTree || options.showFullDetails,
          showLinks: options.showLinks,
          showNodeModulesPaths: options.showNodeModulesPaths,
          onlyVersionConflicts: false,
          includeDevDependencies: options.includeDevDependencies
        };
        
        const detector = new DuplicateDetector(detectorOptions);
        const formattedOutput = detector.formatOutput(data.result, data.dependencyTree);
        console.log(formattedOutput);
      } else {
        // Summary view showing unique versions and parent packages
        console.log('   🔄 Duplicate packages found:');
        data.result.duplicates.forEach((dup: any) => {
          const packageLink = options.showLinks ? ` 🔗 https://www.npmjs.com/package/${dup.name}` : '';
          console.log(`     📦 ${dup.name} (${dup.instances.length} instances)${packageLink}`);
          
          // Group instances by version
          const versionGroups = new Map<string, any[]>();
          dup.instances.forEach((instance: any) => {
            const version = instance.version;
            if (!versionGroups.has(version)) {
              versionGroups.set(version, []);
            }
            versionGroups.get(version)!.push(instance);
          });
          
          // Display each version with parent packages
          versionGroups.forEach((instances, version) => {
            const versionLink = options.showLinks ? ` 🔗 https://www.npmjs.com/package/${dup.name}/v/${version}` : '';
            console.log(`       📌 Version ${version} (${instances.length} instances)${versionLink}:`);
            
            // Get unique dependency chains for this version
            const dependencyChains = new Set<string>();
            let hasRootDependency = false;
            
            instances.forEach((instance: any) => {
              if (instance.path && instance.path.length > 0) {
                // Build the complete dependency chain with versions
                const chainWithVersions = this.buildDependencyChainWithVersions(instance.path, data.dependencyTree);
                dependencyChains.add(chainWithVersions);
              } else {
                // This is a root dependency
                hasRootDependency = true;
              }
            });
            
            // Display dependency chains
            const parentList: string[] = [];
            
            if (hasRootDependency) {
              parentList.push('root dependency');
            }
            
            if (dependencyChains.size > 0) {
              const chainEntries = Array.from(dependencyChains)
                .map(chain => {
                  // Add npm links to each package in the chain if showLinks is enabled
                  if (options.showLinks) {
                    return this.addLinksToChain(chain);
                  }
                  return chain;
                })
                .sort();
              parentList.push(...chainEntries);
            }
            
            if (parentList.length > 0) {
              console.log(`         📋 Parent packages: ${parentList.join(', ')}`);
            }
          });
        });
      }
    }
  }

  protected formatDataMarkdown(data: any, options: CommandOptions): string {
    const lines: string[] = [];
    
    if (data && data.result && data.result.duplicates.length > 0) {
      if (options.showTree) {
        // Use DuplicateDetector's formatOutput method for detailed tree display
        const detectorOptions: DuplicateDetectorOptions = {
          checkVersions: options.checkVersions,
          showPaths: options.showPaths,
          useLockFile: options.useLockFile,
          showTree: options.showTree,
          showFullDetails: options.showTree || options.showFullDetails,
          showLinks: options.showLinks,
          showNodeModulesPaths: options.showNodeModulesPaths,
          onlyVersionConflicts: false,
          includeDevDependencies: options.includeDevDependencies
        };
        
        const detector = new DuplicateDetector(detectorOptions);
        const formattedOutput = detector.formatOutput(data.result, data.dependencyTree);
        lines.push('```');
        lines.push(formattedOutput);
        lines.push('```');
      } else {
        // Summary markdown format showing unique versions and parent packages
        lines.push('**Duplicate packages found:**');
        lines.push('');
        data.result.duplicates.forEach((dup: any) => {
          const packageLink = options.showLinks ? ` 🔗 [npm](https://www.npmjs.com/package/${dup.name})` : '';
          lines.push(`- **${dup.name}** (${dup.instances.length} instances)${packageLink}`);
          
          // Group instances by version
          const versionGroups = new Map<string, any[]>();
          dup.instances.forEach((instance: any) => {
            const version = instance.version;
            if (!versionGroups.has(version)) {
              versionGroups.set(version, []);
            }
            versionGroups.get(version)!.push(instance);
          });
          
          // Display each version with parent packages
          versionGroups.forEach((instances, version) => {
            const versionLink = options.showLinks ? ` 🔗 [npm](https://www.npmjs.com/package/${dup.name}/v/${version})` : '';
            lines.push(`  - **Version ${version}** (${instances.length} instances)${versionLink}:`);
            
            // Get unique dependency chains for this version
            const dependencyChains = new Set<string>();
            let hasRootDependency = false;
            
            instances.forEach((instance: any) => {
              if (instance.path && instance.path.length > 0) {
                // Build the complete dependency chain with versions
                const chainWithVersions = this.buildDependencyChainWithVersions(instance.path, data.dependencyTree);
                dependencyChains.add(chainWithVersions);
              } else {
                // This is a root dependency
                hasRootDependency = true;
              }
            });
            
            // Display dependency chains
            const parentList: string[] = [];
            
            if (hasRootDependency) {
              parentList.push('root dependency');
            }
            
            if (dependencyChains.size > 0) {
              const chainEntries = Array.from(dependencyChains)
                .map(chain => {
                  // Add npm links to each package in the chain if showLinks is enabled
                  if (options.showLinks) {
                    return this.addLinksToChainMarkdown(chain);
                  }
                  return chain;
                })
                .sort();
              parentList.push(...chainEntries);
            }
            
            if (parentList.length > 0) {
              lines.push(`    - Parent packages: ${parentList.join(', ')}`);
            }
          });
        });
        lines.push('');
      }
    }
    
    return lines.join('\n');
  }

  private generateSummary(result: any): string {
    if (result.duplicates.length === 0) {
      return 'No duplicate packages found';
    }

    return `🔄 Found ${result.duplicatePackages} duplicate packages (${result.totalDuplicateInstances} total instances)`;
  }

  private getParentVersion(parentName: string, dependencyTree: any): string {
    if (!dependencyTree || !dependencyTree.allNodes) {
      return 'unknown';
    }

    // Search through all nodes to find the parent package
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

      if (packageName === parentName && nodes && nodes.length > 0) {
        // Return the version from the composite key or the first node
        if (compositeKey.includes('@')) {
          const lastAtIndex = compositeKey.lastIndexOf('@');
          return compositeKey.substring(lastAtIndex + 1);
        }
        return nodes[0].version || 'unknown';
      }
    }

    return 'unknown';
  }

  private getParentVersionInContext(parentName: string, contextPath: string[], dependencyTree: any): string {
    if (!dependencyTree || !dependencyTree.allNodes) {
      return 'unknown';
    }

    // Search through all nodes to find the parent package in the specific context
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

      if (packageName === parentName && nodes && nodes.length > 0) {
        // Find the node that matches our context path
        for (const node of nodes) {
          // Check if this node's path matches our context
          if (this.pathsMatch(node.path, contextPath)) {
            // Return the version from the composite key
            if (compositeKey.includes('@')) {
              const lastAtIndex = compositeKey.lastIndexOf('@');
              return compositeKey.substring(lastAtIndex + 1);
            }
            return node.version || 'unknown';
          }
        }
        
        // If no specific context match, return the first version found
        if (compositeKey.includes('@')) {
          const lastAtIndex = compositeKey.lastIndexOf('@');
          return compositeKey.substring(lastAtIndex + 1);
        }
        return nodes[0].version || 'unknown';
      }
    }

    return 'unknown';
  }

  private pathsMatch(nodePath: string[], contextPath: string[]): boolean {
    if (nodePath.length !== contextPath.length) {
      return false;
    }
    
    for (let i = 0; i < nodePath.length; i++) {
      if (nodePath[i] !== contextPath[i]) {
        return false;
      }
    }
    
    return true;
  }

  private findPackageVersionInTree(packageName: string, contextPath: string[], dependencyTree: any): string {
    if (!dependencyTree || !dependencyTree.allNodes) {
      return 'unknown';
    }

    // Search through all nodes to find the package in the specific context
    for (const [compositeKey, nodes] of dependencyTree.allNodes.entries()) {
      // Extract package name from composite key
      let nodePackageName: string;
      if (compositeKey.startsWith('@')) {
        const lastAtIndex = compositeKey.lastIndexOf('@');
        nodePackageName = compositeKey.substring(0, lastAtIndex);
      } else {
        nodePackageName = compositeKey.split('@')[0];
      }

      if (nodePackageName === packageName && nodes && nodes.length > 0) {
        // Find the node that matches our context path
        for (const node of nodes) {
          if (this.pathsMatch(node.path, contextPath)) {
            // Return the version from the composite key
            if (compositeKey.includes('@')) {
              const lastAtIndex = compositeKey.lastIndexOf('@');
              return compositeKey.substring(lastAtIndex + 1);
            }
            return node.version || 'unknown';
          }
        }
      }
    }

    return 'unknown';
  }

  private buildDependencyChainWithVersions(path: string[], dependencyTree: any): string {
    if (!dependencyTree || !dependencyTree.allNodes || path.length === 0) {
      return path.join(' → ');
    }

    const chainWithVersions: string[] = [];
    
    // Build the chain by looking up each package in the dependency tree
    for (let i = 0; i < path.length; i++) {
      const packageName = path[i];
      const version = this.findPackageVersionInTree(packageName, path.slice(0, i), dependencyTree);
      chainWithVersions.push(`${packageName}@${version}`);
    }
    
    return chainWithVersions.join(' → ');
  }

  private addLinksToChain(chain: string): string {
    // Add npm links to each package in the chain
    return chain.replace(/([^@\s]+)@([^@\s→]+)/g, (match, name, version) => {
      return `${name}@${version} 🔗 https://www.npmjs.com/package/${name}/v/${version}`;
    });
  }

  private addLinksToChainMarkdown(chain: string): string {
    // Add npm links to each package in the chain (markdown format)
    return chain.replace(/([^@\s]+)@([^@\s→]+)/g, (match, name, version) => {
      return `${name}@${version} 🔗 [npm](https://www.npmjs.com/package/${name}/v/${version})`;
    });
  }
}
