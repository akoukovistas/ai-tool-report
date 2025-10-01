# AI Metrics Report

Professional-grade CLI tool for GitHub Copilot & Cursor usage analytics with a clean service-based architecture and comprehensive reporting capabilities.

## ⚡ Quick Start

```bash
# One-shot comprehensive report (fetches fresh data & generates reports)
ai-metrics-report reports one-shot

# Or use npm scripts
npm run report:one-shot
```

---
## 📋 Commands Overview

The CLI is organized into logical command groups with consistent patterns:

```bash
ai-metrics-report [global-options] <command-group> <command> [options]
```

### 📊 Reports & Analysis (public release)
| Command | Purpose |
|---------|---------|
| `reports one-shot` | Full data fetch + comprehensive report generation |
| `reports active-users` | Active users analysis across both platforms |
| `reports ai-tooling` | AI tooling adoption analysis |
| `reports recent-activity` | Recent usage pattern analysis |
| `reports all` | Generate all reports from existing data |

---
## 🛠️ Setup & Configuration

**Requirements:** Node.js ≥ 18.17, network access

### 1. Installation
```bash
git clone <repo-url>
cd ai-metrics-report
npm ci
```

### 2. Environment Configuration
Create `.env` file (git-ignored):
```env
ORG=your_org_slug              # Used for data/<org> (e.g., data/acme-corp)

# GitHub Configuration
GH_ORG=your-organization       # Required for GitHub operations
GH_TOKEN=ghp_xxxxx             # Personal access token with manage_billing:copilot

# Cursor Configuration (Admin API)
CURSOR_API_KEY=cursor_xxxxx    # Cursor Admin API key

# Optional
PORT=3000                      # Web dashboard port
```

### 3. Verify Setup
```bash
# Generate reports end-to-end (fetch + analyze)
ai-metrics-report reports one-shot --skip-prompt
```

### 4. NPM Scripts
```bash
npm run report:one-shot     # Generate comprehensive report
```

---
## 3. Data File Structure
All JSON & intermediate data are under `data/` (git‑ignored). Final CSVs live under `output/csv/`.

### GitHub (dated hierarchy)
```
data/github/
  YYYY/MM/DD/  # one folder per fetch time
    copilot-seat-assignments_<org>_<timestamp>.json
  users/
    user-lookup.csv            # curated Login→Name lookup (manual edits allowed)
github-name-cache.json         # API name cache (auto)
```

### Cursor (dated hierarchy)
```
data/cursor/
  YYYY/MM/                     # monthly rolling window files
    monthly_activity_<start>_<end>.json
    monthly_manifest.json
  YYYY/MM/DD/
    daily_activity_<date>.json
  spend/page-*.json
  team-members.json
  usage-events/events-*.json
```

### Output CSVs (summary & analytics)
```
output/csv/github/
  copilot-seat-assignments.csv
  users/user-lookup.csv        # optional secondary copy if --out used
output/csv/cursor/
  cursor_team_members.csv
  cursor_daily_activity.csv
  cursor_monthly_activity.csv
  cursor_window_usage.csv
  cursor_monthly_activity_summary.csv
  cursor_spend.csv
  cursor_usage_events.csv
```

---
## 4. GitHub Names vs Cursor Data
Cursor API does NOT supply GitHub display names. Name population is an independent helper process:

1. Run `github fetch-seats --org <org>` to collect seat assignment JSON (dated dirs).
2. Run `github user-lookup --org <org>` to create / merge `data/github/users/user-lookup.csv`.
3. Optionally run `github enrich --input <copilot_activity_csv>` if you have a CSV export of Copilot activity requiring enrichment (produces `copilot-users.csv`).

### 4.1 user-lookup.csv Merge Rules
- New logins are appended.
- Existing non-empty names are NEVER overwritten (manual curation preserved).
- Blank existing names are filled if an API name appears.
- You may manually edit any `Name` cell (e.g., standardize spelling, add real names).
- Re-running `github user-lookup` will not clobber your manual edits unless the cell was blank.

### 4.2 Manual Editing Tips
Open `data/github/users/user-lookup.csv` in your editor or spreadsheet:
| Column | Meaning |
|--------|---------|
| Login  | GitHub username (key) |
| Name   | Human-friendly display / real name (editable) |

Avoid adding extra columns (the tool only reads the first two). If you need custom attributes, maintain a parallel file and join later in BI tooling.

### 4.3 Name Cache
`data/github-name-cache.json` stores raw API results. Delete it to force refetch; it has no effect on preserving manual edits in `user-lookup.csv`.

---
## 🔄 Common Workflows

### Quick Start - Comprehensive Report
```bash
ai-metrics-report reports one-shot
```

### Generate Specific Reports from existing data
```bash
ai-metrics-report reports active-users
ai-metrics-report reports ai-tooling
ai-metrics-report reports recent-activity --days 7
```

### Dashboard
```powershell
npm start   # runs the dashboard with scheduler
```
Visit: http://localhost:3000/dashboard

---
## 7. Scheduler
The built-in scheduler runs every 6 hours and calls the one-shot workflow automatically, updating `output/reports/` and `data/metrics/` snapshots.

