# DevCheck Command

The `devcheck` command validates that dev-only packages are properly categorized in your package.json.

## Usage

```bash
depoptimize devcheck [options]
```

## Options

| Option | Description | Default |
|--------|-------------|---------|
| `--fix` | Automatically move misplaced dependencies to devDependencies | `false` |
| `--include <packages>` | Additional packages to include in dev dependency check | None |
| `--exclude <packages>` | Packages to exclude from dev dependency check | None |
| `--json` | Output results in JSON format | `false` |

## Examples

### Basic Check

```bash
# Check for misplaced dev dependencies
depoptimize devcheck
```

### Auto-fix

```bash
# Automatically move misplaced dependencies
depoptimize devcheck --fix
```

### Include Additional Packages

```bash
# Include additional packages in the check
depoptimize devcheck --include "eslint,jest,typescript"
```

### Exclude Packages

```bash
# Exclude specific packages from the check
depoptimize devcheck --exclude "typescript"
```

### JSON Output

```bash
# Get results in JSON format
depoptimize devcheck --json
```

## Output Format

### Standard Output

```
🔍 Checking dev dependency placement...

📦 my-project
  ❌ Misplaced dependencies:
    - eslint (should be in devDependencies)
    - jest (should be in devDependencies)
  ✅ Other dependencies are properly placed

Summary: Found 2 misplaced dependencies
```

### With Fixes

```
🔍 Checking dev dependency placement...

📦 my-project
  ❌ Misplaced dependencies:
    - eslint (should be in devDependencies)
    - jest (should be in devDependencies)
  ✅ Fixed dependencies:
    - eslint (moved to devDependencies)
    - jest (moved to devDependencies)

Summary: Fixed 2 misplaced dependencies
```

### JSON Output

```json
{
  "packagePath": "./my-project",
  "packageName": "my-project",
  "misplacedDependencies": [
    {
      "name": "eslint",
      "currentLocation": "dependencies",
      "suggestedLocation": "devDependencies",
      "reason": "Development tool",
      "pattern": "eslint"
    }
  ],
  "errors": []
}
```

## How It Works

The devcheck command analyzes your package.json to:

1. **Identify dev-only packages**: Recognizes packages that should be in devDependencies
2. **Check current placement**: Verifies where each package is currently located
3. **Suggest corrections**: Recommends moving packages to the correct section
4. **Apply fixes**: Optionally moves packages automatically

## Dev-Only Package Detection

The command identifies packages that should be in devDependencies based on:

### Build Tools
- **Bundlers**: webpack, rollup, vite, esbuild
- **Compilers**: typescript, babel, swc
- **Linters**: eslint, prettier, stylelint
- **Formatters**: prettier, biome

### Testing Tools
- **Test runners**: jest, vitest, mocha, jasmine
- **Testing utilities**: @testing-library, enzyme, cypress
- **Coverage tools**: nyc, c8, istanbul

### Development Tools
- **Development servers**: webpack-dev-server, vite
- **File watchers**: nodemon, chokidar
- **Build tools**: gulp, grunt, npm-run-all

### Type Definitions
- **TypeScript types**: @types/* packages
- **Type checkers**: typescript, tsc

## Configuration

You can configure the devcheck command in your `.depoptimizer.json`:

```json
{
  "analyses": {
    "devcheck": {
      "enabled": true,
      "fix": false
    }
  }
}
```

Or in your `package.json`:

```json
{
  "depoptimizer": {
    "devcheck": {
      "exclude": ["typescript"],
      "include": ["eslint", "jest"]
    }
  }
}
```

## Why Dev Dependencies Matter

### Production Builds
- **Smaller bundles**: Dev dependencies aren't included in production builds
- **Faster installs**: Production installs skip dev dependencies
- **Security**: Reduces attack surface in production

### CI/CD Optimization
- **Faster builds**: CI can skip dev dependencies when not needed
- **Cleaner environments**: Production environments stay minimal
- **Better caching**: Separate caching for dev vs production dependencies

### Team Collaboration
- **Clear intent**: Makes it obvious which packages are dev-only
- **Consistent environments**: All developers use the same dev tools
- **Easier maintenance**: Clear separation of concerns

## Common Misplaced Packages

### Build Tools
```json
{
  "dependencies": {
    "webpack": "^5.0.0",        // Should be devDependencies
    "typescript": "^4.0.0",     // Should be devDependencies
    "babel-core": "^7.0.0"      // Should be devDependencies
  }
}
```

### Testing Tools
```json
{
  "dependencies": {
    "jest": "^27.0.0",          // Should be devDependencies
    "cypress": "^10.0.0",       // Should be devDependencies
    "@testing-library/react": "^13.0.0"  // Should be devDependencies
  }
}
```

### Linting Tools
```json
{
  "dependencies": {
    "eslint": "^8.0.0",         // Should be devDependencies
    "prettier": "^2.0.0",       // Should be devDependencies
    "stylelint": "^14.0.0"      // Should be devDependencies
  }
}
```

## Tips

### Using --fix Safely

1. **Review changes**: Always review what will be moved before applying fixes
2. **Test thoroughly**: Run tests after moving dependencies
3. **Check builds**: Ensure production builds still work
4. **Commit separately**: Commit dependency moves separately from other changes

### Manual Resolution

If you prefer to move dependencies manually:

1. **Identify misplaced packages**: Use the command without `--fix`
2. **Move to devDependencies**: Update package.json manually
3. **Reinstall**: Run `npm install` or equivalent
4. **Test**: Ensure everything still works

### Edge Cases

Some packages might be ambiguous:

- **TypeScript**: Usually dev, but might be needed at runtime
- **Babel**: Usually dev, but might be needed for runtime transforms
- **Webpack**: Usually dev, but might be needed for dynamic imports

## Troubleshooting

### False Positives

If a package appears misplaced but isn't:

1. **Check usage**: Verify the package is used in production code
2. **Review build process**: Ensure the package is needed at runtime
3. **Use exclude**: Add the package to the exclude list
4. **Check documentation**: Review the package's documentation

### Missing Packages

If a package should be checked but isn't:

1. **Use include**: Add the package to the include list
2. **Check patterns**: Ensure the package matches detection patterns
3. **Review configuration**: Check your configuration settings
4. **Update patterns**: The package might need a new detection pattern

### Fix Issues

If fixes don't work:

1. **Check permissions**: Ensure write access to package.json
2. **Verify format**: Ensure package.json is valid JSON
3. **Check locks**: Ensure lock files are up to date
4. **Review errors**: Check for specific error messages
