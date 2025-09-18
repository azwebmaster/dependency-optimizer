#!/usr/bin/env node

import { Command } from 'commander';
import { DependencyScanner } from './scanner.js';
import { NodeModulesAnalyzer } from './analyzer.js';
import type { ScanOptions, AnalyzeOptions } from './types.js';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Read package.json for version info
const packageJsonPath = path.join(__dirname, '..', 'package.json');
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));

const program = new Command();

program
  .name('dependency-optimizer')
  .description('Scan for unused dependencies and node_modules waste')
  .version(packageJson.version);

program
  .command('scan')
  .description('Scan for unused dependencies')
  .argument('[path]', 'Path to project directory', process.cwd())
  .option('--fix', 'Automatically remove unused dependencies from package.json')
  .option('--recursive', 'Recursively scan all workspace packages')
  .option('--workspace <pattern>', 'Filter specific workspace packages')
  .option('--verbose', 'Enable verbose output')
  .option('--include-dev', 'Include dev dependencies in scan (default: true)', true)
  .action(async (projectPath, options) => {
    try {
      console.log('🔍 Scanning for unused dependencies...\n');

      const scanOptions: ScanOptions = {
        fix: options.fix,
        recursive: options.recursive,
        workspace: options.workspace,
        verbose: options.verbose,
        includeDevDependencies: options.includeDev
      };

      const scanner = new DependencyScanner(scanOptions);
      const results = await scanner.scan(projectPath);

      // Display results
      let totalUnused = 0;
      let totalFixed = 0;

      for (const result of results) {
        if (result.errors && result.errors.length > 0) {
          console.log(`❌ Error scanning ${result.packageName || result.packagePath}:`);
          result.errors.forEach(error => console.log(`   ${error}`));
          console.log('');
          continue;
        }

        if (result.unusedDependencies.length === 0) {
          if (options.verbose || results.length === 1) {
            console.log(`✅ ${result.packageName || path.basename(result.packagePath)}: No unused dependencies`);
          }
          continue;
        }

        totalUnused += result.unusedDependencies.length;

        if (results.length > 1) {
          console.log(`📦 ${result.packageName || path.basename(result.packagePath)}:`);
        }

        if (options.fix && result.fixedDependencies) {
          totalFixed += result.fixedDependencies.length;
          console.log('🔧 Fixed package.json:');
          result.fixedDependencies.forEach(dep => {
            console.log(`  ✅ Removed ${dep.name} from ${dep.type}`);
          });
        } else {
          console.log(`❌ Unused dependencies (${result.unusedDependencies.length}):`);
          result.unusedDependencies.forEach(dep => {
            console.log(`  - ${dep.name} (${dep.type})`);
          });
        }
        console.log('');
      }

      // Summary
      if (results.length > 1) {
        console.log('📊 Summary:');
        console.log(`   Packages scanned: ${results.length}`);
        console.log(`   Total unused dependencies: ${totalUnused}`);
        if (options.fix) {
          console.log(`   Dependencies removed: ${totalFixed}`);
        }
      }

      if (totalUnused > 0 && !options.fix) {
        console.log('\n💡 Tip: Use --fix to automatically remove unused dependencies');
      }

    } catch (error: any) {
      console.error('\n❌ Scan failed:');
      console.error(`   ${error.message}`);
      process.exit(1);
    }
  });

program
  .command('analyze')
  .description('Analyze node_modules for optimization opportunities')
  .argument('[path]', 'Path to project directory', process.cwd())
  .option('--size-threshold <mb>', 'Size threshold in MB for flagging large packages', '10')
  .option('--depth-threshold <depth>', 'Depth threshold for flagging deep dependency trees', '5')
  .option('--json', 'Output results in JSON format')
  .action(async (projectPath, options) => {
    try {
      const analyzeOptions: AnalyzeOptions = {
        sizeThreshold: parseInt(options.sizeThreshold),
        depthThreshold: parseInt(options.depthThreshold),
        json: options.json
      };

      const analyzer = new NodeModulesAnalyzer(analyzeOptions);
      const result = await analyzer.analyze(projectPath);

      if (options.json) {
        console.log(JSON.stringify(result, null, 2));
        return;
      }

      console.log('📦 Node_modules Analysis');
      console.log('========================\n');

      if (result.totalPackages === 0) {
        console.log('❌ No node_modules found');
        return;
      }

      console.log(`📊 Total packages: ${result.totalPackages}`);
      console.log(`💾 Total size: ${analyzer.formatSize(result.totalSize)}`);
      console.log(`📁 Location: ${result.nodeModulesPath}\n`);

      // Large packages
      if (result.largePackages.length > 0) {
        console.log(`🔴 Large packages (>${analyzeOptions.sizeThreshold}MB):`);
        result.largePackages.forEach(pkg => {
          console.log(`   ${pkg.name}: ${analyzer.formatSize(pkg.size)}`);
        });
        console.log('');
      } else {
        console.log(`✅ No packages exceed ${analyzeOptions.sizeThreshold}MB\n`);
      }

      // Deep packages
      if (result.deepPackages.length > 0) {
        console.log(`🔶 Deep dependency packages (>${analyzeOptions.depthThreshold} levels):`);
        result.deepPackages.forEach(pkg => {
          console.log(`   ${pkg.name}: ${pkg.depth} levels deep`);
        });
        console.log('');
      } else {
        console.log(`✅ No packages exceed ${analyzeOptions.depthThreshold} dependency levels\n`);
      }

      // Optimization suggestions
      const totalLargeSize = result.largePackages.reduce((sum, pkg) => sum + pkg.size, 0);
      if (totalLargeSize > 0) {
        console.log('💡 Optimization suggestions:');
        console.log(`   • Large packages account for ${analyzer.formatSize(totalLargeSize)} (${((totalLargeSize / result.totalSize) * 100).toFixed(1)}%)`);
        console.log('   • Consider alternatives for large packages');
        console.log('   • Use tree-shaking and import only what you need');
        if (result.deepPackages.length > 0) {
          console.log('   • Deep dependencies may indicate outdated or inefficient packages');
        }
      }

    } catch (error: any) {
      console.error('\n❌ Analysis failed:');
      console.error(`   ${error.message}`);
      process.exit(1);
    }
  });

program
  .command('examples')
  .description('Show usage examples')
  .action(() => {
    console.log('📚 Dependency Optimizer Examples');
    console.log('=================================\n');

    console.log('🔍 Basic scanning:');
    console.log('   dependency-optimizer scan\n');

    console.log('🔧 Scan and auto-fix:');
    console.log('   dependency-optimizer scan --fix\n');

    console.log('🗂️  Monorepo scanning:');
    console.log('   dependency-optimizer scan --recursive\n');

    console.log('🎯 Filter workspaces:');
    console.log('   dependency-optimizer scan --recursive --workspace frontend\n');

    console.log('🔍 Verbose output:');
    console.log('   dependency-optimizer scan --verbose\n');

    console.log('📦 Node_modules analysis:');
    console.log('   dependency-optimizer analyze\n');

    console.log('🔧 Custom thresholds:');
    console.log('   dependency-optimizer analyze --size-threshold 5 --depth-threshold 3\n');

    console.log('📄 JSON output:');
    console.log('   dependency-optimizer analyze --json\n');

    console.log('💡 Tips:');
    console.log('   • Use --fix with caution, always review changes');
    console.log('   • Recursive scanning works with npm/yarn workspaces and Lerna');
    console.log('   • Auto-detects project configuration (ESLint, Babel, Jest, etc.)');
    console.log('   • Maintains package.json formatting when fixing');
  });

// Parse command line arguments
program.parse();