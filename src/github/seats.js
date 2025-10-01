#!/usr/bin/env node

import 'dotenv/config';
import { parseArgs } from 'node:util';
import { GitHubSeatsService } from './services/GitHubSeatsService.js';

/**
 * Fetch all GitHub Copilot seat assignments for an organization.
 * Docs: https://docs.github.com/en/rest/copilot/copilot-user-management?apiVersion=2022-11-28#list-all-copilot-seat-assignments-for-an-organization
 * Required token scopes/permissions: manage_billing:copilot (org admin / billing manager with Copilot access)
 */
export async function fetchSeats(options = {}) {
  const service = new GitHubSeatsService(options);
  return await service.fetchSeats(options);
}

// CLI execution
if (import.meta.url.endsWith(process.argv[1]) || process.argv[1].endsWith('seats.js')) {
  const { values: args } = parseArgs({
    options: {
      org: { type: 'string', short: 'o' },
      'per-page': { type: 'string', default: '100' },
      delay: { type: 'string', default: '0' },
      'enrich-names': { type: 'boolean', default: true },
      'name-cache-path': { type: 'string' },
      'name-delay': { type: 'string', default: '40' },
      'data-dir': { type: 'string' },
      'output-dir': { type: 'string' },
      help: { type: 'boolean', short: 'h' }
    },
    allowPositionals: false
  });

  if (args.help) {
    console.log(`
Usage: node seats.js [options]

Fetch GitHub Copilot seat assignments for an organization.

Options:
  -o, --org <org>           Organization name (or set GH_ORG env var)
      --per-page <n>        Items per page (default: 100)
      --delay <ms>          Delay between requests in ms (default: 0)
      --enrich-names        Fetch user display names (default: true)
      --name-cache-path <p> Path to name cache file
      --name-delay <ms>     Delay between name lookups (default: 40)
      --data-dir <path>     Data directory (default: data/github)
      --output-dir <path>   CSV output directory (default: output/csv/github)
  -h, --help                Show this help

Environment Variables:
  GH_ORG                    Default organization name
  GH_TOKEN                  GitHub token (required)
  GH_API_BASE              GitHub API base URL

Examples:
  node seats.js --org mycompany
  node seats.js --org mycompany --no-enrich-names
  node seats.js --org mycompany --per-page 50 --delay 100
`);
    process.exit(0);
  }

  try {
    // Build options, filtering out undefined values so environment variables can be used as defaults
    const options = {};
    if (args.org !== undefined) options.org = args.org;
    if (args['per-page'] !== undefined) options.perPage = parseInt(args['per-page']) || 100;
    if (args.delay !== undefined) options.delayMs = parseInt(args.delay) || 0;
    if (args['enrich-names'] !== undefined) options.enrichNames = args['enrich-names'];
    if (args['name-cache-path'] !== undefined) options.nameCachePath = args['name-cache-path'];
    if (args['name-delay'] !== undefined) options.nameDelayMs = parseInt(args['name-delay']) || 40;
    if (args['data-dir'] !== undefined) options.dataDir = args['data-dir'];
    if (args['output-dir'] !== undefined) options.outputDir = args['output-dir'];
    
    const result = await fetchSeats(options);
    
    console.log(`\n✅ Completed successfully!`);
    console.log(`📄 JSON: ${result.jsonPath}`);
    console.log(`📊 CSV: ${result.csvPath}`);
    console.log(`👥 Seats: ${result.count}`);
    
  } catch (error) {
    console.error(`❌ Error: ${error.message}`);
    process.exit(1);
  }
}
