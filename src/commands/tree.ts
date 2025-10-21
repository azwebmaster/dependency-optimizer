import { Command } from 'commander';
import { AbstractCommand } from './base.js';
import { DependencyTreeBuilder } from '../dependencyTreeBuilder.js';
import { buildDependencyTreeFromLockData } from '../index.js';
import { LockFileParser } from '../lockFileParser.js';
import { matchesPackageVersionSpec, type PackageVersionSpec } from '../utils/packageVersionParser.js';
import type { CommandOptions, CommandResult } from './types.js';
import type { DependencyTreeNode } from '../types.js';
import createDebug from 'debug';

const debug = createDebug('depoptimize:command:tree');

export class TreeCommand extends AbstractCommand {
  name = 'tree';
  description = 'Build and display dependency tree from lock files';
  hasPackageArgument = true;

  protected addSpecificOptions(command: Command): void {
    command
      .option('--full', 'Show detailed dependency tree with versions (requires package name)')
      .option('--links', 'Show npm registry links next to each dependency in the tree')
      .option('--summary', 'Show summary with top largest packages')
      .option('--depth <depth>', 'Maximum depth to traverse for tree command', '5');
  }

  protected applyDefaults(rawOptions: CommandOptions, config: any): CommandOptions {
    return {
      ...rawOptions,
      // Apply command-specific defaults
      maxDepth: rawOptions.depth ?? config.maxDepth ?? 5,
      full: rawOptions.full ?? config.showFullDetails ?? false,
      links: rawOptions.links ?? config.showLinks ?? false,
      summary: rawOptions.summary ?? config.summary ?? false,
      includeDevDependencies: rawOptions.prod !== undefined ? !rawOptions.prod : (config.includeDevDependencies ?? true),
      verbose: rawOptions.verbose ?? config.verbose ?? false
    };
  }

  async execute(options: CommandOptions, packageVersionSpec?: PackageVersionSpec): Promise<CommandResult> {
    try {
      debug('Starting tree command with options: %O', options);
      debug('Project path: %s', options.path);
      debug('Package spec: %O', packageVersionSpec);

      // Parse lock file and build dependency tree
      const lockFileParser = new LockFileParser();
      const lockFileData = await lockFileParser.parseLockFile(options.path!);
      
      if (!lockFileData) {
        return {
          success: false,
          errors: ['No lock file found. Tree analysis requires a lock file.']
        };
      }

      const dependencyTree = await buildDependencyTreeFromLockData(
        lockFileData, 
        options.path!, 
        options.includeDevDependencies
      );

      // Extract tree nodes from the dependency tree
      let treeNodes: DependencyTreeNode[] = [];
      
      if (lockFileData.type === 'bun' || lockFileData.type === 'pnpm') {
        // For bun and pnpm, the tree is already built
        treeNodes = [dependencyTree.root];
      } else {
        // For npm and yarn, use DependencyTreeBuilder
        const treeBuilder = new DependencyTreeBuilder(lockFileData, options.path!, options.includeDevDependencies);
        treeNodes = treeBuilder.buildDependencyTreeStructure(options.maxDepth);
      }

      let resultData: any = {
        lockFileType: lockFileData.type,
        totalPackages: Object.keys(lockFileData.dependencies).length
      };

      if (packageVersionSpec) {
        // Find specific package in tree
        const packageNode = this.findPackageInTree(treeNodes, packageVersionSpec);
        if (!packageNode) {
          const packageDisplay = packageVersionSpec.version 
            ? `${packageVersionSpec.name}@${packageVersionSpec.version}`
            : packageVersionSpec.name;
          return {
            success: false,
            errors: [`Package '${packageDisplay}' not found in dependency tree`]
          };
        }
        resultData.packageNode = packageNode;
      } else {
        // Include full tree when no package filter is applied
        resultData.treeNodes = treeNodes;
      }

      // Generate detailed summary if requested
      if (options.summary) {
        resultData.summary = this.generateDetailedSummary(resultData, packageVersionSpec);
      }

      const summary = this.generateSummary(resultData, packageVersionSpec);

      return {
        success: true,
        data: resultData,
        summary
      };

    } catch (error: any) {
      debug('Tree command failed with error: %O', error);
      return {
        success: false,
        errors: [error.message]
      };
    }
  }

  protected displayData(data: any, options: CommandOptions): void {
    if (data && data.summary) {
      // Display detailed summary if available
      console.log(data.summary);
    } else if (data && data.packageNode) {
      // Display filtered package tree
      const pkgName = data.packageNode.name || 'package';
      console.log(`   🌳 Dependency tree for '${pkgName}':`);
      this.displayTreeNode(data.packageNode, 0, options, true);
    } else if (data && data.treeNodes) {
      // Display full tree
      console.log('   🌳 Full dependency tree:');
      data.treeNodes.forEach((node: any, index: number) => {
        const isLastNode = index === data.treeNodes.length - 1;
        this.displayTreeNode(node, 0, options, isLastNode);
      });
    }
  }