Note on Cursor Admin API routes: we use the current Admin API endpoints for activity:
- POST `/teams/daily-usage-data` with `{ startDate, endDate }` (epoch millis)
- Other endpoints (members, spend, usage-events) also use `/teams/*`
Reference: [Cursor Admin API docs](https://cursor.com/docs/account/teams/admin-api)

---
## 🔧 Troubleshooting

### Quick Diagnostics
Ensure `.env` is set correctly and network access is available. Re-run:
```bash
ai-metrics-report reports one-shot --skip-prompt
```

### Common Issues

| Issue | Solution | Command to Test |
|-------|----------|-----------------|
| **403/404 on GitHub operations** | Token missing `manage_billing:copilot` scope | Recheck `GH_TOKEN` scopes in `.env` |
| **Cursor API failures** | Check `CURSOR_API_KEY` in `.env` file | Re-run one-shot after fixing env |
| **Missing user names** | Ensure `data/user-lookup-table.csv` includes names | Update the CSV and re-run |
| **No reports generated** | Verify required data files exist | Re-run `reports one-shot` |
| **Permission errors** | Verify GitHub org access and token scopes | Recreate token with correct scopes |

### Environment Issues
```bash
cp env.template .env
# Then edit .env with your credentials
```

### Data Issues
```bash
# Re-run end-to-end to refresh data
ai-metrics-report reports one-shot --skip-prompt
```

---
## 9. Data & Privacy
- Public GitHub profile fields only (plus seat assignment metadata requiring authorized token).
- Cursor data limited to team usage & spend endpoints.
- Secrets: keep in `.env` (git‑ignored by default).

---
## 🏗️ Architecture & Services

This project uses a clean **service-based architecture** for maintainability and extensibility:

### Service Layers
```
src/
├── cli/                    # Unified Commander.js CLI interface
├── cursor/services/        # Cursor-specific business logic
├── github/services/        # GitHub-specific business logic  
├── reporting/             # Cross-platform reporting services
└── common/                # Shared utilities and helpers
```

### Key Services

#### **GitHub Services**
- `GitHubSeatsService` - Copilot seat management and enrichment
- `GitHubMetricsService` - Usage metrics collection
- `GitHubUserService` - User lookup and mapping
- `GitHubAnalysisService` - Activity analysis and reporting

#### **Cursor Services**  
- `CursorActivityService` - Activity data fetching and analysis
- `CursorTeamService` - Team and spend data management
- `CursorReportingService` - CSV generation and aggregation

#### **Reporting Services**
- `ReportingService` - Unified report generation across platforms

### Benefits of This Architecture
- ✅ **Consistent patterns** across all domains
- ✅ **Separation of concerns** between CLI, business logic, and data
- ✅ **Testable** - business logic isolated from CLI
- ✅ **Extensible** - easy to add new services following established patterns
- ✅ **Maintainable** - clear structure makes changes predictable

---
## 📊 Analysis & Reporting

### Comprehensive Reports
```bash
# Generate all reports from fresh data
ai-metrics-report reports one-shot

# Individual report types
ai-metrics-report reports active-users      # Cross-platform user activity
ai-metrics-report reports ai-tooling        # Adoption analysis
ai-metrics-report reports github-activity   # GitHub Copilot deep-dive
```

### Advanced Analysis Options
```bash
# GitHub activity analysis with options
ai-metrics-report reports github-activity \
  --org YourOrg \
  --days 14 \
  --force-refresh \
  --json-output

# Recent activity patterns
ai-metrics-report reports recent-activity --days 30
```

### Sample Report Output
```
📊 AI Tools Active Users Report
Generated: 2025-09-18
Analysis Period: Last 7 days

Executive Summary
Total R&D people: 156
People active in either tool this past week: 89 (57.1%)

Engineering Team Activity
Total Engineering ICs: 78
Engineering ICs Active (Last 7 Days): 72
92.3% of engineering ICs were active users this past week.
```

---
## 🚀 Roadmap & Future Enhancements

### ✅ Recently Completed (v1.0)
- **Service-based architecture** - Clean, maintainable code structure
- **Unified CLI interface** - Commander.js-based consistent commands  
- **Comprehensive reporting** - Cross-platform analysis and insights
- **System status dashboard** - Health monitoring and diagnostics
- **Better error handling** - Clear error messages and troubleshooting

### 🎯 Planned Improvements
- **Testing framework** - Unit and integration tests with Vitest
- **Enhanced dashboards** - Interactive web analytics
- **Cross-platform insights** - Combined GitHub + Cursor user journey analysis  
- **Automated scheduling** - Cron-based report generation
- **Trend analysis** - Historical usage pattern tracking
- **Export formats** - PDF, Excel, and BI tool integrations

### 🔮 Future Ideas
- **GraphQL API** - Query interface for external integrations
- **Real-time monitoring** - Live usage dashboards
- **Machine learning insights** - Predictive analytics for adoption patterns
- **Multi-organization support** - Enterprise-scale management
- **Custom report builder** - User-defined metrics and visualizations

### 🤝 Contributing
This project welcomes contributions! The service-based architecture makes it easy to:
- Add new data sources by creating service classes
- Extend reporting with new analysis types  
- Improve CLI with additional commands
- Enhance the web dashboard with new features

---
## 📚 Additional Resources

### Command Reference
```bash
ai-metrics-report reports --help
```

### Useful NPM Scripts
```bash
npm run report:one-shot        # Complete report generation
npm run dashboard              # Start web interface
```

---
*Questions, feedback, or contributions are always welcome! 🎉*
