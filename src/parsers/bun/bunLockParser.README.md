# Bun Lock Parser

A comprehensive TypeScript module for parsing Bun lock files and building dependency trees with duplicate detection.

## Features

- **Complete Bun Lock File Parsing**: Handles the Bun-specific lock file format with package arrays
- **Dependency Tree Building**: Creates a full tree structure of all dependencies
- **Duplicate Detection**: Identifies packages with multiple instances or versions
- **Path Tracking**: Shows complete dependency paths from root to any package
- **JSON Export**: Serializable tree format for further analysis
- **TypeScript Support**: Full type definitions and interfaces

## Installation

This module is part of the `@azwebmaster/dependency-optimizer` package:

```bash
npm install @azwebmaster/dependency-optimizer
# or
bun add @azwebmaster/dependency-optimizer
```

## Usage

### Basic Usage

```typescript
import { BunLockParser } from '@azwebmaster/dependency-optimizer';

const parser = new BunLockParser();

// Parse a bun.lock file
const lockData = await parser.parseAndNormalize('./bun.lock');

// Build dependency tree
const tree = parser.buildDependencyTree();

// Get duplicates summary
const summary = parser.getDuplicatesSummary(tree);

console.log(`Found ${summary.duplicatePackages} packages with duplicates`);
```

### Advanced Analysis

```typescript
// Find all instances of a specific package
const minimatchInstances = parser.getPackageInstances(tree, 'minimatch');

// Get all dependency paths to a package
const paths = parser.findAllPathsToPackage(tree, 'minimatch');
console.log('Dependency paths to minimatch:');
paths.forEach(path => console.log(`  ${path}`));

// Check if a package has duplicates
if (parser.hasDuplicates(tree, 'minimatch')) {
  console.log('minimatch has duplicate versions');
}

// Export complete analysis as JSON
const jsonStr = parser.exportTreeAsJson(tree);
await fs.writeFile('dependency-analysis.json', jsonStr);
```

## API Reference

### BunLockParser

#### Methods

##### `parseAndNormalize(lockPath: string): Promise<BunLockData>`

Parses a bun.lock file and normalizes it to a structured format.

**Parameters:**
- `lockPath`: Path to the bun.lock file

**Returns:** Promise resolving to normalized lock data

**Throws:** Error if file doesn't exist or can't be parsed

##### `buildDependencyTree(): DependencyTree`

Builds a complete dependency tree from parsed lock data.

**Returns:** Dependency tree with root node and duplicate detection

**Throws:** Error if `parseAndNormalize` hasn't been called first

##### `getPackageInstances(tree: DependencyTree, packageName: string): DependencyTreeNode[]`

Gets all instances of a specific package in the tree.

**Parameters:**
- `tree`: The dependency tree
- `packageName`: Name of the package to find

**Returns:** Array of all instances of the package

##### `findAllPathsToPackage(tree: DependencyTree, packageName: string): string[]`

Finds all dependency paths from root to a specific package.

**Parameters:**
- `tree`: The dependency tree
- `packageName`: Name of the package

**Returns:** Array of path strings (e.g., "root → dep1 → dep2 → target")

##### `hasDuplicates(tree: DependencyTree, packageName: string): boolean`

Checks if a package has duplicate instances in the tree.

##### `getDuplicatesSummary(tree: DependencyTree): DuplicatesSummary`

Gets a comprehensive summary of all duplicates in the tree.

##### `exportTreeAsJson(tree: DependencyTree): string`

Exports the dependency tree as JSON string (avoiding circular references).

### Types

#### `DependencyTreeNode`

```typescript
interface DependencyTreeNode {
  name: string;
  version: string;
  resolved?: string;
  integrity?: string;
  isDirect: boolean;
  isDevDependency: boolean;
  dependents: string[];
  dependencies: DependencyTreeNode[];
  depth: number;
  path: string[];
}
```

#### `DependencyTree`

```typescript
interface DependencyTree {
  root: DependencyTreeNode;
  allNodes: Map<string, DependencyTreeNode[]>;
  duplicates: Map<string, DependencyTreeNode[]>;
}
```

#### `BunLockData`

```typescript
interface BunLockData {
  lockfileVersion: number;
  workspaces: Record<string, BunWorkspaceInfo>;
  packages: Record<string, BunPackageInfo>;
}
```

## Bun Lock File Format

This parser handles the Bun-specific lock file format where packages are stored as arrays:

```json
{
  "lockfileVersion": 1,
  "workspaces": {
    "": {
      "name": "my-project",
      "dependencies": {
        "commander": "^12.1.0"
      }
    }
  },
  "packages": {
    "commander": [
      "commander@12.1.0",
      "https://registry.npmjs.org/commander/-/commander-12.1.0.tgz",
      {
        "dependencies": {},
        "bin": {
          "commander": "index.js"
        }
      },
      "sha512-..."
    ]
  }
}
```

The parser converts this format into a normalized structure for easier analysis.

## Error Handling

The parser includes comprehensive error handling:

- **File not found**: Clear error message if bun.lock doesn't exist
- **Parse errors**: Detailed JSON parsing error messages
- **Invalid format**: Validation of lock file structure
- **Circular dependencies**: Automatic detection and prevention of infinite loops
- **Missing packages**: Graceful handling of missing package references

## Performance

- **Efficient parsing**: Single-pass parsing with normalization
- **Memory optimized**: Avoids duplicate object creation
- **Circular prevention**: Prevents infinite recursion in dependency trees
- **Lazy evaluation**: Only builds trees when requested

## Limitations

- **Bun-specific**: Only works with Bun lock files (not npm/yarn/pnpm)
- **Read-only**: Parser is for analysis only, doesn't modify lock files
- **Version resolution**: Currently uses first matching version, not full semver resolution

## Examples

See `examples/bunLockExample.ts` for a complete working example.

## Testing

The module includes comprehensive tests covering:

- Lock file parsing
- Tree building
- Duplicate detection
- Path finding
- Error scenarios
- Edge cases

Run tests with:

```bash
bun test bunLockParser.test.ts
```