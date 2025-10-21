# Examples Command

The `examples` command displays usage examples and common patterns for the dependency optimizer tool.

## Usage

```bash
depoptimize examples [options]
```

## Options

| Option | Description | Default |
|--------|-------------|---------|
| `--command <name>` | Show examples for specific command | All commands |
| `--format <format>` | Output format (text, json) | `text` |

## Examples

### Show All Examples

```bash
# Display all usage examples
depoptimize examples
```

### Show Specific Command Examples

```bash
# Show examples for unused command
depoptimize examples --command unused

# Show examples for size command
depoptimize examples --command size
```

### JSON Output

```bash
# Get examples in JSON format
depoptimize examples --format json
```

## Output Format

### Standard Output

```
📚 Dependency Optimizer Examples

🔍 UNUSED COMMAND
Find unused dependencies in your project.

Basic usage:
  depoptimize unused

Auto-fix unused dependencies:
  depoptimize unused --fix

Scan monorepo recursively:
  depoptimize unused --recursive

Include dev dependencies:
  depoptimize unused --include-dev

Target specific workspace:
  depoptimize unused --workspace "packages/*"

📊 SIZE COMMAND
Analyze package sizes and identify optimization opportunities.

Basic usage:
  depoptimize size

Analyze specific package:
  depoptimize size --package lodash

Set custom size threshold:
  depoptimize size --threshold 5

Show dependency breakdown:
  depoptimize size --show-dependencies

🔍 DUPLICATES COMMAND
Detect duplicate packages and versions.

Basic usage:
  depoptimize duplicates

Check specific package:
  depoptimize duplicates --package lodash

Show dependency paths:
  depoptimize duplicates --show-paths

Use lock file for analysis:
  depoptimize duplicates --use-lock-file

🌳 TREE COMMAND
Build and display dependency tree structures.

Basic usage:
  depoptimize tree

Show specific package tree:
  depoptimize tree --package react

Limit tree depth:
  depoptimize tree --max-depth 3

🔧 DEVCHECK COMMAND
Validate dev dependency placement.

Basic usage:
  depoptimize devcheck

Auto-fix misplaced dependencies:
  depoptimize devcheck --fix

Include additional packages:
  depoptimize devcheck --include "eslint,jest"

Exclude specific packages:
  depoptimize devcheck --exclude "typescript"

⚙️ CONFIG COMMAND
Manage configuration settings.

Show current configuration:
  depoptimize config --show

Validate configuration:
  depoptimize config --validate

Initialize configuration:
  depoptimize config --init

Reset to defaults:
  depoptimize config --reset
```

### With Command Filter

```
📚 Examples for: unused

🔍 UNUSED COMMAND
Find unused dependencies in your project.

Basic usage:
  depoptimize unused

Auto-fix unused dependencies:
  depoptimize unused --fix

Scan monorepo recursively:
  depoptimize unused --recursive

Include dev dependencies:
  depoptimize unused --include-dev

Target specific workspace:
  depoptimize unused --workspace "packages/*"

Verbose output:
  depoptimize unused --verbose

JSON output:
  depoptimize unused --json

Common patterns:
  # Scan and fix in one command
  depoptimize unused --fix --recursive

  # Scan with detailed output
  depoptimize unused --verbose --include-dev

  # Target specific workspace
  depoptimize unused --workspace "apps/*" --fix
```

### JSON Output

```json
{
  "commands": {
    "unused": {
      "description": "Find unused dependencies in your project",
      "examples": [
        {
          "description": "Basic usage",
          "command": "depoptimize unused"
        },
        {
          "description": "Auto-fix unused dependencies",
          "command": "depoptimize unused --fix"
        }
      ]
    }
  }
}
```

## Common Use Cases

### Daily Development

```bash
# Quick check for unused dependencies
depoptimize unused

# Check package sizes
depoptimize size

# Verify dev dependencies
depoptimize devcheck
```

### Pre-commit Checks

```bash
# Check for unused dependencies before committing
depoptimize unused --json > unused-check.json

# Validate dev dependency placement
depoptimize devcheck --json > devcheck-results.json
```

### CI/CD Integration

```bash
# Run all checks in CI
depoptimize unused --json
depoptimize size --json
depoptimize duplicates --json
depoptimize devcheck --json
```

### Monorepo Management

```bash
# Scan entire monorepo
depoptimize unused --recursive

# Target specific workspace
depoptimize unused --workspace "packages/*"

# Analyze workspace sizes
depoptimize size --recursive
```

### Bundle Optimization

```bash
# Find large packages
depoptimize size --threshold 5

# Analyze specific package
depoptimize size --package lodash --show-dependencies

# Check for duplicates
depoptimize duplicates --show-paths
```

## Configuration Examples

### Basic Configuration

```json
{
  "verbose": true,
  "defaults": {
    "sizeThreshold": 5,
    "depthThreshold": 3
  }
}
```

### Monorepo Configuration

```json
{
  "verbose": true,
  "defaults": {
    "recursive": true,
    "includeDevDependencies": true
  },
  "analyses": {
    "unused": {
      "enabled": true,
      "recursive": true
    },
    "size": {
      "enabled": true,
      "summary": true
    }
  }
}
```

### CI/CD Configuration

```json
{
  "verbose": false,
  "defaults": {
    "fix": false
  },
  "analyses": {
    "unused": {
      "enabled": true,
      "recursive": true
    },
    "duplicates": {
      "enabled": true,
      "useLockFile": true
    },
    "devcheck": {
      "enabled": true,
      "fix": false
    }
  }
}
```

## Programmatic Usage Examples

### Basic Scanning

```typescript
import { scanDependencies } from '@azwebmaster/dependency-optimizer';

const results = await scanDependencies('./my-project', {
  recursive: true,
  includeDevDependencies: true
});

console.log(`Found ${results.length} packages with unused dependencies`);
```

### Size Analysis

```typescript
import { analyzePackageSizes } from '@azwebmaster/dependency-optimizer';

const sizeInfo = await analyzePackageSizes('./my-project', 'lodash', {
  maxDepth: 3,
  showDependencies: true
});

console.log(`Package size: ${sizeInfo.size} bytes`);
```

### Duplicate Detection

```typescript
import { detectDuplicates } from '@azwebmaster/dependency-optimizer';

const { result, dependencyTree } = await detectDuplicates('./my-project', {
  showPaths: true,
  useLockFile: true
});

console.log(`Found ${result.duplicatePackages} packages with duplicates`);
```

### Dev Dependency Checking

```typescript
import { checkDevDependencies } from '@azwebmaster/dependency-optimizer';

const result = await checkDevDependencies('./my-project', {
  fix: false,
  include: ['eslint', 'jest'],
  exclude: ['typescript']
});

console.log(`Found ${result.misplacedDependencies.length} misplaced dependencies`);
```

## Tips

### Getting Started

1. **Start simple**: Begin with basic commands to understand the tool
2. **Use examples**: Reference the examples command for common patterns
3. **Read output**: Pay attention to the output format and information
4. **Test safely**: Use commands without `--fix` first to see what would happen

### Advanced Usage

1. **Combine commands**: Use multiple commands together for comprehensive analysis
2. **Use configuration**: Set up configuration files for consistent behavior
3. **Automate**: Integrate into CI/CD pipelines for automated checks
4. **Customize**: Use command options to tailor analysis to your needs

### Troubleshooting

1. **Check examples**: Use the examples command to see correct usage
2. **Validate configuration**: Use `config --validate` to check settings
3. **Review output**: Pay attention to error messages and warnings
4. **Test incrementally**: Start with simple commands and add complexity gradually
