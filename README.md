# dependency-optimizer

A powerful NPM package for scanning unused dependencies and analyzing node_modules waste. Optimize your project dependencies and reduce bundle size with smart dependency detection and automated cleanup.

## Features

### 🔍 Core Dependency Scanning
- **Depcheck Integration**: Leverages the depcheck package for accurate unused dependency detection
- **Auto-detected Specials**: Automatically enables appropriate depcheck specials based on detected project files (ESLint, Babel, Webpack, Jest, Next.js, Gatsby, Rollup, binary scripts)
- **Smart Parsing**: Uses default depcheck parsers for optimal CommonJS and ES module detection

### 🗂️ Monorepo Support
- **Recursive Scanning**: `--recursive` flag scans all workspace packages automatically
- **Workspace Detection**: Supports both npm/yarn workspaces and Lerna configurations
- **Filtering**: `--workspace <pattern>` allows targeting specific packages for focused analysis
- **Multi-package Reporting**: Aggregates results across all scanned packages

### 🔧 Auto-fix Functionality
- **Safe Removal**: `--fix` flag automatically removes unused dependencies from package.json files
- **Preservation**: Maintains JSON formatting and structure during modifications
- **Detailed Reporting**: Shows exactly which dependencies were removed from each package

### 📦 Node_modules Analysis
- **Size Analysis**: Identifies packages exceeding configurable size thresholds (default: 10MB)
- **Dependency Depth**: Detects packages with excessive transitive dependencies (default: >5 levels)
- **Comprehensive Metrics**: Reports total package count, combined size, and optimization opportunities
- **JSON Output**: `--json` flag enables programmatic consumption of analysis results

## Installation

```bash
npm install -g @azwebmaster/dependency-optimizer
```

Or use without installation:

```bash
npx @azwebmaster/dependency-optimizer scan
```

## CLI Usage

The tool provides two main commands:

### Scan Command

```bash
# Basic scanning
dependency-optimizer scan

# Scan and auto-fix
dependency-optimizer scan --fix

# Monorepo scanning
dependency-optimizer scan --recursive

# Filter specific workspaces
dependency-optimizer scan --recursive --workspace frontend

# Verbose output
dependency-optimizer scan --verbose
```

**Options:**
- `--fix`: Automatically remove unused dependencies from package.json
- `--recursive`: Recursively scan all workspace packages
- `--workspace <pattern>`: Filter specific workspace packages
- `--verbose`: Enable verbose output
- `--include-dev`: Include dev dependencies in scan (default: true)

### Analyze Command

```bash
# Basic node_modules analysis
dependency-optimizer analyze

# Custom thresholds
dependency-optimizer analyze --size-threshold 5 --depth-threshold 3

# JSON output
dependency-optimizer analyze --json
```

**Options:**
- `--size-threshold <mb>`: Size threshold in MB for flagging large packages (default: 10)
- `--depth-threshold <depth>`: Depth threshold for flagging deep dependency trees (default: 5)
- `--json`: Output results in JSON format

## Example Output

### Basic Scanning
```bash
$ dependency-optimizer scan
🔍 Scanning for unused dependencies...

❌ Unused dependencies (2):
  - lodash-unused (dependencies)
  - moment-unused (devDependencies)

💡 Tip: Use --fix to automatically remove unused dependencies
```

### Monorepo with Auto-fix
```bash
$ dependency-optimizer scan --recursive --fix
🔍 Scanning for unused dependencies...

📦 packages/frontend:
🔧 Fixed package.json:
  ✅ Removed unused-ui-lib from dependencies

📦 packages/backend:
✅ No unused dependencies

📊 Summary:
   Packages scanned: 3
   Total unused dependencies: 1
   Dependencies removed: 1
```

### Node_modules Analysis
```bash
$ dependency-optimizer analyze
📦 Node_modules Analysis
========================

📊 Total packages: 847
💾 Total size: 156.8MB
📁 Location: ./node_modules

🔴 Large packages (>10MB):
   @types/node: 15.2MB
   typescript: 12.8MB

🔶 Deep dependency packages (>5 levels):
   some-old-package: 8 levels deep

💡 Optimization suggestions:
   • Large packages account for 28.0MB (17.9%)
   • Consider alternatives for large packages
   • Use tree-shaking and import only what you need
   • Deep dependencies may indicate outdated or inefficient packages
```

## Programmatic Usage

You can also use the package programmatically:

```typescript
import { scanDependencies, analyzeNodeModules } from '@azwebmaster/dependency-optimizer';

// Scan for unused dependencies
const scanResults = await scanDependencies('./my-project', {
  fix: false,
  recursive: true,
  verbose: true
});

console.log('Unused dependencies:', scanResults);

// Analyze node_modules
const analysisResults = await analyzeNodeModules('./my-project', {
  sizeThreshold: 10,
  depthThreshold: 5
});

console.log('Analysis:', analysisResults);
```

## Configuration Detection

The tool automatically detects and configures appropriate depcheck specials based on your project setup:

- **ESLint**: `.eslintrc`, `.eslintrc.js`, `.eslintrc.json`, `eslint.config.js`
- **Babel**: `.babelrc`, `babel.config.js`, `.babelrc.js`
- **Webpack**: `webpack.config.js`, `webpack.config.ts`
- **Jest**: `jest.config.js`, `jest.config.ts`
- **Next.js**: `next.config.js`
- **Gatsby**: `gatsby-config.js`
- **Binary Scripts**: Automatically detected from package.json bin entries

## Workspace Support

Works seamlessly with:
- **npm workspaces**: Detects `workspaces` field in package.json
- **Yarn workspaces**: Supports both array and object syntax
- **Lerna**: Reads `lerna.json` configuration
- **Custom patterns**: Use glob patterns to specify workspace locations

## Safety Features

- **Dry Run**: Use `--verbose` to see what would be detected before making changes
- **Backup Recommended**: Always review changes before using `--fix`
- **Formatting Preservation**: Maintains your package.json formatting and structure
- **Error Handling**: Gracefully handles missing files and permission errors

## Contributing

Contributions are welcome! Please read the contributing guidelines and submit pull requests for any improvements.

## License

MIT

## Related Projects

This package is part of the [@azwebmaster](https://github.com/azwebmaster) tooling ecosystem for modern web development.
