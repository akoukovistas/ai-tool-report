#!/usr/bin/env node

import 'dotenv/config';
import { parseArgs } from 'node:util';
import { GitHubMetricsService } from './services/GitHubMetricsService.js';

/**
 * Fetch GitHub Copilot metrics for an organization.
 * Docs: https://docs.github.com/en/enterprise-cloud@latest/rest/copilot/copilot-metrics?apiVersion=2022-11-28#get-copilot-metrics-for-an-organization
 * Token scopes: manage_billing:copilot, read:org, or read:enterprise (classic). Fine-grained tokens supported per docs.
 */
export async function fetchOrgMetrics(options = {}) {
  const service = new GitHubMetricsService(options);
  return await service.fetchOrgMetrics(options);
}

// CLI execution
if (import.meta.url.endsWith(process.argv[1]) || process.argv[1].endsWith('metrics.js')) {
  const { values: args, positionals } = parseArgs({
    options: {
      org: { type: 'string', short: 'o' },
      since: { type: 'string', short: 's' },
      until: { type: 'string', short: 'u' },
      'per-page': { type: 'string', default: '100' },
      delay: { type: 'string', default: '0' },
      'single-page': { type: 'boolean', default: false },
      page: { type: 'string', default: '1' },
      'data-dir': { type: 'string' },
      help: { type: 'boolean', short: 'h' }
    },
    allowPositionals: true
  });

  if (args.help) {
    console.log(`
Usage: node metrics.js [options]

Fetch GitHub Copilot metrics for an organization.

Options:
  -o, --org <org>          Organization name (or set GH_ORG env var)
  -s, --since <date>       Start date (YYYY-MM-DD or ISO format)
  -u, --until <date>       End date (YYYY-MM-DD or ISO format)
      --per-page <n>       Items per page (default: 100)
      --delay <ms>         Delay between requests in ms (default: 0)
      --single-page        Fetch only first page
      --page <n>           Start from specific page (default: 1)
      --data-dir <path>    Data directory (default: data/github)
  -h, --help               Show this help

Environment Variables:
  GH_ORG                   Default organization name
  GH_TOKEN                 GitHub token (required)
  GH_API_BASE             GitHub API base URL

Examples:
  node metrics.js --org mycompany
  node metrics.js --org mycompany --since 2024-01-01 --until 2024-01-31
  node metrics.js --org mycompany --per-page 50 --delay 100
`);
    process.exit(0);
  }

  try {
    // Build options, filtering out undefined values so environment variables can be used as defaults
    const options = {};
    if (args.org !== undefined) options.org = args.org;
    if (args.since !== undefined) options.since = args.since;
    if (args.until !== undefined) options.until = args.until;
    if (args['per-page'] !== undefined) options.perPage = parseInt(args['per-page']) || 100;
    if (args.delay !== undefined) options.delayMs = parseInt(args.delay) || 0;
    if (args['single-page'] !== undefined) options.singlePage = args['single-page'];
    if (args.page !== undefined) options.page = parseInt(args.page) || 1;
    if (args['data-dir'] !== undefined) options.dataDir = args['data-dir'];
    
    const result = await fetchOrgMetrics(options);
    
    console.log(`\n✅ Completed successfully!`);
    console.log(`📄 File: ${result.jsonPath}`);
    console.log(`📊 Records: ${result.count}`);
    
  } catch (error) {
    console.error(`❌ Error: ${error.message}`);
    process.exit(1);
  }
}
