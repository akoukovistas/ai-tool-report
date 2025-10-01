#!/usr/bin/env node

import { parseArgs } from 'node:util';
import { GitHubUserService } from './services/GitHubUserService.js';

/**
 * Build a lookup CSV mapping GitHub usernames to display names.
 * - Scans Copilot seat assignment JSON files for the org to gather logins.
 * - Uses (and updates) a JSON name cache (shared with seats fetcher) to avoid refetching.
 * - Writes CSV to output/csv/github/users/user-lookup.csv (UTF-8 BOM for Excel friendliness).
 */
export async function buildUserLookup(options = {}) {
  const service = new GitHubUserService(options);
  return await service.buildUserLookup(options);
}

// CLI execution
if (import.meta.url === `file://${process.argv[1]}`) {
  const { values: args } = parseArgs({
    options: {
      org: { type: 'string', short: 'o' },
      'data-dir': { type: 'string', default: 'data/github' },
      'out-dir': { type: 'string' },
      'cache-path': { type: 'string' },
      'delay': { type: 'string', default: '50' },
      'force-refresh': { type: 'boolean', default: false },
      help: { type: 'boolean', short: 'h' }
    }
  });

  if (args.help) {
    console.log(`
Usage: node user-lookup.js [options]

Build a lookup CSV mapping GitHub usernames to display names.
Scans Copilot seat assignment JSON files for the org to gather logins.

Options:
  -o, --org <org>          Organization name (or set GH_ORG env var)
      --data-dir <path>    Data directory to scan (default: data/github)
      --out-dir <path>     Optional secondary output location
      --cache-path <path>  Name cache file path (default: data/github-name-cache.json)
      --delay <ms>         Delay between API calls (default: 50)
      --force-refresh      Force refresh all cached names
  -h, --help               Show this help

Environment Variables:
  GH_ORG                   Default organization name
  GH_TOKEN                 GitHub token (for name lookups)

Examples:
  node user-lookup.js --org mycompany
  node user-lookup.js --org mycompany --force-refresh
  node user-lookup.js --org mycompany --delay 100
`);
    process.exit(0);
  }

  try {
    const result = await buildUserLookup({
      org: args.org,
      dataDir: args['data-dir'],
      outDir: args['out-dir'],
      cachePath: args['cache-path'],
      delayMs: parseInt(args.delay) || 50,
      forceRefresh: args['force-refresh']
    });
    
    console.log(`\n✅ Completed successfully!`);
    console.log(`📄 CSV: ${result.csvPath}`);
    console.log(`👥 Users: ${result.count}`);
    
  } catch (error) {
    console.error(`❌ Error: ${error.message}`);
    process.exit(1);
  }
}