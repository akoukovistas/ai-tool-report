import path from 'node:path';
import { existsSync, readdirSync, writeFileSync } from 'node:fs';
import { ensureDir, readJSON, writeJSON, writeCSV } from '../common/fs.js';
import { discoverLatestMonthlyActivity, discoverLatestDailyActivity, parseDate, NUMERIC_FIELDS, iso } from './util.js';

const OUT_DIR = 'output/csv/cursor';

/**
 * Aggregate monthly activity data into a window-based user summary
 * Creates a rolling window summary of user activity across a 30-day period
 */
export async function aggregateWindow() {
  const latest = discoverLatestMonthlyActivity();
  if (!latest) {
    throw new Error('No monthly activity data found');
  }

  const data = readJSON(latest);
  // Validate data structure and size
  if (!Array.isArray(data.data)) {
    throw new Error('Malformed activity data: data.data is not an array');
  }
  if (data.data.length > 100000) {
    throw new Error('Activity data too large to process safely');
  }
  const rows = data.data;
  const byUser = new Map();
  const allDates = new Set();

  // Process each activity record
  for (const record of rows) {
    const date = parseDate(record.date);
    if (date) {
      allDates.add(date.getTime());
    }

    const userId = record.userId || 'UNKNOWN';
    let userRecord = byUser.get(userId);

    // Initialize user record if not exists
    if (!userRecord) {
      userRecord = {
        userId: userId,
        email: record.email || '',
        _present: new Set(),
        _active: new Set()
      };
      byUser.set(userId, userRecord);
    }

    // Aggregate numeric fields
    for (const field of NUMERIC_FIELDS) {
      if (typeof record[field] === 'number') {
        userRecord[field] = (userRecord[field] || 0) + record[field];
      }
    }

    // Track presence and activity by date
    if (date) {
      userRecord._present.add(date.toDateString());
      if (record.isActive) {
        userRecord._active.add(date.toDateString());
      }
    }
  }

  // Calculate window metrics
  const dates = [...allDates].sort();
  const windowStart = new Date(dates[0]);
  const windowEnd = new Date(dates.at(-1));
  const windowDays = Math.floor((windowEnd - windowStart) / 86400000) + 1;

  // Prepare CSV output
  const header = [
    'userId', 'email', 'windowStart', 'windowEnd', 'windowDays',
    'presentDays', 'daysActive', 'presenceRate', 'activeRate', 
    'avgLinesAddedPerActiveDay', ...NUMERIC_FIELDS
  ];

  ensureDir(OUT_DIR);
  const lines = [header.join(',')];

  // Generate CSV rows for each user
  const sortedUsers = [...byUser.values()].sort((a, b) => a.userId.localeCompare(b.userId));
  
  for (const userRecord of sortedUsers) {
    const presentDays = userRecord._present.size;
    const activeDays = userRecord._active.size;

    // Calculate derived metrics
    userRecord.windowStart = iso(windowStart);
    userRecord.windowEnd = iso(windowEnd);
    userRecord.windowDays = windowDays;
    userRecord.presentDays = presentDays;
    userRecord.daysActive = activeDays;
    userRecord.presenceRate = (presentDays / windowDays).toFixed(4);
    userRecord.activeRate = (activeDays / windowDays).toFixed(4);
    userRecord.avgLinesAddedPerActiveDay = activeDays 
      ? (userRecord.totalLinesAdded / activeDays).toFixed(2) 
      : '0.00';

    // Generate CSV row
    const csvRow = header.map(field => userRecord[field] ?? '').join(',');
    lines.push(csvRow);
  }

  // Write output file
  const outputFile = path.join(OUT_DIR, 'cursor_window_usage.csv');
  writeFileSync(outputFile, '\uFEFF' + lines.join('\n'), 'utf8');
  
  console.log(`Wrote ${byUser.size} rows -> ${outputFile} (30-day user summary)`);
}

/**
 * Aggregate activity data by calendar month for each user
 * Creates monthly summaries showing user activity patterns over time
 */
