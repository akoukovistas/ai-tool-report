#!/usr/bin/env node

import 'dotenv/config';
import { Command } from 'commander';
import { createReportCommands } from './commands/reports.js';

/**
 * Main CLI Entry Point
 * Provides unified command-line interface for all AI metrics operations
 */

const program = new Command();

// Configure main program
program
  .name('ai-metrics-report')
  .description('Comprehensive AI metrics reporting tool for GitHub Copilot and Cursor')
  .version('1.0.0')
  .option('-v, --verbose', 'Enable verbose output')
  .option('--dry-run', 'Show what would be done without executing')
  .hook('preAction', (thisCommand) => {
    // Set up global options
    const options = thisCommand.opts();
    if (options.verbose) {
      process.env.VERBOSE = 'true';
    }
    if (options.dryRun) {
      process.env.DRY_RUN = 'true';
    }
  });

// Add command groups
createReportCommands(program);

// Handle unknown commands gracefully
program.on('command:*', () => {
  console.error(`Invalid command: ${program.args.join(' ')}`);
  console.error('See --help for a list of available commands.');
  process.exit(1);
});

// Show help if no command provided
if (process.argv.length === 2) {
  program.help();
}

// Parse arguments and execute
program.parse(process.argv);
