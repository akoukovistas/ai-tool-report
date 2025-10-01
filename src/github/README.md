# GitHub Copilot Tools

A collection of clean, well-organized Node.js services for managing GitHub Copilot data and analytics.

## Architecture

This codebase follows OOP principles with a clean separation of concerns:

- **Services**: Core business logic in `services/` directory
- **Utils**: Shared utilities and helpers in `utils/` directory
- **CLI**: Each script is both importable as a module and executable as a CLI command
- **Main CLI**: Unified entry point via `index.js`

## Services

### GitHubMetricsService
Fetch GitHub Copilot metrics for an organization with proper date handling and pagination.

### GitHubSeatsService  
Fetch Copilot seat assignments with name enrichment and CSV export capabilities.

### GitHubUserService
Build user lookup tables and email mapping scaffolds from seat data.

### GitHubDiagnosticService
Diagnose API access, token permissions, and provide troubleshooting recommendations.

## Usage

### Individual Commands

Each service can be run independently:

```bash
# Fetch metrics
node metrics.js --org mycompany --since 2024-01-01

# Fetch seats with name enrichment
node seats.js --org mycompany --enrich-names

# Build user lookup
node user-lookup.js --org mycompany --force-refresh

# Build email mapping scaffold
node login-email-map.js --org mycompany

# Diagnose API access
node diagnose.js --org mycompany

# Enrich CSV with user data
node enrich.js --input data.csv
```

### Unified CLI

Use the main CLI runner for consistent experience:

```bash
# Run any command through index.js
node index.js metrics --org mycompany
node index.js seats --org mycompany
node index.js diagnose --org mycompany
```

### Programmatic Usage

Import and use services in your own code:

```javascript
import { GitHubMetricsService } from './services/GitHubMetricsService.js';
import { fetchSeats } from './seats.js';

// Use service class directly
const metricsService = new GitHubMetricsService({ org: 'mycompany' });
const result = await metricsService.fetchOrgMetrics();

// Use convenience function
const seatData = await fetchSeats({ org: 'mycompany' });
```

## Environment Variables

```bash
# Required
GH_TOKEN=ghp_your_github_token_here

# Optional
GH_ORG=your-default-org
GH_API_BASE=https://api.github.com
DATA_DIR=data/github
OUTPUT_DIR=output/csv/github
```

## Token Requirements

Different endpoints require different scopes:

- **Metrics**: `manage_billing:copilot`, `read:org`, or `read:enterprise`
- **Seats**: `manage_billing:copilot` (org admin/billing manager required)
- **User lookups**: Any valid token (or unauthenticated with rate limits)

## File Structure

```
src/github/
├── services/           # Core service classes
│   ├── GitHubMetricsService.js
│   ├── GitHubSeatsService.js
│   ├── GitHubUserService.js
│   └── GitHubDiagnosticService.js
├── utils/              # Shared utilities
│   ├── common.js       # Common helper functions
│   └── github-client.js # Unified GitHub API client
├── metrics.js          # Metrics CLI + export
├── seats.js           # Seats CLI + export
├── user-lookup.js     # User lookup CLI + export
├── login-email-map.js # Email mapping CLI + export
├── diagnose.js        # Diagnostic CLI + export
├── enrich.js          # CSV enrichment CLI + export
├── index.js           # Main CLI runner
└── README.md          # This file
```

## Output Files

### Data Structure
```
data/github/
├── YYYY/MM/DD/                 # Date-organized data
│   ├── copilot-org-metrics_*.json
│   └── copilot-seat-assignments_*.json
├── users/
│   └── user-lookup.csv         # Login -> Name mapping
├── login-email-map.csv         # Login -> Email scaffold
└── github-name-cache.json      # Cached user names
```

### CSV Outputs
```
output/csv/github/
├── copilot-seat-assignments.csv
├── copilot-users.csv           # Enriched user data
└── github-urls.txt             # GitHub profile URLs
```

## Features

- **Clean OOP Architecture**: Service classes with single responsibilities
- **CLI + Module Support**: Each script works as both CLI and importable module
- **Comprehensive Error Handling**: Detailed error messages and troubleshooting
- **Smart Caching**: Avoid re-fetching user data with persistent cache
- **Rate Limiting**: Built-in delays to respect GitHub API limits
- **Excel-Friendly CSV**: UTF-8 BOM for proper Excel import
- **Flexible Configuration**: Environment variables + command-line options
- **Unified API Client**: Consistent error handling and retry logic

## Help

Each command supports `--help` for detailed usage information:

```bash
node metrics.js --help
node seats.js --help
node index.js --help
```


