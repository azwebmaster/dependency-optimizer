export { DependencyScanner } from './scanner.js';
export { NodeModulesAnalyzer } from './analyzer.js';
export type {
  ScanOptions,
  AnalyzeOptions,
  ScanResult,
  AnalyzeResult,
  UnusedDependency,
  PackageAnalysis,
  PackageJson,
  WorkspaceConfig
} from './types.js';

// Convenience functions for programmatic usage
import { DependencyScanner } from './scanner.js';
import { NodeModulesAnalyzer } from './analyzer.js';
import type { ScanOptions, AnalyzeOptions } from './types.js';
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