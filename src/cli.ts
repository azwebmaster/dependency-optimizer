#!/usr/bin/env bun

import { Command } from 'commander';
import { commands } from './commands/index.js';
import createDebug from 'debug';

const debug = createDebug('depoptimize:cli');

import pkg from "../package.json" with { type: "json" };

// Read version from package.json dynamically
const VERSION: string = pkg.version;

const program = new Command();

program
  .name('dependency-optimizer')
  .description('Scan for unused dependencies and node_modules waste')
  .version(VERSION);

// Register all commands
Object.values(commands).forEach(command => {
  command.register(program);
  });

// Parse command line arguments
debug('Parsing command line arguments');
program.parse();
debug('Command line parsing complete');