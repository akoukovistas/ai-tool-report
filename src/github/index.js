#!/usr/bin/env node

import { Command } from 'commander';
import { fetchOrgMetrics } from './metrics.js';
import { fetchSeats } from './seats.js';
import { buildLoginEmailMap } from './login-email-map.js';
import { buildUserLookup } from './user-lookup.js';
import { diagnoseSeats } from './diagnose.js';
import { enrich } from './enrich.js';

const program = new Command();
program.name('github').description('GitHub Copilot Tools CLI');

program
  .command('metrics')
  .description('Fetch GitHub Copilot metrics for an organization')
  .option('--org <org>', 'Organization name', process.env.GH_ORG)
  .option('--since <date>', 'Start date')
  .option('--until <date>', 'End date')
  .action(async options => {
    await fetchOrgMetrics(options);
  });

program
  .command('seats')
  .description('Fetch GitHub Copilot seat assignments')
  .option('--org <org>', 'Organization name', process.env.GH_ORG)
  .option('--enrich-names', 'Enrich seat assignees with names')
  .action(async options => {
    await fetchSeats(options);
  });

program
  .command('login-email-map')
  .description('Build login -> email mapping CSV scaffold')
  .option('--org <org>', 'Organization name', process.env.GH_ORG)
  .action(async options => {
    await buildLoginEmailMap(options);
  });

program
  .command('user-lookup')
  .description('Build user lookup CSV with display names')
  .option('--org <org>', 'Organization name', process.env.GH_ORG)
  .option('--force-refresh', 'Refresh names from API')
  .action(async options => {
    await buildUserLookup(options);
  });

program
  .command('diagnose')
  .description('Diagnose GitHub API access and permissions')
  .option('--org <org>', 'Organization name', process.env.GH_ORG)
  .action(async options => {
    await diagnoseSeats(options);
  });

program
  .command('enrich')
  .description('Enrich CSV data with GitHub user information')
  .requiredOption('--input <file>', 'Input CSV file')
  .option('--out <dir>', 'Output directory')
  .action(async options => {
    await enrich(options);
  });

program.parse(process.argv);

export {
  fetchOrgMetrics,
  fetchSeats,
  buildLoginEmailMap,
  buildUserLookup,
  diagnoseSeats,
  enrich
};