export async function aggregateMonthly() {
  const allFiles = [];
  
  // Check legacy flat structure
  const legacyDir = 'data/cursor/monthly-activity';
  if (existsSync(legacyDir)) {
    const files = readdirSync(legacyDir)
      .filter(f => f.startsWith('monthly-activity_') || f.startsWith('monthly-report_'))
      .map(f => path.join(legacyDir, f));
    allFiles.push(...files);
  }
  
  // Check new date-structured format: data/cursor/YYYY/MM/
  const baseDir = 'data/cursor';
  if (existsSync(baseDir)) {
    const years = readdirSync(baseDir).filter(f => /^\d{4}$/.test(f));
    
    for (const year of years) {
      const yearDir = path.join(baseDir, year);
      if (!existsSync(yearDir)) continue;
      
      const months = readdirSync(yearDir).filter(f => /^\d{2}$/.test(f));
      for (const month of months) {
        const monthDir = path.join(yearDir, month);
        if (!existsSync(monthDir)) continue;
        
        const files = readdirSync(monthDir)
          .filter(f => f.startsWith('monthly_activity_') && f.endsWith('.json'))
          .map(f => path.join(monthDir, f));
        allFiles.push(...files);
      }
    }
  }
  
  if (!allFiles.length) {
    throw new Error('No monthly activity files found');
  }
  
  const monthlyRecords = new Map();
  
  // Process each file and aggregate by user and month
  for (const filePath of allFiles) {
    const data = readJSON(filePath);
    const rows = data.data || [];
    
    for (const record of rows) {
      const date = parseDate(record.date);
      if (!date) continue;
      
      // Get month in YYYY-MM format
      const month = iso(new Date(date.getFullYear(), date.getMonth(), 1)).slice(0, 7);
      const userId = record.userId || 'UNKNOWN';
      const key = `${userId}|${month}`;
      
      let monthlyRecord = monthlyRecords.get(key);
      if (!monthlyRecord) {
        monthlyRecord = {
          userId: userId,
          email: record.email || '',
          month: month,
          daysActive: 0,
          totalDays: 0
        };
        
        // Initialize all numeric fields to 0
        for (const field of NUMERIC_FIELDS) {
          monthlyRecord[field] = 0;
        }
        
        monthlyRecords.set(key, monthlyRecord);
      }
      
      // Increment total days and active days
      monthlyRecord.totalDays += 1;
      if (record.isActive) {
        monthlyRecord.daysActive += 1;
      }
      
      // Aggregate numeric fields
      for (const field of NUMERIC_FIELDS) {
        if (typeof record[field] === 'number') {
          monthlyRecord[field] += record[field];
        }
      }
    }
  }
  
  // Prepare CSV output
  const header = [
    'userId', 'email', 'month', 'daysActive', 'totalDays', 
    'activeRate', 'avgLinesAddedPerActiveDay', ...NUMERIC_FIELDS
  ];
  
  ensureDir(OUT_DIR);
  const lines = [header.join(',')];
  
  // Sort records by userId then month
  const sortedRecords = [...monthlyRecords.values()].sort((a, b) => {
    return a.userId.localeCompare(b.userId) || a.month.localeCompare(b.month);
  });
  
  // Generate CSV rows
  for (const record of sortedRecords) {
    const activeDays = record.daysActive;
    
    // Calculate derived metrics
    record.activeRate = record.totalDays ? (activeDays / record.totalDays).toFixed(4) : '';
    record.avgLinesAddedPerActiveDay = activeDays 
      ? (record.totalLinesAdded / activeDays).toFixed(2) 
      : '0.00';
    
    // Generate CSV row
    const csvRow = header.map(field => record[field] ?? '').join(',');
    lines.push(csvRow);
  }
  
  // Write output file
  const outputFile = path.join(OUT_DIR, 'cursor_monthly_activity_summary.csv');
  writeFileSync(outputFile, '\uFEFF' + lines.join('\n'), 'utf8');
  
  console.log(`Wrote monthly rows -> ${outputFile}`);
}

