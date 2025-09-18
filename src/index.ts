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

export async function scanDependencies(projectPath?: string, options?: ScanOptions) {
  const scanner = new DependencyScanner(options);
  return scanner.scan(projectPath);
}

export async function analyzeNodeModules(projectPath?: string, options?: AnalyzeOptions) {
  const analyzer = new NodeModulesAnalyzer(options);
  return analyzer.analyze(projectPath);
}