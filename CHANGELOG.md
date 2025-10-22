# Changelog

## 0.0.11

### Patch Changes

- 246987a: bump version

## 0.0.10

### Patch Changes

- 8b7fc2c: support symlinks

## 0.0.9

### Patch Changes

- d5d41ca: add debug

## 0.0.8

### Patch Changes

- a0b8767: fix dist

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

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Enhanced configuration system with support for multiple configuration sources
- Improved monorepo support with better workspace detection
- New `devcheck` command for validating dev dependency placement
- Advanced duplicate detection with lock file analysis
- Comprehensive dependency tree visualization
- Enhanced size analysis with dependency breakdown
- Better error handling and user feedback
- Extensive test coverage improvements

### Changed

- Refactored command system for better modularity
- Improved TypeScript type definitions
- Enhanced CLI output formatting
- Better integration with different lock file formats

### Fixed

- Fixed issues with workspace package detection
- Resolved problems with duplicate detection accuracy
- Improved handling of edge cases in dependency scanning
- Fixed configuration loading precedence

## [0.0.9] - 2024-12-19

### Added

- Debug logging support throughout the application
- Enhanced error reporting and diagnostics
- Better integration with Bun package manager

### Changed

- Improved build process and distribution
- Enhanced CLI command registration system

### Fixed

- Fixed issues with command execution in certain environments
- Resolved problems with lock file parsing edge cases

## [0.0.8] - 2024-12-18

### Fixed

- Fixed distribution build issues
- Resolved problems with CLI executable permissions

## [0.0.7] - 2024-12-18

### Changed

- Compressed release assets for better performance
- Optimized bundle sizes

## [0.0.6] - 2024-12-18

### Added

- Additional test coverage
- Enhanced error handling

## [0.0.5] - 2024-12-18

### Fixed

- Fixed executable release packaging
- Resolved issues with CLI installation

## [0.0.4] - 2024-12-18

### Fixed

- Fixed binary upload issues in releases
- Improved package distribution

## [0.0.3] - 2024-12-18

### Added

- Published binary executables
- Enhanced CLI functionality

## [0.0.2] - 2024-12-18

### Added

- Preview release with core functionality
- Basic CLI interface

## [0.0.1] - 2024-12-18

### Added

- Initial release of dependency-optimizer package
- Core dependency scanning with depcheck integration
- Auto-detection of project specials (ESLint, Babel, Webpack, Jest, Next.js, Gatsby, etc.)
- Monorepo support for npm/yarn workspaces and Lerna
- Recursive scanning with workspace filtering
- Auto-fix functionality to remove unused dependencies
- Node_modules analysis for size and depth optimization
- CLI interface with unused and analyze commands
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

- `dependency-optimizer unused` - Scan for unused dependencies
- `dependency-optimizer analyze` - Analyze node_modules for optimization
- `dependency-optimizer examples` - Show usage examples

---

## Version History Summary

### Major Features by Version

**v0.0.9** - Debug & Diagnostics

- Enhanced debugging capabilities
- Better error reporting
- Improved Bun integration

**v0.0.8** - Distribution Fixes

- Fixed build and distribution issues
- Resolved CLI permission problems

**v0.0.7** - Performance Optimization

- Compressed release assets
- Optimized bundle sizes

**v0.0.6** - Testing & Quality

- Expanded test coverage
- Enhanced error handling

**v0.0.5** - Packaging Improvements

- Fixed executable packaging
- Improved CLI installation

**v0.0.4** - Release Management

- Fixed binary upload issues
- Better package distribution

**v0.0.3** - Binary Support

- Added binary executables
- Enhanced CLI functionality

**v0.0.2** - Preview Release

- Core functionality preview
- Basic CLI interface

**v0.0.1** - Initial Release

- Complete dependency analysis suite
- Monorepo support
- Auto-fix capabilities
- Comprehensive CLI interface
- Full TypeScript support
