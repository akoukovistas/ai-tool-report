# AI Metrics Report - CLI Reference

Complete command-line interface reference for the AI Metrics Report tool.

## Global Options

Available for all commands:

```bash
ai-metrics-report [global-options] <command-group> <command> [command-options]
```

### Global Options
- `-V, --version` - Show version number
- `-v, --verbose` - Enable verbose output
- `--dry-run` - Show what would be done without executing
- `-h, --help` - Display help information

## Command Groups

### Command Groups (public release)

### 📊 Reports & Analysis

#### `reports one-shot`
Generate comprehensive report with fresh data fetch (recommended).

```bash
ai-metrics-report reports one-shot [options]
```

**Options:**
- `--skip-prompt` - Skip all prompts for automated runs (default: false)

**Examples:**
```bash
ai-metrics-report reports one-shot
ai-metrics-report reports one-shot --skip-prompt  # For automation
```

**Output:**
- Fresh data from GitHub and Cursor APIs
- Multiple comprehensive reports in `output/reports/`

#### `reports active-users`
Generate cross-platform active users analysis.

```bash
ai-metrics-report reports active-users [options]
```

**Options:**
- `--skip-prompt` - Skip overwrite prompts (default: false)
- `--data-dir <dir>` - Data directory (default: data)
- `--output-dir <dir>` - Report output directory (default: output/reports)
- `--user-lookup <file>` - User lookup table path (default: data/user-lookup-table.csv)
- `--org-data <file>` - Organizational data path (default: data/org/direct-reports.json)

**Example:**
```bash
ai-metrics-report reports active-users
```

**Output:**
- Report: `output/reports/active-users.md`

#### `reports ai-tooling`
Generate AI tooling adoption analysis.

```bash
ai-metrics-report reports ai-tooling [options]
```

**Options:**
- `--skip-prompt` - Skip overwrite prompts (default: false)
- `--data-dir <dir>` - Data directory (default: data)
- `--output-dir <dir>` - Report output directory (default: output/reports)

**Example:**
```bash
ai-metrics-report reports ai-tooling
```

**Output:**
- Report: `output/reports/ai-tooling-adoption-report.md`

#### `reports recent-activity`
Generate recent activity pattern analysis.

```bash
ai-metrics-report reports recent-activity [options]
```

**Options:**
- `--days <number>` - Number of days to analyze (default: 7)
- `--skip-prompt` - Skip overwrite prompts (default: false)
- `--output-dir <dir>` - Report output directory (default: output/reports)

**Examples:**
```bash
ai-metrics-report reports recent-activity
ai-metrics-report reports recent-activity --days 30
```

**Output:**
- Report: `output/reports/recent-activity-analysis.md`

<!-- github-activity omitted in minimal public release -->

#### `reports all`
Generate all available reports from existing data.

```bash
ai-metrics-report reports all [options]
```

**Options:**
- `--skip-prompt` - Skip all prompts (default: false)
- `--data-dir <dir>` - Data directory (default: data)
- `--output-dir <dir>` - Report output directory (default: output/reports)

**Example:**
```bash
ai-metrics-report reports all --skip-prompt
```

**Output:**
- Multiple reports generated from existing data

---

## Environment Variables

### Required Variables
- `GH_TOKEN` - GitHub personal access token with `manage_billing:copilot` scope
- `GH_ORG` - GitHub organization name
- `CURSOR_API_KEY` - Cursor Admin API key

### Optional Variables
- `PORT` - Web dashboard port (default: 3000)
- `VERBOSE` - Enable verbose output (set by `--verbose` flag)
- `DRY_RUN` - Enable dry-run mode (set by `--dry-run` flag)

## Exit Codes
- `0` - Success
- `1` - General error (with descriptive error message)

## Examples & Common Workflows

### Quick Start
```bash
ai-metrics-report reports one-shot
```

### Data Collection Workflow
Use the one-shot command to fetch data and generate reports:
```bash
ai-metrics-report reports one-shot --skip-prompt
```

### Troubleshooting Workflow
Ensure `.env` is configured, then re-run:
```bash
ai-metrics-report reports one-shot --skip-prompt
```

### Automation Example
```bash
# Automated one-shot (no prompts)
ai-metrics-report reports one-shot --skip-prompt
```

---

## Getting Help

```bash
ai-metrics-report reports --help
```