  protected formatDataMarkdown(data: any, options: CommandOptions): string {
    const lines: string[] = [];
    
    if (data && data.summary) {
      lines.push('**Tree Summary:**');
      lines.push('');
      lines.push('```');
      lines.push(data.summary);
      lines.push('```');
      lines.push('');
    } else if (data && data.treeNodes) {
      lines.push('Dependency tree structure is available for analysis.');
      lines.push('');
    }
    
    return lines.join('\n');
  }

  private findPackageInTree(nodes: DependencyTreeNode[], packageVersionSpec: PackageVersionSpec): DependencyTreeNode | null {
    for (const node of nodes) {
      if (matchesPackageVersionSpec(node, packageVersionSpec)) return node;
      const found = this.findPackageInTree(node.children || [], packageVersionSpec);
      if (found) return found;
    }
    return null;
  }

  private displayTreeNode(node: any, depth: number, options: CommandOptions, isLast: boolean = false, parentPrefix: string = ''): void {
    const maxDepth = options.maxDepth;
    
    if (depth > maxDepth) {
      return;
    }
    
    let nodeDisplay = `${node.name}`;
    if (node.version) {
      nodeDisplay += `@${node.version}`;
    }
    
    if (options.links && node.name !== '@azwebmaster/dependency-optimizer') {
      nodeDisplay += ` (https://www.npmjs.com/package/${node.name})`;
    }
    
    // Build the tree prefix with hierarchy symbols
    let treePrefix = '     '; // Base indentation
    if (depth > 0) {
      treePrefix += parentPrefix;
      treePrefix += isLast ? '└── ' : '├── ';
    }
    
    console.log(`${treePrefix}📦 ${nodeDisplay}`);
    
    if (node.children && node.children.length > 0) {
      const childPrefix = parentPrefix + (isLast ? '    ' : '│   ');
      node.children.forEach((child: any, index: number) => {
        const isLastChild = index === node.children.length - 1;
        this.displayTreeNode(child, depth + 1, options, isLastChild, childPrefix);
      });
    }
  }

  private generateSummary(data: any, packageVersionSpec?: PackageVersionSpec): string {
    if (packageVersionSpec) {
      const packageDisplay = packageVersionSpec.version 
        ? `${packageVersionSpec.name}@${packageVersionSpec.version}`
        : packageVersionSpec.name;
      return `🌳 Dependency tree for '${packageDisplay}' (${data.lockFileType} lock file)`;
    }
    return `🌳 Full dependency tree (${data.totalPackages} packages, ${data.lockFileType} lock file)`;
  }

  private generateDetailedSummary(data: any, packageVersionSpec?: PackageVersionSpec): string {
    const lines: string[] = [];
    
    lines.push('\n📊 Tree Summary');
    lines.push('═══════════════\n');
    
    if (packageVersionSpec) {
      const packageNode = data.packageNode;
      const totalDeps = this.countTotalDependencies(packageNode);
      const maxDepth = this.getMaxDepth(packageNode);
      
      const packageDisplay = packageVersionSpec.version 
        ? `${packageVersionSpec.name}@${packageVersionSpec.version}`
        : packageVersionSpec.name;
      lines.push(`Package: ${packageDisplay}`);
      lines.push(`Total dependencies: ${totalDeps}`);
      lines.push(`Maximum depth: ${maxDepth} levels\n`);
      
      // Show top-level dependencies
      if (packageNode.children && packageNode.children.length > 0) {
        lines.push('🔗 Direct Dependencies:');
        packageNode.children.slice(0, 10).forEach((child: any, index: number) => {
          const childDeps = this.countTotalDependencies(child);
          lines.push(`  ${index + 1}. ${child.name}@${child.version} (${childDeps} sub-deps)`);
        });
        
        if (packageNode.children.length > 10) {
          lines.push(`  ... and ${packageNode.children.length - 10} more`);
        }
      }
    } else {
      lines.push(`Total packages: ${data.totalPackages}`);
      lines.push(`Lock file type: ${data.lockFileType}\n`);
      
      if (data.treeNodes && data.treeNodes.length > 0) {
        lines.push('🌳 Root Packages:');
        data.treeNodes.forEach((node: any, index: number) => {
          const totalDeps = this.countTotalDependencies(node);
          lines.push(`  ${index + 1}. ${node.name}@${node.version} (${totalDeps} dependencies)`);
        });
      }
    }
    
    return lines.join('\n');
  }

  private countTotalDependencies(node: any): number {
    const seen = new Set<string>();
    this.countUniqueDependencies(node, seen);
    return seen.size;
  }

  private countUniqueDependencies(node: any, seen: Set<string>): void {
    if (node.children) {
      for (const child of node.children) {
        const key = `${child.name}@${child.version}`;
        if (!seen.has(key)) {
          seen.add(key);
          this.countUniqueDependencies(child, seen);
        }
      }
    }
  }

  private getMaxDepth(node: any, currentDepth = 0): number {
    if (!node.children || node.children.length === 0) {
      return currentDepth;
    }
    
    let maxChildDepth = currentDepth;
    for (const child of node.children) {
      const childDepth = this.getMaxDepth(child, currentDepth + 1);
      maxChildDepth = Math.max(maxChildDepth, childDepth);
    }
    
    return maxChildDepth;
  }
}
