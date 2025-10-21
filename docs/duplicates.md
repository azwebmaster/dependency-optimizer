# Duplicates Command

The `duplicates` command detects packages with multiple versions or instances in your dependency tree.

## Usage

```bash
depoptimize duplicates [options]
```

## Options

| Option | Description | Default |
|--------|-------------|---------|
| `--package <name>` | Check specific package | All packages |
| `--show-paths` | Show dependency paths to duplicates | `false` |
| `--use-lock-file` | Use lock file for more accurate analysis | `false` |
| `--json` | Output results in JSON format | `false` |

## Examples

### Find All Duplicates

```bash
# Find all duplicate packages
depoptimize duplicates
```

### Check Specific Package

```bash
# Check for duplicates of a specific package
depoptimize duplicates --package lodash
```

### Show Dependency Paths

```bash
# Show paths to duplicate packages
depoptimize duplicates --show-paths
```

### Use Lock File

```bash
# Use lock file for more accurate analysis
depoptimize duplicates --use-lock-file
```

### JSON Output

```bash
# Get results in JSON format
depoptimize duplicates --json
```

## Output Format

### Standard Output

```
🔍 Scanning for duplicate packages...

📦 Duplicate packages found:

lodash
  Versions: 4.17.21, 4.17.20
  Instances: 3
  Paths:
    - my-package@1.0.0 → lodash@4.17.21
    - my-package@1.0.0 → some-dep@2.1.0 → lodash@4.17.20
    - my-package@1.0.0 → other-dep@1.5.0 → lodash@4.17.21

Summary:
  Total packages: 1,247
  Duplicate packages: 15
  Total duplicate instances: 42
```

### With Paths

```
📦 lodash duplicates:

Version 4.17.21 (2 instances):
  ├── my-package@1.0.0 → lodash@4.17.21
  └── my-package@1.0.0 → some-dep@2.1.0 → lodash@4.17.21

Version 4.17.20 (1 instance):
  └── my-package@1.0.0 → other-dep@1.5.0 → lodash@4.17.20
```

### JSON Output

```json
{
  "totalPackages": 1247,
  "duplicatePackages": 15,
  "totalDuplicateInstances": 42,
  "duplicates": [
    {
      "name": "lodash",
      "versions": ["4.17.21", "4.17.20"],
      "instances": [
        {
          "name": "lodash",
          "version": "4.17.21",
          "path": ["my-package"],
          "isDirect": true
        }
      ]
    }
  ]
}
```

## How It Works

The duplicates command analyzes your dependency tree to:

1. **Parse lock files**: Reads package-lock.json, yarn.lock, pnpm-lock.yaml, or bun.lock
2. **Build dependency tree**: Creates a complete tree of all dependencies
3. **Identify duplicates**: Finds packages with multiple versions or instances
4. **Track paths**: Shows how each duplicate is reached in the dependency tree
5. **Report results**: Provides detailed information about duplicates found

## Types of Duplicates

### Version Duplicates
Different versions of the same package:
```
lodash@4.17.21
lodash@4.17.20
```

### Instance Duplicates
Multiple instances of the same version:
```
lodash@4.17.21 (instance 1)
lodash@4.17.21 (instance 2)
```

## Why Duplicates Matter

### Bundle Size Impact
- **Increased bundle size**: Multiple versions increase total bundle size
- **Dead code**: Unused versions may still be included
- **Tree shaking issues**: Bundlers may not optimize effectively

### Security Concerns
- **Vulnerability exposure**: Older versions may have security issues
- **Maintenance burden**: Multiple versions to keep updated
- **Inconsistent behavior**: Different versions may behave differently

### Performance Issues
- **Memory usage**: Multiple instances consume more memory
- **Load time**: Larger bundles take longer to load
- **Runtime overhead**: Multiple versions may conflict

## Resolving Duplicates

### Using npm

```bash
# Check for duplicates
npm ls --depth=0

# Force resolution in package.json
{
  "overrides": {
    "lodash": "4.17.21"
  }
}
```

### Using yarn

```bash
# Check for duplicates
yarn list --pattern lodash

# Use resolutions in package.json
{
  "resolutions": {
    "lodash": "4.17.21"
  }
}
```

### Using pnpm

```bash
# Check for duplicates
pnpm list --depth=0

# Use pnpm.overrides in package.json
{
  "pnpm": {
    "overrides": {
      "lodash": "4.17.21"
    }
  }
}
```

## Configuration

You can configure the duplicates command in your `.depoptimizer.json`:

```json
{
  "analyses": {
    "duplicates": {
      "enabled": true,
      "checkVersions": true,
      "showPaths": true,
      "useLockFile": true
    }
  }
}
```

## Tips

### Preventing Duplicates

1. **Use exact versions**: Pin dependency versions in package.json
2. **Regular audits**: Run duplicate checks regularly
3. **Use resolutions**: Force specific versions when needed
4. **Update dependencies**: Keep dependencies up to date

### Resolving Duplicates

1. **Identify root cause**: Understand why duplicates exist
2. **Update dependencies**: Use compatible versions
3. **Use resolutions**: Force specific versions when necessary
4. **Test thoroughly**: Ensure resolution doesn't break functionality

### Common Duplicate Sources

- **Peer dependencies**: Different packages requiring different versions
- **Transitive dependencies**: Dependencies of dependencies
- **Version ranges**: Loose version specifications allowing multiple versions
- **Lock file issues**: Inconsistent lock file state

## Troubleshooting

### False Positives

If packages appear duplicated but aren't:

1. **Check lock file**: Ensure lock file is up to date
2. **Verify installation**: Reinstall node_modules
3. **Check scopes**: Ensure scoped packages are handled correctly
4. **Review aliases**: Some packages may be aliased

### Missing Duplicates

If duplicates aren't detected:

1. **Use lock file**: Try `--use-lock-file` option
2. **Check depth**: Ensure analysis goes deep enough
3. **Verify lock file**: Ensure lock file exists and is valid
4. **Check permissions**: Ensure read access to lock file

### Analysis Issues

If analysis fails:

1. **Check lock file format**: Ensure lock file is valid
2. **Verify package manager**: Ensure using correct package manager
3. **Check dependencies**: Ensure all dependencies are installed
4. **Review errors**: Check for specific error messages
