# dependency-optimizer

A powerful CLI tool to optimize dependency usage in JavaScript/Node.js projects with full monorepo support.

## Features

- 🔍 **Unused dependency detection** using depcheck
- 🏗️ **Monorepo support** with recursive workspace scanning
- 🤖 **Auto-detect specials** based on project file patterns  
- 🔧 **Auto-fix mode** to remove unused dependencies
- 📊 **node_modules analysis** for large packages and deep dependency trees
- 🎯 **Workspace filtering** for targeted scanning

## Installation

```bash
npm install -g dependency-optimizer
```

Or use directly with npx:

```bash
npx dependency-optimizer scan
```

## Usage

### Scan for unused dependencies

```bash
# Scan current directory
dependency-optimizer scan

# Scan with verbose output
dependency-optimizer scan --verbose

# Auto-fix by removing unused dependencies
dependency-optimizer scan --fix

# Scan monorepo recursively
dependency-optimizer scan --recursive

# Filter specific workspaces
dependency-optimizer scan --recursive --workspace app1

# Combine options
dependency-optimizer scan --recursive --fix --verbose
```

### Analyze node_modules

```bash
# Analyze for large packages and deep dependency trees
dependency-optimizer analyze

# Custom thresholds
dependency-optimizer analyze --size-threshold 5 --depth-threshold 3

# JSON output
dependency-optimizer analyze --json
```

### Command Options

#### `scan` command
- `-f, --fix` - Automatically remove unused dependencies from package.json
- `-r, --recursive` - Scan monorepo workspaces recursively  
- `-w, --workspace <pattern>` - Filter workspaces by pattern (e.g., "app1", "packages/")
- `--verbose` - Show detailed output including detected specials

#### `analyze` command  
- `--size-threshold <mb>` - Size threshold in MB for flagging large packages (default: 10)
- `--depth-threshold <depth>` - Depth threshold for flagging deep dependency trees (default: 5)
- `--json` - Output results in JSON format

## Monorepo Support

The tool automatically detects and supports various monorepo configurations:

- **npm/yarn workspaces** - Reads `workspaces` field from package.json
- **Lerna** - Reads packages from lerna.json
- **Workspace filtering** - Use `--workspace` to target specific packages

Example monorepo structure:
```
my-monorepo/
├── package.json          # Root with workspaces config
├── packages/
│   ├── app1/
│   │   ├── package.json
│   │   └── src/
│   └── app2/
│       ├── package.json  
│       └── src/
└── lerna.json            # Optional lerna config
```

## Auto-detected Specials

The tool automatically enables depcheck specials based on detected files:

- **ESLint** - `.eslintrc.*`, `eslint.config.js`
- **Babel** - `babel.config.*`, `.babelrc.*`  
- **Webpack** - `webpack.config.js`, `webpack.*.js`
- **Jest** - `jest.config.*`, test files
- **Next.js** - `next.config.js`
- **Gatsby** - `gatsby-*.js` files
- **Rollup** - `rollup.config.js`
- **Binary scripts** - Files in `bin/`, `scripts/`

## Examples

### Basic project scan
```bash
$ dependency-optimizer scan
🔍 Scanning for unused dependencies...
Found 1 package(s) to scan

Scanning: .
❌ Unused dependencies (2):
  - lodash-unused
  - moment-unused

📊 Summary: Found 2 unused dependencies across 1 packages
```

### Auto-fix unused dependencies
```bash
$ dependency-optimizer scan --fix
🔍 Scanning for unused dependencies...
Found 1 package(s) to scan

Scanning: .
❌ Unused dependencies (2):
  - lodash-unused
  - moment-unused

🔧 Fixing package.json...
  ✅ Removed lodash-unused from dependencies
  ✅ Removed moment-unused from dependencies

✅ Removed 2 unused dependencies from package.json
```

### Monorepo scanning
```bash
$ dependency-optimizer scan --recursive
🔍 Scanning for unused dependencies...
Found 3 package(s) to scan

Scanning: .
✅ No unused dependencies found

Scanning: packages/frontend
❌ Unused dependencies (1):
  - unused-ui-lib

Scanning: packages/backend  
✅ No unused dependencies found

📊 Summary: Found 1 unused dependencies across 1 packages
```

### Analyze node_modules
```bash
$ dependency-optimizer analyze
📊 Analyzing node_modules...

📦 Total packages: 847
💾 Total size: 156.8 MB

🔴 Large packages (>10MB):
  @types/node: 15.2MB
  typescript: 12.8MB
  
🔶 Deep dependency trees (>5 levels or deps):
  webpack: depth 3, 15 transitive deps
  jest: depth 2, 22 transitive deps
```

## Development

```bash
# Clone repository
git clone https://github.com/azwebmaster/dependency-optimizer.git
cd dependency-optimizer

# Install dependencies
npm install

# Run tests
npm test

# Test CLI locally
node bin/cli.js scan --help
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Run tests: `npm test`
6. Submit a pull request

## License

ISC