/**
 * Generate all Cursor CSV exports from available data files
 * Processes team members, daily activity, monthly activity, spend, and usage events
 */
export async function toCSVs() {
  ensureDir(OUT_DIR);

  // Export team members if available
  if (existsSync('data/cursor/team-members.json')) {
    const data = readJSON('data/cursor/team-members.json');
    const teamMembers = data.teamMembers || [];
    writeCSV(
      path.join(OUT_DIR, 'cursor_team_members.csv'),
      ['id', 'name', 'email', 'role'],
      teamMembers
    );
  }

  /**
   * Normalize date/timestamp fields in an object to ISO format
   * Handles both unix timestamps (seconds/milliseconds) and date strings
   */
  function normalizeDates(obj) {
    for (const key of Object.keys(obj)) {
      const value = obj[key];
      if (value == null) continue;

      // Check if field appears to be a date/timestamp field
      if (key === 'date' || /date$/i.test(key) || /At$/.test(key) || /timestamp/i.test(key)) {
        let timestamp = null;

        if (typeof value === 'number') {
          timestamp = value;
        } else if (typeof value === 'string' && /^\d{10,}$/.test(value)) {
          timestamp = Number(value);
        }

        if (timestamp) {
          // Detect if seconds vs milliseconds (assume < 1e12 is seconds)
          if (timestamp < 1e12) {
            timestamp = timestamp * 1000; // Convert to milliseconds
          }

          const date = new Date(timestamp);
          
          // For 'date' fields, use date-only format; otherwise full ISO
          if (key.toLowerCase() === 'date' || /date$/i.test(key)) {
            obj[key] = date.toISOString().slice(0, 10);
          } else {
            obj[key] = date.toISOString();
          }
        }
      }
    }
  }

  // Export daily activity if available
  const latestDaily = discoverLatestDailyActivity();
  if (latestDaily) {
    const data = readJSON(latestDaily);
    const rows = data.data || [];
    
    if (rows.length) {
      // Normalize dates in all rows
      rows.forEach(row => normalizeDates(row));

      // Preferred column order
      const headerPreferences = [
        'date', 'userId', 'email', 'isActive', 'totalLinesAdded', 'totalLinesDeleted',
        'acceptedLinesAdded', 'acceptedLinesDeleted', 'totalApplies', 'totalAccepts',
        'totalRejects', 'totalTabsShown', 'totalTabsAccepted', 'composerRequests',
        'chatRequests', 'agentRequests', 'cmdkUsages', 'subscriptionIncludedReqs',
        'apiKeyReqs', 'usageBasedReqs', 'bugbotUsages', 'mostUsedModel',
        'applyMostUsedExtension', 'tabMostUsedExtension', 'clientVersion'
      ];

      // Find all unique columns across all rows
      const allColumns = new Set();
      rows.forEach(row => {
        Object.keys(row).forEach(key => allColumns.add(key));
      });

      // Build header with preferred columns first, then remaining columns sorted
      const additionalColumns = [...allColumns]
        .filter(col => !headerPreferences.includes(col))
        .sort();
      const header = [...headerPreferences, ...additionalColumns];

      writeCSV(path.join(OUT_DIR, 'cursor_daily_activity.csv'), header, rows);
    }
  }

  // Export monthly activity if available
  const latestMonthly = discoverLatestMonthlyActivity();
  if (latestMonthly) {
    const data = readJSON(latestMonthly);
    const rows = data.data || [];
    
    if (rows.length) {
      // Normalize dates in all rows
      rows.forEach(row => normalizeDates(row));

      // Use same header preferences as daily activity
      const headerPreferences = [
        'date', 'userId', 'email', 'isActive', 'totalLinesAdded', 'totalLinesDeleted',
        'acceptedLinesAdded', 'acceptedLinesDeleted', 'totalApplies', 'totalAccepts',
        'totalRejects', 'totalTabsShown', 'totalTabsAccepted', 'composerRequests',
        'chatRequests', 'agentRequests', 'cmdkUsages', 'subscriptionIncludedReqs',
        'apiKeyReqs', 'usageBasedReqs', 'bugbotUsages', 'mostUsedModel',
        'applyMostUsedExtension', 'tabMostUsedExtension', 'clientVersion'
      ];

      // Find all unique columns
      const allColumns = new Set();
      rows.forEach(row => {
        Object.keys(row).forEach(key => allColumns.add(key));
      });

      const additionalColumns = [...allColumns]
        .filter(col => !headerPreferences.includes(col))
        .sort();
      const header = [...headerPreferences, ...additionalColumns];

      writeCSV(path.join(OUT_DIR, 'cursor_monthly_activity.csv'), header, rows);
    }
  }

  // Export spend data if available
  if (existsSync('data/cursor/spend')) {
    const spendFiles = readdirSync('data/cursor/spend')
      .filter(f => f.startsWith('page-'));
    const spendRecords = [];

    for (const fileName of spendFiles) {
      const data = readJSON(path.join('data/cursor/spend', fileName));
      const teamMemberSpend = data.teamMemberSpend || [];
      
      teamMemberSpend.forEach(record => {
        // Convert cents to dollars for readability
        if (typeof record.spendCents === 'number') {
          record.spendDollars = (record.spendCents / 100).toFixed(2);
        }
        spendRecords.push(record);
      });
    }

    if (spendRecords.length) {
      const spendHeader = [
        'userId', 'name', 'email', 'role', 'spendCents', 'spendDollars',
        'fastPremiumRequests', 'hardLimitOverrideDollars'
      ];
      writeCSV(path.join(OUT_DIR, 'cursor_spend.csv'), spendHeader, spendRecords);
    }
  }

  // Export usage events if available
  if (existsSync('data/cursor/usage-events')) {
    const eventFiles = readdirSync('data/cursor/usage-events')
      .filter(f => f.startsWith('events-'));
    const usageEvents = [];
    const allEventColumns = new Set();

    for (const fileName of eventFiles) {
      const data = readJSON(path.join('data/cursor/usage-events', fileName));
      const events = data.usageEvents || [];
      
      events.forEach(event => {
        // Normalize timestamp fields
        const timestamp = event.timestamp;
        let timestampInt;
        
        if (typeof timestamp === 'string' && /^\d+$/.test(timestamp)) {
          timestampInt = Number(timestamp);
        } else if (typeof timestamp === 'number') {
          timestampInt = timestamp;
        }

        if (timestampInt) {
          // Convert to milliseconds if needed
          if (timestampInt < 1e12) {
            timestampInt *= 1000;
          }
          
          event.timestamp_ms = timestampInt;
          event.timestamp_iso = new Date(timestampInt).toISOString();
          event.date = new Date(timestampInt).toISOString().slice(0, 10);
          event.timestamp = event.timestamp_iso; // Use ISO format as primary timestamp
        }

        // Track all column names
        Object.keys(event).forEach(key => allEventColumns.add(key));
        usageEvents.push(event);
      });
    }

    if (usageEvents.length) {
      // Preferred column order for usage events
      const eventHeaderPreferences = [
        'timestamp_ms', 'timestamp_iso', 'date', 'userEmail', 'model', 'kind',
        'requestsCosts', 'maxMode', 'isTokenBasedCall'
      ];

      const additionalEventColumns = [...allEventColumns]
        .filter(col => !eventHeaderPreferences.includes(col))
        .sort();
      const eventHeader = [...eventHeaderPreferences, ...additionalEventColumns];

      writeCSV(path.join(OUT_DIR, 'cursor_usage_events.csv'), eventHeader, usageEvents);
    }
  }

  // Generate aggregated reports
  await aggregateWindow();
  await aggregateMonthly();

  // Write summary metadata
  writeJSON(path.join(OUT_DIR, 'cursor_csv_summary.json'), {
    done: true,
    generated: Date.now()
  });
}
