export interface ScanOptions {
  /** Fix package.json by removing unused dependencies */
  fix?: boolean;
  /** Enable verbose output */
  verbose?: boolean;
  /** Include dev dependencies in the scan */
  includeDevDependencies?: boolean;
  /** Specific package name to scan (optional) */
  packageName?: string;
}

export interface AnalyzeOptions {
  /** Size threshold in MB for flagging large packages */
  sizeThreshold?: number;
  /** Depth threshold for flagging deep dependency trees */
  depthThreshold?: number;
  /** Output results in JSON format */
  json?: boolean;
  /** Specific package name to analyze (optional) */
  packageName?: string;
  /** Include dev dependencies in analysis */
  includeDevDependencies?: boolean;
  /** Project path for dependency analysis */
  projectPath?: string;
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

// Workspace-related types for automatic workspace detection
export interface WorkspaceInfo {
  rootPath: string;
  workspaceType: 'npm' | 'yarn' | 'pnpm' | 'lerna' | null;
  memberPackages: string[];
  isWorkspaceMember: boolean;
}

export interface MergedPackageInfo {
  originalDeps: PackageJson;
  rootDeps: PackageJson;
  mergedDeps: PackageJson;
  workspaceRoot: string;
  workspaceType: string | null;
}

export interface PackageJson {
  name?: string;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
  optionalDependencies?: Record<string, string>;
  workspaces?: string[] | { packages: string[] };
}

// Common types shared between lock file parsers
export interface DependencyTreeNode {
  name: string;
  version: string;
  resolved?: string;
  integrity?: string;
  isDirect?: boolean;
  isDevDependency?: boolean;
  dependents?: string[];
  dependencies?: DependencyTreeNode[];
  children?: DependencyTreeNode[];
  depth: number;
  path: string[];
  isRoot?: boolean;
  size?: number; // Size in bytes
}

export interface DependencyTree {
  root: DependencyTreeNode;
  allNodes: Map<string, DependencyTreeNode[]>;
}

export interface DuplicateInfo {
  name: string;
  instances: DependencyTreeNode[];
  versions: string[];
}

export interface DuplicateSummary {
  totalPackages: number;
  duplicatePackages: number;
  totalDuplicateInstances: number;
  duplicates: DuplicateInfo[];
}

export interface DevCheckOptions {
  /** Fix package.json by moving misplaced dependencies to devDependencies */
  fix?: boolean;
  /** Output results in JSON format */
  json?: boolean;
  /** Additional packages to include in dev dependency check */
  include?: string[];
  /** Packages to exclude from dev dependency check (takes priority over include) */
  exclude?: string[];
}

export interface MisplacedDependency {
  name: string;
  currentLocation: 'dependencies';
  suggestedLocation: 'devDependencies';
  reason: string;
  pattern: string;
}

export interface DevCheckResult {
  packagePath: string;
  packageName?: string;
  misplacedDependencies: MisplacedDependency[];
  fixedDependencies?: MisplacedDependency[];
  errors?: string[];
}