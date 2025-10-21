# Size Command

The `size` command analyzes package sizes and identifies optimization opportunities in your node_modules.

## Usage

```bash
depoptimize size [options]
```

## Options

| Option | Description | Default |
|--------|-------------|---------|
| `--package <name>` | Analyze specific package | All packages |
| `--threshold <mb>` | Size threshold in MB for flagging large packages | `10` |
| `--show-dependencies` | Show dependency breakdown | `false` |
| `--max-depth <n>` | Maximum dependency depth to analyze | `5` |
| `--json` | Output results in JSON format | `false` |

## Examples

### Analyze All Packages

```bash
# Analyze all packages in node_modules
depoptimize size
```

### Analyze Specific Package

```bash
# Analyze a specific package
depoptimize size --package lodash

# Analyze React and its dependencies
depoptimize size --package react --show-dependencies
```

### Custom Size Threshold

```bash
# Flag packages larger than 5MB
depoptimize size --threshold 5
```

### Show Dependency Breakdown

```bash
# Show detailed dependency information
depoptimize size --show-dependencies --max-depth 3
```

### JSON Output

```bash
# Get results in JSON format
depoptimize size --json
```

## Output Format

### Standard Output

```
📊 Package Size Analysis

📦 Large packages (>10MB):
  - @angular/core: 15.2MB
  - react-dom: 12.8MB

📦 Deep dependency trees (>5 levels):
  - webpack: 8 levels
  - babel-core: 7 levels

Total packages: 1,247
Total size: 245.6MB
```

### With Dependencies

```
📊 Package Size Analysis - lodash

📦 lodash: 2.1MB
  ├── lodash.debounce: 0.1MB
  ├── lodash.throttle: 0.1MB
  └── lodash.merge: 0.2MB

Total size: 2.1MB
Dependencies: 3
```

### JSON Output

```json
{
  "name": "lodash",
  "size": 2200000,
  "dependencies": [
    {
      "name": "lodash.debounce",
      "size": 100000,
      "dependencies": []
    }
  ],
  "totalSize": 2200000
}
```

## How It Works

The size command analyzes your node_modules directory to:

1. **Calculate package sizes**: Measures the actual disk space used by each package
2. **Identify large packages**: Flags packages exceeding the size threshold
3. **Analyze dependency depth**: Finds packages with excessive transitive dependencies
4. **Provide optimization insights**: Suggests packages that might be candidates for optimization

## Size Calculation

Package sizes are calculated by:

- **Directory size**: Total size of the package directory in node_modules
- **Including dependencies**: Size includes all transitive dependencies
- **Excluding duplicates**: Shared dependencies are counted only once
- **Real disk usage**: Based on actual file system measurements

## Optimization Opportunities

The command helps identify:

### Large Packages
- Packages that significantly impact bundle size
- Candidates for alternative implementations
- Opportunities for code splitting

### Deep Dependencies
- Packages with many transitive dependencies
- Potential security and maintenance risks
- Opportunities for dependency consolidation

### Bundle Impact
- Understanding which packages contribute most to bundle size
- Identifying opportunities for tree shaking
- Planning for code splitting strategies

## Configuration

You can configure the size command in your `.depoptimizer.json`:

```json
{
  "analyses": {
    "size": {
      "enabled": true,
      "showDependencies": true,
      "maxDepth": 3,
      "summary": true
    }
  },
  "defaults": {
    "sizeThreshold": 5
  }
}
```

## Tips

### Reducing Bundle Size

1. **Replace large packages**: Look for smaller alternatives
2. **Use tree shaking**: Ensure your bundler can eliminate unused code
3. **Code splitting**: Split large packages into smaller chunks
4. **Lazy loading**: Load packages only when needed

### Analyzing Results

1. **Focus on large packages**: Start with packages over your threshold
2. **Check dependency depth**: Deep trees can indicate maintenance issues
3. **Consider alternatives**: Look for lighter-weight alternatives
4. **Review usage**: Ensure large packages are actually needed

### Common Large Packages

Some packages are commonly large:

- **@angular/core**: Full Angular framework
- **react-dom**: React DOM implementation
- **webpack**: Module bundler
- **lodash**: Utility library (consider lodash-es for tree shaking)
- **moment**: Date library (consider date-fns or dayjs)

## Troubleshooting

### Inaccurate Sizes

If sizes seem incorrect:

1. **Check node_modules**: Ensure packages are properly installed
2. **Verify permissions**: Ensure read access to node_modules
3. **Check for symlinks**: Symlinked packages may show different sizes
4. **Clear cache**: Try deleting node_modules and reinstalling

### Missing Packages

If packages don't appear:

1. **Check installation**: Ensure packages are properly installed
2. **Verify names**: Check for typos in package names
3. **Check scope**: Ensure scoped packages are referenced correctly
4. **Review dependencies**: Some packages may be peer dependencies
