# One Shot AI Metrics Report Command

The one-shot command is the **recommended way** to generate comprehensive AI metrics reports. It performs a complete data fetch and analysis cycle in a single execution using the new service-based architecture.

## What It Does

The one-shot command executes the following operations:

1. **📊 Fetches GitHub Copilot metrics** - Usage data for the last 7 days
2. **💺 Fetches GitHub Copilot seat assignments** - Current seat allocation and activity
3. **🖱️ Fetches Cursor activity data** - Weekly usage patterns and statistics
4. **📈 Generates Active Users Report** - Cross-platform user activity analysis
5. **🔧 Generates AI Tooling Adoption Report** - Organizational adoption insights
6. **⏰ Generates Recent Activity Analysis** - Detailed usage pattern breakdown

## Usage

### Using the unified CLI (recommended):
```bash
ai-metrics-report reports one-shot
```

### Using npm script:
```bash
npm run report:one-shot
```

### With options:
```bash
# Skip all prompts for automation
ai-metrics-report reports one-shot --skip-prompt
```

## Prerequisites

### Environment Setup
You need to set up your environment variables. Copy `env.template` to `.env` and fill in the required values:

```bash
cp env.template .env
```

Required environment variables:
- `ORG` - Org slug used for data directory (`data/<org>`)
- `GH_TOKEN` - GitHub Personal Access Token with `manage_billing:copilot` and `read:org` permissions
- `GH_ORG` - Your GitHub organization name (alternatives accepted: `GITHUB_ORG`)
- `CURSOR_API_KEY` - Cursor Admin API key from [Cursor Dashboard](https://cursor.com/dashboard)

### Data Files
Ensure these files exist:
- `data/user-lookup-table.csv` - User mapping between GitHub logins, emails, and roles
- `data/<org>/direct-reports.json` - Organizational structure data (org folder derived from `ORG`)

## Output

The command generates the following reports in `output/reports/`:

1. **`active-users.md` + timestamped copy**
2. **`ai-tooling-adoption-report.md` + timestamped copy**
3. **`recent-activity-analysis.md` + timestamped copy** (if data available)

The command also fetches and stores raw data in:
- `data/github/` - GitHub Copilot metrics and seat assignments
- `data/cursor/` - Cursor weekly activity data

## Error Handling

The script includes comprehensive error handling and will provide specific guidance for common issues:

- **Missing API keys** - Provides setup instructions
- **Network connectivity issues** - Suggests troubleshooting steps
- **Missing data files** - Lists required files and their locations
- **Permission issues** - Explains required GitHub token permissions

## Execution Time

Typical execution time: 30-60 seconds depending on:
- Organization size
- Network latency
- Amount of historical data

## Scheduling

You can schedule this command to run regularly using:

### Windows Task Scheduler
Create a batch file that runs the command and schedule it.

### Linux/macOS Cron
Add to crontab for daily execution at 8 AM:
```bash
0 8 * * * cd /path/to/ai-metrics-report && npm run report:one-shot
```

### GitHub Actions
Set up a workflow to run the command on a schedule and commit results back to the repository.

## Troubleshooting

### Quick Diagnostics
```bash
# Check system health first
ai-metrics-report status

# Test GitHub API access
ai-metrics-report github diagnose
```

### Isolate Issues
If the command fails, run individual components to isolate the problem:

```bash
# Test individual data fetching
ai-metrics-report cursor activity weekly
ai-metrics-report github metrics --days 7
ai-metrics-report github seats --enrich-names

# Test report generation only (using existing data)
ai-metrics-report reports active-users
ai-metrics-report reports ai-tooling
```

### Common Solutions
```bash
# Clean and restart if data is corrupted
ai-metrics-report clean --confirm
ai-metrics-report reports one-shot

# Force refresh if data is stale
ai-metrics-report github seats --force-refresh
ai-metrics-report github user-lookup --force-refresh
```

## Individual Operations

You can run specific operations separately:

### Data Fetching
```bash
ai-metrics-report github seats --enrich-names    # GitHub Copilot seats
ai-metrics-report github metrics --days 7        # GitHub usage metrics  
ai-metrics-report cursor fetch-all               # All Cursor data
```

### Report Generation
```bash
ai-metrics-report reports active-users           # Active users analysis
ai-metrics-report reports ai-tooling             # Adoption insights
ai-metrics-report reports github-activity        # GitHub deep-dive
ai-metrics-report reports all                    # All reports from existing data
```

## Data Freshness

- **GitHub data**: Real-time (fetched during execution)
- **Cursor data**: Real-time (fetched during execution)
- **Reports**: Generated with current timestamp
- **Analysis period**: Last 7 days from execution time
