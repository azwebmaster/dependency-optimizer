# Config Command

The `config` command manages configuration for the dependency optimizer tool.

## Usage

```bash
depoptimize config [options]
```

## Options

| Option | Description | Default |
|--------|-------------|---------|
| `--show` | Show current configuration | `false` |
| `--validate` | Validate configuration file | `false` |
| `--init` | Initialize configuration file | `false` |
| `--reset` | Reset to default configuration | `false` |

## Examples

### Show Current Configuration

```bash
# Display current configuration
depoptimize config --show
```

### Validate Configuration

```bash
# Validate configuration file
depoptimize config --validate
```

### Initialize Configuration

```bash
# Create initial configuration file
depoptimize config --init
```

### Reset Configuration

```bash
# Reset to default configuration
depoptimize config --reset
```

## Output Format

### Show Configuration

```
📋 Current Configuration

Configuration sources (in order of precedence):
1. Command line options
2. .depoptimizer.json
3. package.json (depoptimizer field)
4. Default values

Current settings:
  verbose: false
  parallel: true
  defaults:
    sizeThreshold: 10
    depthThreshold: 5
    maxDepth: 5
    fix: false
  analyses:
    unused:
      enabled: true
      recursive: false
      includeDevDependencies: false
    size:
      enabled: true
      showDependencies: false
      maxDepth: 5
      summary: true
    duplicates:
      enabled: true
      checkVersions: true
      showPaths: false
      useLockFile: false
    tree:
      enabled: true
      maxDepth: 5
    devcheck:
      enabled: true
      fix: false
```

### Validate Configuration

```
✅ Configuration is valid

Configuration file: .depoptimizer.json
Schema validation: PASSED
Required fields: PRESENT
Optional fields: VALID
```

### Initialize Configuration

```
📝 Initializing configuration...

Created .depoptimizer.json with default settings.
You can now customize the configuration for your project.
```

## Configuration Sources

Configuration is loaded in the following order (later sources override earlier ones):

1. **Command line options** (highest priority)
2. **Configuration file** (`.depoptimizer.json`, `depoptimizer.json`, etc.)
3. **package.json** (`depoptimizer` field)
4. **Default values** (lowest priority)

## Configuration File

### File Locations

The tool looks for configuration files in this order:

1. `.depoptimizer.json` (project root)
2. `depoptimizer.json` (project root)
3. `.depoptimizer.yaml` (project root)
4. `depoptimizer.yaml` (project root)
5. `.depoptimizer.yml` (project root)
6. `depoptimizer.yml` (project root)

### JSON Format

```json
{
  "verbose": true,
  "parallel": true,
  "defaults": {
    "sizeThreshold": 5,
    "depthThreshold": 3,
    "maxDepth": 4,
    "fix": false
  },
  "analyses": {
    "unused": {
      "enabled": true,
      "recursive": true,
      "includeDevDependencies": true
    },
    "size": {
      "enabled": true,
      "showDependencies": true,
      "maxDepth": 3,
      "summary": true
    },
    "duplicates": {
      "enabled": true,
      "checkVersions": true,
      "showPaths": true,
      "useLockFile": true
    },
    "tree": {
      "enabled": false,
      "maxDepth": 5
    },
    "devcheck": {
      "enabled": true,
      "fix": false
    }
  }
}
```

### YAML Format

```yaml
verbose: true
parallel: true
defaults:
  sizeThreshold: 5
  depthThreshold: 3
  maxDepth: 4
  fix: false
analyses:
  unused:
    enabled: true
    recursive: true
    includeDevDependencies: true
  size:
    enabled: true
    showDependencies: true
    maxDepth: 3
    summary: true
  duplicates:
    enabled: true
    checkVersions: true
    showPaths: true
    useLockFile: true
  tree:
    enabled: false
    maxDepth: 5
  devcheck:
    enabled: true
    fix: false
```

## Package.json Configuration

Add configuration to your `package.json`:

