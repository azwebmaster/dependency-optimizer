# Contributing to Dependency Optimizer

Thank you for your interest in contributing to the Dependency Optimizer project! This document provides guidelines and information for contributors.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Setup](#development-setup)
- [Project Structure](#project-structure)
- [Contributing Guidelines](#contributing-guidelines)
- [Testing](#testing)
- [Documentation](#documentation)
- [Release Process](#release-process)
- [Community Guidelines](#community-guidelines)

## Code of Conduct

This project adheres to a code of conduct. By participating, you are expected to uphold this code. Please report unacceptable behavior to the project maintainers.

## Getting Started

### Prerequisites

- **Node.js**: Version 18 or higher
- **Bun**: Version 1.2.19 or higher (package manager)
- **Git**: For version control
- **TypeScript**: Version 5.0 or higher

### Fork and Clone

1. Fork the repository on GitHub
2. Clone your fork locally:
   ```bash
   git clone https://github.com/your-username/dependency-optimizer.git
   cd dependency-optimizer
   ```
3. Add the upstream repository:
   ```bash
   git remote add upstream https://github.com/azwebmaster/dependency-optimizer.git
   ```

## Development Setup

### Installation

```bash
# Install dependencies
bun install

# Build the project
bun run build

# Run tests
bun test
```

### Available Scripts

| Script | Description |
|--------|-------------|
| `bun build` | Build TypeScript to dist/ |
| `bun test` | Run tests with vitest |
| `bun test:watch` | Run tests in watch mode |
| `bun test:coverage` | Run tests with coverage report |
| `bun test:ui` | Run tests with vitest UI |
| `bun bundle` | Create bundled distribution |
| `bun bundle:minified` | Create minified bundle |

### Development Workflow

1. **Create a branch**: `git checkout -b feature/your-feature-name`
2. **Make changes**: Implement your feature or fix
3. **Run tests**: `bun test` to ensure everything works
4. **Build**: `bun build` to check for TypeScript errors
5. **Commit**: Use conventional commit messages
6. **Push**: `git push origin feature/your-feature-name`
7. **Create PR**: Open a pull request on GitHub

## Project Structure

```
src/
├── index.ts                 # Main entry point and exports
├── cli.ts                   # CLI interface using Commander.js
├── types.ts                 # Shared TypeScript interfaces
├── commands/                # Command implementations
│   ├── base.ts             # Base command class
│   ├── unused.ts           # Unused dependencies command
│   ├── size.ts             # Size analysis command
│   ├── duplicates.ts       # Duplicate detection command
│   ├── tree.ts             # Dependency tree command
│   ├── devcheck.ts         # Dev dependency validation
│   ├── config.ts           # Configuration management
│   ├── examples.ts         # Examples command
│   └── index.ts            # Command exports
├── parsers/                 # Lock file parsers
│   ├── bun/                # Bun lock file parser
│   ├── npm/                # npm lock file parser
│   ├── pnpm/               # pnpm lock file parser
│   ├── yarn/               # yarn lock file parser
│   └── index.ts            # Parser exports
├── config/                  # Configuration system
│   ├── loader.ts           # Configuration loading
│   ├── types.ts            # Configuration types
│   └── index.ts            # Configuration exports
├── scanner.ts               # Dependency scanning
├── analyzer.ts              # Node_modules analysis
├── sizeAnalyzer.ts          # Package size analysis
├── duplicateDetector.ts     # Duplicate detection
├── lockFileParser.ts        # Lock file parsing
├── dependencyTreeBuilder.ts # Dependency tree building
├── devDependencyDetector.ts # Dev dependency detection
└── special/                 # Special file handlers
    ├── vitest.ts           # Vitest special handler
    └── index.ts            # Special exports
```

## Contributing Guidelines

### Types of Contributions

We welcome various types of contributions:

- **Bug fixes**: Fix issues and improve reliability
- **New features**: Add new functionality and commands
- **Documentation**: Improve docs, examples, and guides
- **Tests**: Add or improve test coverage
- **Performance**: Optimize existing functionality
- **Refactoring**: Improve code quality and structure

### Code Style

- **TypeScript**: Use TypeScript with strict settings
- **ESM**: Use ES modules with `.js` extensions in imports
- **Naming**: Use descriptive names for functions and variables
- **Comments**: Add JSDoc comments for public APIs
- **Formatting**: Use consistent formatting (handled by build tools)

### Commit Messages

Use conventional commit messages:

```
type(scope): description

[optional body]

[optional footer]
```

Types:
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes
- `refactor`: Code refactoring
- `test`: Test changes
- `chore`: Build process or auxiliary tool changes

Examples:
```
feat(unused): add recursive scanning for monorepos
fix(duplicates): resolve lock file parsing issues
docs(readme): update installation instructions
test(scanner): add tests for edge cases
```

### Pull Request Process

1. **Create issue**: Discuss significant changes in an issue first
2. **Fork and branch**: Create a feature branch from main
3. **Implement**: Make your changes with tests
4. **Test**: Ensure all tests pass
5. **Document**: Update documentation if needed
6. **Submit PR**: Create a pull request with a clear description

### PR Requirements

- **Tests**: Include tests for new functionality
- **Documentation**: Update docs for new features
- **TypeScript**: Ensure no TypeScript errors
- **Linting**: Ensure code passes linting
- **Description**: Provide clear PR description

## Testing

### Test Structure

Tests are organized in the same structure as source code:

```
src/
├── scanner.test.ts          # Scanner tests
├── analyzer.test.ts         # Analyzer tests
└── commands/
    └── unused.test.ts       # Command tests
```

### Running Tests

```bash
# Run all tests
bun test

# Run tests in watch mode
bun test:watch

# Run tests with coverage
bun test:coverage

# Run tests with UI
bun test:ui
```

### Writing Tests

Use Vitest for testing:

```typescript
import { describe, it, expect } from 'vitest';
import { DependencyScanner } from '../scanner.js';

describe('DependencyScanner', () => {
  it('should scan for unused dependencies', async () => {
    const scanner = new DependencyScanner();
    const results = await scanner.scan('./test-project');
    
    expect(results).toBeDefined();
    expect(Array.isArray(results)).toBe(true);
  });
});
```

### Test Utilities

Use test utilities from `test/testUtils.ts`:

```typescript
import { createTestProject, cleanupTestProject } from '../test/testUtils.js';

describe('Scanner', () => {
  let testProject: string;
  
  beforeEach(() => {
    testProject = createTestProject();
  });
  
  afterEach(() => {
    cleanupTestProject(testProject);
  });
});
```

## Documentation

### Documentation Structure

- **README.md**: Main project documentation
- **API.md**: API documentation
- **CONTRIBUTING.md**: This file
- **CHANGELOG.md**: Version history
- **docs/**: Command-specific documentation
- **examples/**: Usage examples

### Writing Documentation

- **Clear and concise**: Write clear, easy-to-understand documentation
- **Examples**: Include practical examples
- **Up-to-date**: Keep documentation current with code changes
- **Consistent**: Use consistent formatting and style

### Command Documentation

Each command should have documentation in `docs/`:

- **Usage**: Command syntax and options
- **Examples**: Common usage patterns
- **Output**: Expected output format
- **Configuration**: Configuration options
- **Tips**: Best practices and tips

## Release Process

### Version Management

We use [Changesets](https://github.com/changesets/changesets) for version management:

```bash
# Create a changeset
bun changeset

# Apply changesets and bump versions
bun version

# Publish to NPM
bun release
```

### Release Checklist

- [ ] All tests pass
- [ ] Documentation is updated
- [ ] CHANGELOG.md is updated
- [ ] Version is bumped
- [ ] Release notes are prepared
- [ ] NPM package is published

## Community Guidelines

### Getting Help

- **Issues**: Use GitHub issues for bug reports and feature requests
- **Discussions**: Use GitHub discussions for questions and ideas
- **Documentation**: Check existing documentation first

### Reporting Issues

When reporting issues, include:

- **Version**: Version of the tool
- **Environment**: OS, Node.js version, package manager
- **Steps**: Steps to reproduce the issue
- **Expected**: Expected behavior
- **Actual**: Actual behavior
- **Logs**: Relevant error messages or logs

### Feature Requests

When requesting features:

- **Use case**: Describe the use case
- **Motivation**: Explain why this feature is needed
- **Alternatives**: Describe any alternatives considered
- **Implementation**: Suggest implementation approach if possible

### Code Review

When reviewing code:

- **Be constructive**: Provide helpful feedback
- **Be respectful**: Maintain a positive tone
- **Be thorough**: Check for bugs, performance, and style
- **Be timely**: Respond to PRs in a reasonable time

## Development Tips

### Local Development

```bash
# Link the package globally for testing
bun link

# Test CLI commands
depoptimize unused --help

# Unlink when done
bun unlink
```

### Debugging

```bash
# Enable debug logging
DEBUG=depoptimize:* depoptimize unused

# Run with verbose output
depoptimize unused --verbose
```

### Performance Testing

```bash
# Test with large projects
depoptimize unused --recursive

# Profile performance
bun test --coverage
```

## License

By contributing to this project, you agree that your contributions will be licensed under the MIT License.

## Contact

- **GitHub Issues**: [Create an issue](https://github.com/azwebmaster/dependency-optimizer/issues)
- **GitHub Discussions**: [Join discussions](https://github.com/azwebmaster/dependency-optimizer/discussions)
- **Maintainer**: [@azwebmaster](https://github.com/azwebmaster)

Thank you for contributing to Dependency Optimizer! 🚀
