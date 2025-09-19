# Changelog

## 0.0.7

### Patch Changes

- 67f0bcb: compress release assets

## 0.0.6

### Patch Changes

- 55e0fc0: test

## 0.0.5

### Patch Changes

- e59eb80: fix executable releases

## 0.0.4

### Patch Changes

- 3e43007: fix bin uploads to release

## 0.0.3

### Patch Changes

- f8d037b: publish bins
- 6484d97: publish bins

## 0.0.2

### Patch Changes

- 8999866: preview release

All notable changes to this project will be documented in this file.

## [0.0.1] - 2024-12-18

### Added

- Initial release of dependency-optimizer package
- Core dependency scanning with depcheck integration
- Auto-detection of project specials (ESLint, Babel, Webpack, Jest, Next.js, Gatsby, etc.)
- Monorepo support for npm/yarn workspaces and Lerna
- Recursive scanning with workspace filtering
- Auto-fix functionality to remove unused dependencies
- Node_modules analysis for size and depth optimization
- CLI interface with scan and analyze commands
- JSON output support for programmatic usage
- Comprehensive test coverage with Vitest
- TypeScript support with full type definitions
- GitHub Actions CI/CD pipeline
- Detailed documentation and examples

### Features

- **Dependency Scanning**: Detect unused dependencies with smart parsing
- **Monorepo Support**: Recursive scanning across workspace packages
- **Auto-fix**: Safely remove unused dependencies while preserving formatting
- **Node_modules Analysis**: Identify large packages and deep dependency trees
- **CLI Tools**: User-friendly command-line interface
- **Programmatic API**: Use as a library in your Node.js projects
- **Configuration Detection**: Automatically configure based on project setup

### CLI Commands

- `dependency-optimizer scan` - Scan for unused dependencies
- `dependency-optimizer analyze` - Analyze node_modules for optimization
- `dependency-optimizer examples` - Show usage examples
