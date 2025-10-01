# AI Metrics Live Dashboard Setup

This guide explains how to set up the live dashboard with automated data collection and web-based visualization.

## Features

- **Automated Data Collection**: Runs every 6 hours via cron scheduler
- **Real-time Metrics API**: REST endpoints for current and historical metrics
- **Web Dashboard**: Built-in web interface for viewing metrics
- **Manual Triggers**: Ability to manually trigger data collection

## Quick Start

### 1. Prerequisites

Ensure you have:
- Node.js ≥ 18.17
- Environment variables set in `.env`:
  ```
  GH_ORG=your-org
  GH_TOKEN=ghp_xxxxx
  CURSOR_API_KEY=cursor_xxxxx
  ```

### 2. Start the Dashboard

```bash
# Start the dashboard server
npm run dashboard

# Or use the start command directly:
npm start
```

### 3. Access the Dashboard

- **Web Dashboard**: http://localhost:3000
- **API Endpoints**: http://localhost:3000/api/

## Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Cron Job      │    │   Node.js API   │    │   Web Dashboard │
│   (Every 6h)    │───▶│   (Port 3000)   │◀──▶│   (Built-in UI) │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         ▼                       ▼                       ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│  Data Sources   │    │  Metrics Store  │    │   Dashboard     │
│  • GitHub API   │    │  data/metrics/  │    │   Visualizations│
│  • Cursor API   │    │  • snapshots    │    │   • Tables      │
└─────────────────┘    │  • latest.json  │    │   • Reports     │
                       └─────────────────┘    │   • Charts      │
                                              └─────────────────┘
```

## API Endpoints

### Scheduler Management
- `GET /api/scheduler/status` - Get scheduler status and logs
- `POST /api/scheduler/trigger` - Manually trigger data collection

### Metrics Data
- `GET /api/metrics` - Get current metrics snapshot
- `GET /api/metrics/history` - Get historical metrics

## Cron Schedule

The system automatically collects data every 6 hours:
- **Schedule**: `0 */6 * * *` (at minute 0 of every 6th hour)
- **Timezone**: America/New_York (configurable)
- **Next Run**: Check `/api/scheduler/status` for next scheduled run

## Data Collection Process

Each scheduled run performs:

1. **GitHub Data Collection**:
   - Fetch Copilot seat assignments
   - Fetch activity metrics (last 7 days)
   - Update user lookup tables

2. **Cursor Data Collection**:
   - Fetch team members
   - Fetch weekly activity reports
   - Fetch usage events and spend data

3. **Report Generation**:
   - Active users report
   - AI tooling adoption report
   - Recent activity analysis

4. **Metrics Storage**:
   - Create timestamped snapshot in `data/metrics/`
   - Update `latest.json` for quick access
   - Store in JSON format for API access

## Web Dashboard

### Built-in Dashboard Features

**Displays Include**:
- **Active Users Summary**: Current GitHub and Cursor active users
- **Usage Statistics**: Total seats and utilization rates
- **Historical Data**: Trends over time
- **Recent Activity**: Latest user activity analysis
- **Reports**: Generated markdown reports with detailed insights

## Manual Operations

### Trigger Data Collection
```bash
# Via API
curl -X POST http://localhost:3000/api/scheduler/trigger

# Via existing scripts
npm run report:one-shot
```

### Check Scheduler Status
```bash
curl http://localhost:3000/api/scheduler/status
```

### View Logs
```bash
# Application logs
tail -f logs/dashboard.log
```

## Data Storage

### File Structure
```
data/
├── metrics/
│   ├── snapshot_2025-09-15T10-00-00-000Z.json
│   ├── snapshot_2025-09-15T16-00-00-000Z.json
│   └── latest.json
├── github/
│   └── copilot-seat-assignments_*.json
└── cursor/
    ├── weekly-report_*.json
    └── team-members.json

logs/
└── dashboard.log
```

### Metrics Schema
```json
{
  "timestamp": "2025-09-15T10:00:00.000Z",
  "github": {
    "totalSeats": 43,
    "activeUsers": 36,
    "inactiveUsers": 7
  },
  "cursor": {
    "totalUsers": 25,
    "activeUsers": 18,
    "inactiveUsers": 7
  },
  "reports": {
    "activeUsersReport": {
      "lastModified": "2025-09-15T09:30:00.000Z",
      "size": 15420
    }
  }
}
```

## Troubleshooting

### Common Issues

**1. Dashboard not loading**
- Check that Node.js server is running on port 3000
- Verify no other application is using port 3000
- Check server logs for startup errors

**2. No data in dashboard**
- Trigger manual data collection: `POST /api/scheduler/trigger`
- Check if metrics files exist in `data/metrics/`
- Verify API endpoints return data: `GET /api/metrics`

**3. Scheduler not running**
- Check server logs for cron initialization
- Verify timezone settings
- Check `/api/scheduler/status` for error messages

**4. Data collection fails**
- Verify environment variables are set correctly
- Check API token permissions (GitHub needs `manage_billing:copilot`)
- Review logs in `logs/dashboard.log`

### Reset Everything
```bash
# Stop the server (Ctrl+C if running in foreground)

# Clear data and logs
rm -rf data/metrics logs/dashboard.log

# Restart
npm run dashboard
```

## Configuration

### Environment Variables
```bash
# Required
GH_ORG=your-organization
GH_TOKEN=ghp_your_github_token
CURSOR_API_KEY=cursor_your_api_key

# Optional
PORT=3000
NODE_ENV=development
```

### Cron Schedule Customization
Edit `src/server/index.js` to change the schedule:
```javascript
// Every 6 hours (default)
cron.schedule('0 */6 * * *', ...)

// Every hour
cron.schedule('0 * * * *', ...)

// Every day at 9 AM
cron.schedule('0 9 * * *', ...)
```

### Dashboard Customization
- Modify the web dashboard by editing files in `src/server/ui/`
- Add new API endpoints in `src/server/index.js`
- Customize reports by editing scripts in the `scripts/` directory

## Production Considerations

For production deployment, consider:

1. **Process Management**: Use PM2 or systemd to manage the Node.js process
2. **Reverse Proxy**: Use Nginx to handle SSL and routing
3. **Monitoring**: Set up alerts for failed data collection
4. **Backup**: Regular backup of metrics data and configuration files
5. **Security**: Implement authentication and restrict access as needed

## Support

For issues or questions:
1. Check the troubleshooting section above
2. Review logs in `logs/dashboard.log`
3. Check API endpoints manually with curl
4. Verify the Node.js server is running properly
