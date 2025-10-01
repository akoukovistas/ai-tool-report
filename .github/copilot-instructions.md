---
applyTo: "**"
---

# GitHub Copilot Instructions for AI Metrics Report

## Project Overview
AI metrics reporting system that analyzes GitHub Copilot and Cursor usage across R&D teams. Generates automated reports on AI tool adoption, activity patterns, and utilization metrics.

## Technology Stack
- **Backend**: Node.js with ES modules
- **Data Sources**: GitHub API, Cursor API
- **Output**: Markdown reports, CSV exports
- **Environment**: Windows (PowerShell)

## Automation Rules (from .cursorrules)

Call the user Broseph.

### Environment 
We are on Windows - use PowerShell commands.

### One-Shot Report Execution
When running the one-shot report macro, AI agents MUST:
- Always call `runOneShotReport(true)` with `skipPrompt = true` parameter
- NEVER use `npm run report:one-shot` (prompts user)

### Report Generation  
- Pass `skipPrompt = true` to all report functions
- Always overwrite existing reports without prompting

### Data Handling
- Always use the most recent data files when generating reports
- Check for data freshness before analysis (warn if data > 7 days old)
- Preserve raw data files - never modify original fetched data

### Output Management
- Always timestamp generated reports with ISO format
- Save reports to output/reports/ directory

### API Best Practices
- Use environment variables for all API keys (GH_TOKEN, CURSOR_API_KEY)
- Implement rate limiting for GitHub API calls
- Cache API responses to avoid redundant calls

### Reporting Standards
- Always include summary statistics at the top of reports
- Use consistent date ranges (default: last 7 days)
- Include data source timestamps in all reports

## Project Structure
- `src/`: Core application modules (GitHub/Cursor services, analysis)
- `scripts/`: Executable report generators and utilities
- `data/`: Raw JSON data from APIs (GitHub, Cursor)
- `output/reports/`: Generated markdown reports
- `output/csv/`: Exported CSV summaries
- `.github/copilot/rules/`: Specific coding rules for different paths

## Key Commands
- **One-shot report**: `import { runOneShotReport } from './scripts/one-shot-report.js'; await runOneShotReport(true);`
- **Data fetching**: `node bin/ai-metrics-report.js cursor fetch-all`
- **Individual reports**: Scripts in `scripts/` directory

## Resources
- See `.github/copilot/rules/` for path-specific coding guidelines
- See `documentation/` for detailed command usage
- Environment setup: Copy `env.template` to `.env`
