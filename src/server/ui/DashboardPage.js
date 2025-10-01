export function DashboardPage({ title, metrics, schedulerStatus }) {
  const formatDate = (dateStr) => {
    if (!dateStr) return 'N/A';
    return new Date(dateStr).toLocaleString();
  };

  const formatDuration = (start, end) => {
    if (!start || !end) return 'N/A';
    const duration = new Date(end) - new Date(start);
    return `${Math.round(duration / 1000)}s`;
  };

  const githubActivityRate = metrics?.github?.totalSeats > 0 
    ? Math.round((metrics.github.activeUsers / metrics.github.totalSeats) * 100)
    : 0;

  const cursorActivityRate = metrics?.cursor?.totalUsers > 0 
    ? Math.round((metrics.cursor.activeUsers / metrics.cursor.totalUsers) * 100)
    : 0;

  const statusClass = schedulerStatus?.running ? 'status-running' : 
                     schedulerStatus?.error ? 'status-error' : 'status-completed';
  
  const statusText = schedulerStatus?.running ? 'Running' : 
                    schedulerStatus?.error ? 'Error' : 'Ready';

  return `<!DOCTYPE html>
<html>
  <head>
    <title>${title}</title>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <style>
      * { box-sizing: border-box; margin: 0; padding: 0; }
      body { 
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        background: #f5f5f5;
        color: #333;
        line-height: 1.6;
      }
      .container { max-width: 1200px; margin: 0 auto; padding: 20px; }
      .header { 
        background: white; 
        padding: 20px; 
        border-radius: 8px; 
        margin-bottom: 20px;
        box-shadow: 0 2px 4px rgba(0,0,0,0.1);
      }
      .header h1 { color: #2c3e50; margin-bottom: 10px; }
      .header .subtitle { color: #7f8c8d; }
      .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 20px; }
      .card { 
        background: white; 
        padding: 20px; 
        border-radius: 8px;
        box-shadow: 0 2px 4px rgba(0,0,0,0.1);
      }
      .card h2 { color: #2c3e50; margin-bottom: 15px; font-size: 1.2em; }
      .metric { 
        display: flex; 
        justify-content: space-between; 
        align-items: center;
        padding: 10px 0;
        border-bottom: 1px solid #ecf0f1;
      }
      .metric:last-child { border-bottom: none; }
      .metric-label { color: #7f8c8d; }
      .metric-value { 
        font-weight: bold; 
        font-size: 1.1em;
        color: #2c3e50;
      }
      .metric-value.active { color: #27ae60; }
      .metric-value.inactive { color: #e74c3c; }
      .status-badge {
        display: inline-block;
        padding: 4px 8px;
        border-radius: 4px;
        font-size: 0.8em;
        font-weight: bold;
        text-transform: uppercase;
      }
      .status-running { background: #f39c12; color: white; }
      .status-completed { background: #27ae60; color: white; }
      .status-error { background: #e74c3c; color: white; }
      .actions { margin-top: 20px; }
      .btn {
        background: #3498db;
        color: white;
        border: none;
        padding: 10px 20px;
        border-radius: 4px;
        cursor: pointer;
        margin-right: 10px;
        text-decoration: none;
        display: inline-block;
      }
      .btn:hover { background: #2980b9; }
      .btn-secondary { background: #95a5a6; }
      .btn-secondary:hover { background: #7f8c8d; }
      .logs {
        background: #2c3e50;
        color: #ecf0f1;
        padding: 15px;
        border-radius: 4px;
        font-family: 'Courier New', monospace;
        font-size: 0.9em;
        max-height: 300px;
        overflow-y: auto;
        margin-top: 15px;
      }
      .log-entry {
        margin-bottom: 5px;
        padding: 2px 0;
      }
      .timestamp { color: #bdc3c7; }
      .auto-refresh {
        position: fixed;
        top: 20px;
        right: 20px;
        background: white;
        padding: 10px;
        border-radius: 4px;
        box-shadow: 0 2px 4px rgba(0,0,0,0.1);
      }
      .report-link {
        color: #27ae60 !important;
        text-decoration: none !important;
        font-weight: bold;
        padding: 4px 8px;
        border-radius: 3px;
        transition: background-color 0.2s;
      }
      .report-link:hover {
        background-color: rgba(39, 174, 96, 0.1);
        text-decoration: underline !important;
      }
      .report-updated {
        color: #7f8c8d;
        font-size: 0.85em;
        margin-top: 2px;
        display: block;
      }
    </style>
  </head>
  <body>
    <div class="container">
      <div class="header">
        <h1>${title}</h1>
        <div class="subtitle">
          Last updated: ${formatDate(metrics?.timestamp)} | 
          Next scheduled run: ${formatDate(schedulerStatus?.nextRun)}
        </div>
      </div>

      <div class="auto-refresh">
        <label>
          <input type="checkbox" id="autoRefresh" /> Auto-refresh (30s)
        </label>
      </div>

      <div class="grid">
        <!-- GitHub Metrics -->
        <div class="card">
          <h2>📊 GitHub Copilot</h2>
          <div class="metric">
            <span class="metric-label">Total Seats</span>
            <span class="metric-value">${metrics?.github?.totalSeats || 0}</span>
          </div>
          <div class="metric">
            <span class="metric-label">Active Users (7 days)</span>
            <span class="metric-value active">${metrics?.github?.activeUsers || 0}</span>
          </div>
          <div class="metric">
            <span class="metric-label">Inactive Users</span>
            <span class="metric-value inactive">${metrics?.github?.inactiveUsers || 0}</span>
          </div>
          <div class="metric">
            <span class="metric-label">Activity Rate</span>
            <span class="metric-value">${githubActivityRate}%</span>
          </div>
        </div>

        <!-- Cursor Metrics -->
        <div class="card">
          <h2>🎯 Cursor</h2>
          <div class="metric">
            <span class="metric-label">Total Users</span>
            <span class="metric-value">${metrics?.cursor?.totalUsers || 0}</span>
          </div>
          <div class="metric">
            <span class="metric-label">Active Users (7 days)</span>
            <span class="metric-value active">${metrics?.cursor?.activeUsers || 0}</span>
          </div>
          <div class="metric">
            <span class="metric-label">Inactive Users</span>
            <span class="metric-value inactive">${metrics?.cursor?.inactiveUsers || 0}</span>
          </div>
          <div class="metric">
            <span class="metric-label">Activity Rate</span>
            <span class="metric-value">${cursorActivityRate}%</span>
          </div>
        </div>

        <!-- Scheduler Status -->
        <div class="card">
          <h2>⚙️ Scheduler Status</h2>
          <div class="metric">
            <span class="metric-label">Status</span>
            <span class="status-badge ${statusClass}">${statusText}</span>
          </div>
          <div class="metric">
            <span class="metric-label">Last Run</span>
            <span class="metric-value">${formatDate(schedulerStatus?.finished)}</span>
          </div>
          <div class="metric">
            <span class="metric-label">Duration</span>
            <span class="metric-value">
              ${formatDuration(schedulerStatus?.started, schedulerStatus?.finished)}
            </span>
          </div>
          <div class="metric">
            <span class="metric-label">Next Run</span>
            <span class="metric-value">${formatDate(schedulerStatus?.nextRun)}</span>
          </div>
          
          <div class="actions">
            <button class="btn" onclick="triggerCollection()">Trigger Now</button>
            <a href="/api/scheduler/status" class="btn btn-secondary">View Logs</a>
          </div>
        </div>

        <!-- Reports Status -->
        <div class="card">
          <h2>📋 Reports</h2>
          <div class="metric">
            <span class="metric-label">Active Users Report</span>
            <span class="metric-value">
              ${metrics?.reports?.activeUsersReport ? 
                `<a href="/report/active-users.md" class="report-link">View Report</a> 
                 <span class="report-updated">Updated: ${formatDate(metrics.reports.activeUsersReport.lastModified)}</span>` 
                : 'Not available'}
            </span>
          </div>
          <div class="metric">
            <span class="metric-label">AI Tooling Report</span>
            <span class="metric-value">
              ${metrics?.reports?.aiToolingReport ? 
                `<a href="/report/ai-tooling-adoption-report.md" class="report-link">View Report</a>
                 <span class="report-updated">Updated: ${formatDate(metrics.reports.aiToolingReport.lastModified)}</span>` 
                : 'Not available'}
            </span>
          </div>
          <div class="metric">
            <span class="metric-label">Recent Activity Report</span>
            <span class="metric-value">
              ${metrics?.reports?.recentActivityReport ? 
                `<a href="/report/recent-activity-analysis.md" class="report-link">View Report</a>
                 <span class="report-updated">Updated: ${formatDate(metrics.reports.recentActivityReport.lastModified)}</span>` 
                : 'Not available'}
            </span>
          </div>
          
          <div class="actions">
            <a href="/files" class="btn btn-secondary">All Files</a>
            <a href="/api/metrics/history" class="btn btn-secondary">Raw Data</a>
          </div>
        </div>
      </div>

      ${schedulerStatus?.logs && schedulerStatus.logs.length > 0 ? `
      <!-- Recent Logs -->
      <div class="card" style="margin-top: 20px;">
        <h2>📝 Recent Activity</h2>
        <div class="logs">
          ${schedulerStatus.logs.slice(-10).map(log => 
            `<div class="log-entry">
              <span class="timestamp">${formatDate(log.ts)}</span> ${log.msg}
            </div>`
          ).join('')}
        </div>
      </div>
      ` : ''}
    </div>

    <script>
      let autoRefreshInterval;
      
      function triggerCollection() {
        fetch('/api/scheduler/trigger', { method: 'POST' })
          .then(response => response.json())
          .then(data => {
            if (data.started) {
              alert('Data collection started successfully!');
              setTimeout(() => location.reload(), 2000);
            } else {
              alert('Error: ' + (data.error || 'Unknown error'));
            }
          })
          .catch(error => {
            alert('Error: ' + error.message);
          });
      }
      
      document.getElementById('autoRefresh').addEventListener('change', function(e) {
        if (e.target.checked) {
          autoRefreshInterval = setInterval(() => {
            location.reload();
          }, 30000);
        } else {
          clearInterval(autoRefreshInterval);
        }
      });
    </script>
  </body>
</html>`;
}