```json
{
  "name": "my-project",
  "version": "1.0.0",
  "depoptimizer": {
    "verbose": false,
    "defaults": {
      "sizeThreshold": 8,
      "depthThreshold": 4
    },
    "analyses": {
      "unused": {
        "enabled": true,
        "recursive": true
      },
      "size": {
        "enabled": true,
        "summary": true
      },
      "duplicates": {
        "enabled": true,
        "checkVersions": true
      },
      "tree": {
        "enabled": false
      },
      "devcheck": {
        "enabled": true
      }
    }
  }
}
```

## Configuration Schema

### Global Settings

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `verbose` | boolean | `false` | Enable verbose output |
| `parallel` | boolean | `true` | Enable parallel processing |

### Defaults

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `sizeThreshold` | number | `10` | Size threshold in MB for flagging large packages |
| `depthThreshold` | number | `5` | Depth threshold for flagging deep dependency trees |
| `maxDepth` | number | `5` | Maximum depth for analysis |
| `fix` | boolean | `false` | Enable auto-fix by default |

### Analysis Settings

#### Unused Analysis

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `enabled` | boolean | `true` | Enable unused dependency analysis |
| `recursive` | boolean | `false` | Scan workspace packages recursively |
| `includeDevDependencies` | boolean | `false` | Include dev dependencies in scan |

#### Size Analysis

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `enabled` | boolean | `true` | Enable size analysis |
| `showDependencies` | boolean | `false` | Show dependency breakdown |
| `maxDepth` | number | `5` | Maximum depth for size analysis |
| `summary` | boolean | `true` | Show summary information |

#### Duplicates Analysis

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `enabled` | boolean | `true` | Enable duplicate detection |
| `checkVersions` | boolean | `true` | Check for version differences |
| `showPaths` | boolean | `false` | Show dependency paths to duplicates |
| `useLockFile` | boolean | `false` | Use lock file for analysis |

#### Tree Analysis

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `enabled` | boolean | `true` | Enable tree visualization |
| `maxDepth` | number | `5` | Maximum tree depth to display |

#### DevCheck Analysis

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `enabled` | boolean | `true` | Enable dev dependency checking |
| `fix` | boolean | `false` | Enable auto-fix for misplaced dependencies |

## Environment Variables

You can also configure the tool using environment variables:

```bash
# Enable verbose output
export DEPOPTIMIZER_VERBOSE=true

# Set size threshold
export DEPOPTIMIZER_SIZE_THRESHOLD=5

# Enable parallel processing
export DEPOPTIMIZER_PARALLEL=true
```

## Tips

### Configuration Best Practices

1. **Use configuration files**: Store project-specific settings in files
2. **Version control**: Commit configuration files to version control
3. **Team consistency**: Use shared configuration across team members
4. **Documentation**: Document any custom configuration choices

### Configuration Validation

1. **Validate regularly**: Use `--validate` to check configuration
2. **Test changes**: Test configuration changes before committing
3. **Review defaults**: Understand what the default values do
4. **Check precedence**: Understand how different sources override each other

### Troubleshooting Configuration

1. **Check precedence**: Ensure you're not overriding settings unintentionally
2. **Validate syntax**: Ensure JSON/YAML syntax is correct
3. **Review paths**: Ensure configuration files are in the right location
4. **Check permissions**: Ensure read access to configuration files

## Troubleshooting

### Configuration Not Loading

If configuration isn't loading:

1. **Check file location**: Ensure configuration file is in project root
2. **Verify syntax**: Ensure JSON/YAML syntax is correct
3. **Check permissions**: Ensure read access to configuration file
4. **Review format**: Ensure file format is supported

### Configuration Override Issues

If settings aren't being applied:

1. **Check precedence**: Understand configuration source precedence
2. **Review command line**: Check if command line options are overriding
3. **Validate format**: Ensure configuration format is correct
4. **Check scope**: Ensure configuration is in the right scope

### Validation Errors

If validation fails:

1. **Check schema**: Ensure configuration matches expected schema
2. **Review required fields**: Ensure all required fields are present
3. **Validate types**: Ensure field types are correct
4. **Check values**: Ensure field values are valid
