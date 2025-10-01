#!/usr/bin/env node

import { parseArgs } from 'node:util';
import { GitHubUserService } from './services/GitHubUserService.js';

/**
 * Build (or update) a GitHub login -> email mapping CSV scaffold.
 * We don't have emails in the Copilot seats; this outputs login + empty Email column for manual fill.
 * Merge rules: preserve existing non-empty emails; only add new logins or blank rows.
 */
export async function buildLoginEmailMap(options = {}) {
  const service = new GitHubUserService(options);
  return await service.buildLoginEmailMap(options);
}

// CLI execution
if (import.meta.url === `file://${process.argv[1]}`) {
  const { values: args } = parseArgs({
    options: {
      org: { type: 'string', short: 'o' },
      'data-dir': { type: 'string', default: 'data/github' },
      'out-file': { type: 'string' },
      help: { type: 'boolean', short: 'h' }
    }
  });

  if (args.help) {
    console.log(`
Usage: node login-email-map.js [options]

Build (or update) a GitHub login -> email mapping CSV scaffold.
Preserves existing non-empty emails; only adds new logins or blank rows.

Options:
  -o, --org <org>          Organization name (or set GH_ORG env var)
      --data-dir <path>    Data directory to scan (default: data/github)
      --out-file <path>    Output CSV file (default: data/github/login-email-map.csv)
  -h, --help               Show this help

Environment Variables:
  GH_ORG                   Default organization name

Note: This command creates a scaffold CSV with Login and empty Email columns.
You should manually populate the Email column or use other tools to enrich it.

Examples:
  node login-email-map.js --org mycompany
  node login-email-map.js --org mycompany --out-file ./email-map.csv
`);
    process.exit(0);
  }

  try {
    const result = await buildLoginEmailMap({
      org: args.org,
      dataDir: args['data-dir'],
      outFile: args['out-file']
    });
    
    console.log(`\n✅ Completed successfully!`);
    console.log(`📄 File: ${result.outFile}`);
    console.log(`📊 Entries: ${result.count}`);
    console.log(`➕ New logins: ${result.newCount}`);
    console.log(`♻️ Preserved: ${result.existingCount}`);
    
  } catch (error) {
    console.error(`❌ Error: ${error.message}`);
    process.exit(1);
  }
}
