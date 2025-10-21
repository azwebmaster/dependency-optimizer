# Tree Command

The `tree` command builds and displays dependency tree structures for your project.

## Usage

```bash
depoptimize tree [options]
```

## Options

| Option | Description | Default |
|--------|-------------|---------|
| `--package <name>` | Show tree for specific package | All packages |
| `--max-depth <n>` | Maximum tree depth to display | `5` |
| `--json` | Output results in JSON format | `false` |

## Examples

### Show Full Dependency Tree

```bash
# Show dependency tree for all packages
depoptimize tree
```

### Show Specific Package Tree

```bash
# Show tree for a specific package
depoptimize tree --package react
```

### Limit Tree Depth

```bash
# Show tree with limited depth
depoptimize tree --max-depth 3
```

### JSON Output

```bash
# Get tree structure in JSON format
depoptimize tree --json
```

## Output Format

### Standard Output

```
🌳 Dependency Tree

📦 my-project
├── react@18.2.0
│   ├── loose-envify@1.4.0
│   └── js-tokens@4.0.0
├── lodash@4.17.21
└── typescript@4.9.5
    ├── @types/node@18.15.0
    └── @types/react@18.0.28

Total packages: 1,247
Tree depth: 8 levels
```

### With Package Filter

```
🌳 Dependency Tree - react

📦 react@18.2.0
├── loose-envify@1.4.0
│   └── js-tokens@4.0.0
└── js-tokens@4.0.0

Dependencies: 2
Transitive dependencies: 1
```

### JSON Output

```json
{
  "root": {
    "name": "my-project",
    "version": "1.0.0",
    "children": [
      {
        "name": "react",
        "version": "18.2.0",
        "depth": 1,
        "children": [
          {
            "name": "loose-envify",
            "version": "1.4.0",
            "depth": 2,
            "children": []
          }
        ]
      }
    ]
  },
  "allNodes": {
    "react@18.2.0": [
      {
        "name": "react",
        "version": "18.2.0",
        "path": ["my-project"],
        "isDirect": true
      }
    ]
  }
}
```

## How It Works

The tree command analyzes your project to:

1. **Parse lock files**: Reads package-lock.json, yarn.lock, pnpm-lock.yaml, or bun.lock
2. **Build dependency tree**: Creates a hierarchical structure of all dependencies
3. **Track relationships**: Shows how packages depend on each other
4. **Calculate metrics**: Provides statistics about the dependency tree
5. **Display structure**: Shows the tree in a readable format

## Tree Structure

### Root Level
- **Project dependencies**: Direct dependencies from package.json
- **Workspace packages**: Other packages in the workspace (if applicable)

### Dependency Levels
- **Direct dependencies**: Packages directly required by your project
- **Transitive dependencies**: Dependencies of your dependencies
- **Nested dependencies**: Dependencies of transitive dependencies

### Tree Metrics
- **Total packages**: Number of unique packages in the tree
- **Tree depth**: Maximum depth of the dependency tree
- **Direct dependencies**: Number of direct dependencies
- **Transitive dependencies**: Number of indirect dependencies

## Understanding the Tree

### Tree Symbols
- `├──` - Branch with more items below
- `└──` - Last item in a branch
- `│` - Vertical line for alignment

### Package Information
- **Name**: Package name
- **Version**: Package version
- **Depth**: How deep in the tree (1 = direct dependency)

### Path Information
- **Direct path**: Shows how to reach each package
- **Dependency chain**: Shows the full dependency chain

## Use Cases

### Understanding Dependencies
- **See what's included**: Understand what packages are actually installed
- **Find large dependencies**: Identify packages that bring in many dependencies
- **Track versions**: See which versions of packages are being used

### Debugging Issues
- **Version conflicts**: Identify where version conflicts occur
- **Duplicate packages**: Find packages that appear multiple times
- **Unexpected dependencies**: Discover why certain packages are installed

### Optimization
- **Bundle analysis**: Understand what contributes to bundle size
- **Dependency reduction**: Identify opportunities to reduce dependencies
- **Version consolidation**: Find opportunities to use consistent versions

## Configuration

You can configure the tree command in your `.depoptimizer.json`:

```json
{
  "analyses": {
    "tree": {
      "enabled": true,
      "maxDepth": 5
    }
  }
}
```

## Tips

### Reading the Tree

1. **Start at the root**: Look at direct dependencies first
2. **Follow branches**: Trace how dependencies are connected
3. **Check depth**: Pay attention to how deep dependencies go
4. **Look for patterns**: Identify common dependency patterns

### Analyzing Results

1. **Large trees**: Packages with many dependencies
2. **Deep trees**: Packages with many levels of dependencies
3. **Duplicate patterns**: Similar packages appearing multiple times
4. **Version inconsistencies**: Different versions of the same package

### Optimization Opportunities

1. **Reduce dependencies**: Look for packages that bring in many dependencies
2. **Consolidate versions**: Use consistent versions across the tree
3. **Remove unused**: Identify packages that might not be needed
4. **Use alternatives**: Consider lighter-weight alternatives

## Troubleshooting

### Empty Tree

If the tree appears empty:

1. **Check lock file**: Ensure a lock file exists
2. **Verify installation**: Ensure node_modules is properly installed
3. **Check permissions**: Ensure read access to lock file
4. **Review package.json**: Ensure dependencies are properly declared

### Incomplete Tree

If the tree seems incomplete:

1. **Increase depth**: Try increasing `--max-depth`
2. **Check lock file**: Ensure lock file is complete
3. **Verify installation**: Ensure all dependencies are installed
4. **Review errors**: Check for specific error messages

### Performance Issues

If the command is slow:

1. **Limit depth**: Use `--max-depth` to limit analysis
2. **Filter packages**: Use `--package` to focus on specific packages
3. **Check lock file**: Ensure lock file is not corrupted
4. **Review dependencies**: Large dependency trees take longer to analyze

### Lock File Issues

If lock file parsing fails:

1. **Check format**: Ensure lock file is valid
2. **Verify package manager**: Ensure using correct package manager
3. **Update lock file**: Try regenerating the lock file
4. **Check version**: Ensure lock file version is supported
