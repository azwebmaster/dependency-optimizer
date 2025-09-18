export interface ScanOptions {
  /** Fix package.json by removing unused dependencies */
  fix?: boolean;
  /** Recursively scan all workspace packages */
  recursive?: boolean;
  /** Filter specific workspace packages */
  workspace?: string;
  /** Enable verbose output */
  verbose?: boolean;
  /** Include dev dependencies in the scan */
  includeDevDependencies?: boolean;
}

export interface AnalyzeOptions {
  /** Size threshold in MB for flagging large packages */
  sizeThreshold?: number;
  /** Depth threshold for flagging deep dependency trees */
  depthThreshold?: number;
  /** Output results in JSON format */
  json?: boolean;
}

export interface UnusedDependency {
  name: string;
  type: 'dependencies' | 'devDependencies' | 'peerDependencies';
}

export interface ScanResult {
  packagePath: string;
  packageName?: string;
  unusedDependencies: UnusedDependency[];
  fixedDependencies?: UnusedDependency[];
  errors?: string[];
}

export interface PackageAnalysis {
  name: string;
  size: number;
  depth: number;
  path: string;
}

export interface AnalyzeResult {
  totalPackages: number;
  totalSize: number;
  largePackages: PackageAnalysis[];
  deepPackages: PackageAnalysis[];
  nodeModulesPath: string;
}

export interface WorkspaceConfig {
  packages?: string[];
  workspaces?: string[] | { packages: string[] };
}

export interface PackageJson {
  name?: string;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
  workspaces?: string[] | { packages: string[] };
}