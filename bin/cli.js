#!/usr/bin/env node

const { program } = require('commander');
const chalk = require('chalk');
const DependencyOptimizer = require('../src/index.js');

program
  .name('dependency-optimizer')
  .description('CLI tool to optimize dependency usage')
  .version('1.0.0');

program
  .command('scan')
  .description('Scan for unused dependencies')
  .option('-f, --fix', 'Automatically fix by removing unused dependencies')
  .option('-r, --recursive', 'Scan monorepo workspaces recursively')
  .option('-w, --workspace <pattern>', 'Filter workspaces by pattern')
  .option('--verbose', 'Enable verbose output')
  .action(async (options) => {
    try {
      const optimizer = new DependencyOptimizer();
      await optimizer.scan(options);
    } catch (error) {
      console.error(chalk.red('Error:'), error.message);
      process.exit(1);
    }
  });

program
  .command('analyze')
  .description('Analyze node_modules for large packages and transitive dependencies')
  .option('--size-threshold <mb>', 'Size threshold in MB for large packages', '10')
  .option('--depth-threshold <depth>', 'Depth threshold for transitive dependencies', '5')
  .option('--json', 'Output results in JSON format')
  .action(async (options) => {
    try {
      const optimizer = new DependencyOptimizer();
      await optimizer.analyze(options);
    } catch (error) {
      console.error(chalk.red('Error:'), error.message);
      process.exit(1);
    }
  });

program.parse();