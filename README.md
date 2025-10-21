# Dependency Optimizer

[![npm version](https://img.shields.io/npm/v/@azwebmaster/dependency-optimizer.svg)](https://www.npmjs.com/package/@azwebmaster/dependency-optimizer)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-blue.svg)](https://www.typescriptlang.org/)

A TypeScript tool for analyzing and optimizing Node.js project dependencies. Detect unused packages, find duplicates, analyze bundle sizes, and clean up your `node_modules`.

## Features

- **Unused Dependency Detection**: Find packages that are no longer used
- **Duplicate Package Detection**: Identify multiple versions of the same package
- **Size Analysis**: Identify large packages affecting bundle size
- **Monorepo Support**: Analyze entire workspaces with a single command
- **Auto-fix**: Automatically remove unused dependencies
- **Lock File Support**: Works with npm, yarn, pnpm, and Bun

## Installation

```bash
# Global installation
npm install -g @azwebmaster/dependency-optimizer

# Or use without installation
npx @azwebmaster/dependency-optimizer unused
```

## Quick Start

```bash
# Scan for unused dependencies
depoptimize unused

# Analyze package sizes
depoptimize size

# Find duplicate packages
depoptimize duplicates

# Check dev dependency placement
depoptimize devcheck

# Build dependency tree
depoptimize tree

# Show all available commands
depoptimize --help
```

## Commands

| Command | Description |
|---------|-------------|
| `unused` | Find unused dependencies |
| `size` | Analyze package sizes |
| `duplicates` | Find duplicate packages |
| `devcheck` | Validate dev dependency placement |
| `tree` | Build dependency tree |
| `config` | Manage configuration |
| `examples` | Show usage examples |

## Documentation

- **[Command Documentation](docs/)** - Detailed command guides
- **[Contributing Guide](CONTRIBUTING.md)** - Development guidelines
- **[Changelog](CHANGELOG.md)** - Version history

## Programmatic Usage

```typescript
import { scanDependencies, analyzeNodeModules } from '@azwebmaster/dependency-optimizer';

// Scan for unused dependencies
const results = await scanDependencies('./my-project');

// Analyze node_modules
const analysis = await analyzeNodeModules('./my-project');
```

## Supported Lock Files

- **npm**: `package-lock.json`
- **yarn**: `yarn.lock` (v1 and v2+)
- **pnpm**: `pnpm-lock.yaml`
- **Bun**: `bun.lock`

## Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

## License

MIT License - see [LICENSE](LICENSE) file for details.

## Links

- [GitHub Repository](https://github.com/azwebmaster/dependency-optimizer)
- [NPM Package](https://www.npmjs.com/package/@azwebmaster/dependency-optimizer)
- [Issues & Bug Reports](https://github.com/azwebmaster/dependency-optimizer/issues)

---

**Made with ❤️ by [azwebmaster](https://github.com/azwebmaster)**