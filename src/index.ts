export { DependencyScanner } from './scanner.js';
export { NodeModulesAnalyzer } from './analyzer.js';
export { PackageSizeAnalyzer } from './sizeAnalyzer.js';
export { DuplicateDetector } from './duplicateDetector.js';
export { LockFileParser } from './lockFileParser.js';
export { DependencyTreeBuilder } from './dependencyTreeBuilder.js';
export { DevDependencyDetector } from './devDependencyDetector.js';

// Command system exports
export { 
  UnusedCommand,
  SizeCommand,
  DuplicatesCommand,
  TreeCommand,
  DevCheckCommand,
  ConfigCommand,
  ExamplesCommand,
  commands,
  getAvailableCommands,
  getCommand,
  validateCommandNames
} from './commands/index.js';
export type { 
  BaseCommand,
  CommandOptions,
  CommandResult,
  CommandWithPackage,
  CommandWithoutPackage
} from './commands/types.js';

// Configuration system exports
export { ConfigLoader } from './config/index.js';
export type {
  DepOptimizerConfig,
  ConfigLoaderOptions
} from './config/types.js';
export type {
  ScanOptions,
  AnalyzeOptions,
  ScanResult,
  AnalyzeResult,
  UnusedDependency,
  PackageAnalysis,
  PackageJson,
  WorkspaceConfig,
  DevCheckOptions,
  DevCheckResult,
  MisplacedDependency
} from './types.js';
export type { PackageSizeInfo, SizeAnalyzerOptions } from './sizeAnalyzer.js';
export type {
  DuplicateDetectorOptions
} from './duplicateDetector.js';
export type { DependencyInfo, LockFileData } from './lockFileParser.js';
export type { DependencyNode, DependencyPath } from './dependencyTreeBuilder.js';

// Convenience functions for programmatic usage
import { DependencyScanner } from './scanner.js';
import { NodeModulesAnalyzer } from './analyzer.js';
import { PackageSizeAnalyzer } from './sizeAnalyzer.js';
import { DuplicateDetector } from './duplicateDetector.js';
import { LockFileParser } from './lockFileParser.js';
import { DependencyTreeBuilder } from './dependencyTreeBuilder.js';
import { DevDependencyDetector } from './devDependencyDetector.js';
import type { ScanOptions, AnalyzeOptions, DevCheckOptions } from './types.js';
import type { SizeAnalyzerOptions } from './sizeAnalyzer.js';
import type { DuplicateDetectorOptions } from './duplicateDetector.js';
import createDebug from 'debug';

const debug = createDebug('depoptimize:index');

export async function scanDependencies(projectPath?: string, options?: ScanOptions) {
  debug('scanDependencies called with path: %s, options: %O', projectPath, options);
  const scanner = new DependencyScanner(options);
  const result = await scanner.scan(projectPath);
  debug('scanDependencies completed, returning %d results', result.length);
  return result;
}

export async function analyzeNodeModules(projectPath?: string, options?: AnalyzeOptions) {
  debug('analyzeNodeModules called with path: %s, options: %O', projectPath, options);
  const analyzer = new NodeModulesAnalyzer(options);
  const result = await analyzer.analyze(projectPath);
  debug('analyzeNodeModules completed, found %d packages', result.totalPackages);
  return result;
}

export async function analyzePackageSizes(projectPath?: string, packageName?: string, options?: SizeAnalyzerOptions) {
  debug('analyzePackageSizes called with path: %s, package: %s, options: %O', projectPath, packageName, options);
  const analyzer = new PackageSizeAnalyzer(options);
  const result = await analyzer.analyzePackageSize(projectPath || process.cwd(), packageName);
  debug('analyzePackageSizes completed, total size: %d bytes', result.size);
  return result;
}

export async function detectDuplicates(projectPath?: string, options?: DuplicateDetectorOptions) {
  debug('detectDuplicates called with path: %s, options: %O', projectPath, options);
  const detector = new DuplicateDetector(options);

  const projectDir = projectPath || process.cwd();

  // Parse lock file
  const lockFileParser = new LockFileParser();
  const lockFileData = await lockFileParser.parseLockFile(projectDir);

  if (!lockFileData) {
    throw new Error('No lock file found in the project');
  }

  // Build dependency tree using the appropriate lock parser
  const dependencyTree = await buildDependencyTreeFromLockData(lockFileData, projectDir, options?.includeDevDependencies !== false);

  const result = await detector.detectDuplicates(dependencyTree, projectDir);
  debug('detectDuplicates completed, found %d duplicate groups', result.duplicates.length);
  return { result, dependencyTree };
}

export async function checkDevDependencies(projectPath?: string, options?: DevCheckOptions) {
  debug('checkDevDependencies called with path: %s, options: %O', projectPath, options);
  const detector = new DevDependencyDetector(options);
  const result = await detector.check(projectPath || process.cwd());
  debug('checkDevDependencies completed, found %d misplaced dependencies', result.misplacedDependencies.length);
  return result;
}

// Helper function to build DependencyTree from LockFileData using the appropriate lock parser
export async function buildDependencyTreeFromLockData(lockData: any, projectPath: string, includeDevDependencies: boolean = true): Promise<any> {
  const path = await import('path');
  
  // Use the appropriate lock parser based on the lock file type
  switch (lockData.type) {
    case 'bun': {
      const { BunLockParser } = await import('./parsers/bun/index.js');
      const bunParser = new BunLockParser();
      const bunLockFilePath = path.join(projectPath, 'bun.lock');
      const bunLockData = await bunParser.parseAndNormalize(bunLockFilePath);
      return bunParser.buildDependencyTree(20, includeDevDependencies);
    }
    
    case 'pnpm': {
      const { PnpmLockParser } = await import('./parsers/pnpm/index.js');
      const pnpmParser = new PnpmLockParser();
      const pnpmLockFilePath = path.join(projectPath, 'pnpm-lock.yaml');
      const pnpmLockData = await pnpmParser.parseAndNormalize(pnpmLockFilePath);
      return pnpmParser.buildDependencyTree(20, includeDevDependencies);
    }
    
    case 'npm':
    case 'yarn':
    default: {
      // For npm and yarn, use the DependencyTreeBuilder
      const treeBuilder = new DependencyTreeBuilder(lockData, projectPath, includeDevDependencies);
      const treeNodes = treeBuilder.buildDependencyTreeStructure(20);
      
      // Convert to the expected format
      const allNodes = new Map<string, any[]>();
      const rootNode = {
        name: 'root',
        version: '1.0.0',
        children: treeNodes,
        isRoot: true,
        depth: 0
      };
      
      // Build allNodes map from the tree structure
      const buildAllNodes = (nodes: any[], parentPath: string[] = []) => {
        for (const node of nodes) {
          const fullPath = [...parentPath, node.name];
          // Use composite key format: name@version (consistent with other parsers)
          const compositeKey = `${node.name}@${node.version}`;
          if (!allNodes.has(compositeKey)) {
            allNodes.set(compositeKey, []);
          }
          
          const nodeWithPath = {
            ...node,
            path: fullPath.slice(0, -1), // Remove the node itself from the path
            resolved: '',
            integrity: '',
            isDirect: parentPath.length === 0,
            isDevDependency: false,
            dependents: []
          };
          
          allNodes.get(compositeKey)!.push(nodeWithPath);
          
          // Recursively process children
          if (node.children && node.children.length > 0) {
            buildAllNodes(node.children, fullPath);
          }
        }
      };
      
      buildAllNodes(treeNodes);
      
      return {
        root: rootNode,
        allNodes
      };
    }
  }
}