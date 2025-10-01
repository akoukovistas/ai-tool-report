#!/usr/bin/env node

import 'dotenv/config';
import { parseArgs } from 'node:util';
import { GitHubDiagnosticService } from './services/GitHubDiagnosticService.js';

export async function diagnoseSeats(options = {}) {
  const service = new GitHubDiagnosticService(options);
  const results = await service.diagnoseSeats(options);
  service.printSummary(results);
  return results;
}

// CLI execution
if (import.meta.url.endsWith(process.argv[1]) || process.argv[1].endsWith('diagnose.js')) {
  const { values: args } = parseArgs({
    options: {
      org: { type: 'string', short: 'o' },
      help: { type: 'boolean', short: 'h' }
    }
  });

  if (args.help) {
    console.log(`
Usage: node diagnose.js [options]

Diagnose GitHub API access and permissions for Copilot seats.

Options:
  -o, --org <org>          Organization name (or set GH_ORG env var)
  -h, --help               Show this help

Environment Variables:
  GH_ORG                   Default organization name
  GH_TOKEN                 GitHub token to test
  GH_API_BASE             GitHub API base URL

Examples:
  node diagnose.js --org mycompany
  node diagnose.js  # Just test auth without org-specific endpoints
`);
    process.exit(0);
  }

  try {
    const results = await diagnoseSeats({
      org: args.org
    });
    
    // Exit with error code if there are high-priority issues
    const hasHighPriorityIssues = results.recommendations?.some(r => r.priority === 'high');
    process.exit(hasHighPriorityIssues ? 1 : 0);
    
  } catch (error) {
    console.error(`❌ Diagnostic failed: ${error.message}`);
    process.exit(1);
  }
}
