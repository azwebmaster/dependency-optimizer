# Unused Command

The `unused` command scans your project for dependencies that are no longer used in your codebase.

## Usage

```bash
depoptimize unused [options]
```

## Options

| Option | Description | Default |
|--------|-------------|---------|
| `--fix` | Automatically remove unused dependencies from package.json | `false` |
| `--recursive` | Scan all workspace packages | `false` |
| `--workspace <pattern>` | Target specific workspace packages | All packages |
| `--include-dev` | Include dev dependencies in scan | `false` |
| `--verbose` | Enable detailed output | `false` |
| `--json` | Output results in JSON format | `false` |

## Examples

### Basic Scan

```bash
# Scan current directory for unused dependencies
depoptimize unused
```

### Auto-fix

```bash
# Remove unused dependencies automatically
depoptimize unused --fix
```

### Monorepo Scanning

```bash
# Scan all workspace packages
depoptimize unused --recursive

# Target specific workspace
depoptimize unused --workspace "packages/*"
```

### Include Dev Dependencies

```bash
# Include dev dependencies in the scan
depoptimize unused --include-dev
```

### JSON Output

```bash
# Get results in JSON format for automation
depoptimize unused --json
```

## Output Format

### Standard Output

```
🔍 Scanning dependencies...

📦 my-project
  ❌ Unused dependencies:
    - lodash (dependencies)
    - moment (dependencies)
  ✅ Dev dependencies are properly placed

📦 packages/ui
  ❌ Unused dependencies:
    - react-router (dependencies)
  ✅ All dependencies are used

Summary: Found 3 unused dependencies across 2 packages
```

### JSON Output

```json
[
  {
    "packagePath": "./my-project",
    "packageName": "my-project",
    "unusedDependencies": [
      {
        "name": "lodash",
        "type": "dependencies"
      },
      {
        "name": "moment",
        "type": "dependencies"
      }
    ],
    "errors": []
  }
]
```

## How It Works

The unused command uses the [depcheck](https://github.com/depcheck/depcheck) library to analyze your codebase and identify unused dependencies. It:

1. **Parses package.json**: Reads all dependencies, devDependencies, and peerDependencies
2. **Scans source files**: Analyzes your code to find actual imports and requires
3. **Detects specials**: Automatically enables appropriate depcheck specials based on detected project files (ESLint, Babel, Webpack, Jest, etc.)
4. **Compares usage**: Identifies dependencies that are declared but not used
5. **Reports results**: Shows unused dependencies with their location in package.json

## Special File Detection

The command automatically detects and configures special parsers for:

- **ESLint**: `.eslintrc.*`, `eslint.config.*`
- **Babel**: `.babelrc.*`, `babel.config.*`
- **Webpack**: `webpack.config.*`
- **Jest**: `jest.config.*`
- **Next.js**: `next.config.*`
- **Gatsby**: `gatsby-config.*`
- **Rollup**: `rollup.config.*`
- **Binary scripts**: Files in `bin/` directory

## Configuration

You can configure the unused command in your `.depoptimizer.json`:

```json
{
  "analyses": {
    "unused": {
      "enabled": true,
      "recursive": true,
      "includeDevDependencies": true
    }
  }
}
```

## Tips

- **Use `--fix` carefully**: Always review changes before committing
- **Test after fixing**: Run your tests to ensure nothing was broken
- **Check peer dependencies**: Some packages may be required by peer dependencies
- **Review dev dependencies**: Use `--include-dev` to check dev-only packages
- **Use `--recursive` for monorepos**: Ensures all workspace packages are analyzed

## Troubleshooting

### False Positives

If a dependency appears unused but is actually used:

1. Check for dynamic imports: `require(variable)` or `import(variable)`
2. Verify special file detection is working
3. Check for usage in configuration files
4. Look for usage in build scripts or other non-standard locations

### Missing Dependencies

If the command doesn't detect a dependency:

1. Ensure the package is properly installed
2. Check for typos in import statements
3. Verify the package name matches exactly
4. Check if the package is used in a different way than expected
