import { writeFileSync, existsSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { CursorBaseService } from './CursorBaseService.js';
import { ensureDir, readJSON, writeJSON, writeCSV } from '../../common/fs.js';
import { parseDate, NUMERIC_FIELDS, iso } from '../util.js';

/**
 * Service for generating Cursor reports and data aggregations
 * Handles CSV exports, data analysis, and report generation
 */
export class CursorReportingService extends CursorBaseService {

  constructor(options = {}) {
    super(options);
  }

  /**
   * Generate all CSV reports from available data
   * @param {Object} options - Generation options
   * @returns {Promise<Object>} - Report generation results
   */
  async generateAllReports(options = {}) {
    console.log('🚀 Starting comprehensive Cursor report generation...');
    
    const results = {
      csvFiles: [],
      summaries: [],
      errors: []
    };
    
    try {
      // Generate team members CSV
      try {
        const teamResult = await this.generateTeamMembersCSV();
        if (teamResult) results.csvFiles.push(teamResult);
      } catch (error) {
        results.errors.push({ type: 'team_members', error: error.message });
      }

      // Generate activity CSVs
      try {
        const activityResults = await this.generateActivityCSVs();
        results.csvFiles.push(...activityResults);
      } catch (error) {
        results.errors.push({ type: 'activity', error: error.message });
      }

      // Generate spend CSV
      try {
        const spendResult = await this.generateSpendCSV();
        if (spendResult) results.csvFiles.push(spendResult);
      } catch (error) {
        results.errors.push({ type: 'spend', error: error.message });
      }

      // Generate usage events CSV
      try {
        const eventsResult = await this.generateUsageEventsCSV();
        if (eventsResult) results.csvFiles.push(eventsResult);
      } catch (error) {
        results.errors.push({ type: 'usage_events', error: error.message });
      }

      // Generate aggregated reports
      try {
        const aggResults = await this.generateAggregatedReports();
        results.csvFiles.push(...aggResults);
        results.summaries.push(...aggResults);
      } catch (error) {
        results.errors.push({ type: 'aggregated', error: error.message });
      }

      // Generate summary metadata
      const summaryPath = await this.generateSummaryMetadata(results);
      results.summaryPath = summaryPath;

      console.log(`✅ Report generation completed: ${results.csvFiles.length} files generated`);
      if (results.errors.length > 0) {
        console.log(`⚠️  ${results.errors.length} error(s) occurred`);
      }

      return results;

    } catch (error) {
      console.error('❌ Failed to generate reports:', error.message);
      throw error;
    }
  }

  /**
   * Generate team members CSV
   * @returns {Promise<string|null>} - CSV file path or null if no data
   */
  async generateTeamMembersCSV() {
    const teamFile = path.join(this.config.dataDir, 'team-members.json');
    
    if (!existsSync(teamFile)) {
      console.log('⚠️  No team members data found, skipping CSV generation');
      return null;
    }

    const data = readJSON(teamFile);
    const members = data.teamMembers || [];
    
    if (!members.length) {
      console.log('⚠️  No team members in data, skipping CSV generation');
      return null;
    }

    ensureDir(this.config.outputDir);
    const csvPath = path.join(this.config.outputDir, 'cursor_team_members.csv');
    
    const headers = ['id', 'name', 'email', 'role'];
    writeCSV(csvPath, headers, members);
    
    console.log(`✅ Generated team members CSV: ${csvPath}`);
    return csvPath;
  }

  /**
   * Generate activity CSVs (daily and monthly)
   * @returns {Promise<Array<string>>} - Array of generated CSV file paths
   */
  async generateActivityCSVs() {
    const csvFiles = [];
    
    // Generate daily activity CSV
    const dailyPath = await this.generateDailyActivityCSV();
    if (dailyPath) csvFiles.push(dailyPath);
    
    // Generate monthly activity CSV  
    const monthlyPath = await this.generateMonthlyActivityCSV();
    if (monthlyPath) csvFiles.push(monthlyPath);
    
    return csvFiles;
  }

  /**
   * Generate daily activity CSV from latest data
   * @returns {Promise<string|null>} - CSV file path or null if no data
   */
  async generateDailyActivityCSV() {
    const latestDaily = this.findLatestFile('daily_activity_*.json');
    
    if (!latestDaily) {
      console.log('⚠️  No daily activity data found, skipping CSV generation');
      return null;
    }

    const data = readJSON(latestDaily);
    const rows = data.data || [];
    
    if (!rows.length) {
      console.log('⚠️  No daily activity records, skipping CSV generation');
      return null;
    }

    // Normalize dates
    rows.forEach(row => this.normalizeDates(row));

    ensureDir(this.config.outputDir);
    const csvPath = path.join(this.config.outputDir, 'cursor_daily_activity.csv');
    
    const headers = this.buildActivityHeaders(rows);
    writeCSV(csvPath, headers, rows);
    
    console.log(`✅ Generated daily activity CSV: ${csvPath} (${rows.length} records)`);
    return csvPath;
  }

  /**
   * Generate monthly activity CSV from latest data
   * @returns {Promise<string|null>} - CSV file path or null if no data
   */
  async generateMonthlyActivityCSV() {
    const latestMonthly = this.findLatestFile('monthly_activity_*.json');
    
    if (!latestMonthly) {
      console.log('⚠️  No monthly activity data found, skipping CSV generation');
      return null;
    }

    const data = readJSON(latestMonthly);
    const rows = data.data || [];
    
    if (!rows.length) {
      console.log('⚠️  No monthly activity records, skipping CSV generation');
      return null;
    }

    // Normalize dates
    rows.forEach(row => this.normalizeDates(row));

    ensureDir(this.config.outputDir);
    const csvPath = path.join(this.config.outputDir, 'cursor_monthly_activity.csv');
    
    const headers = this.buildActivityHeaders(rows);
    writeCSV(csvPath, headers, rows);
    
    console.log(`✅ Generated monthly activity CSV: ${csvPath} (${rows.length} records)`);
    return csvPath;
  }

  /**
   * Generate spend CSV from all spend pages
   * @returns {Promise<string|null>} - CSV file path or null if no data
   */
  async generateSpendCSV() {
    const spendDir = path.join(this.config.dataDir, CursorBaseService.DIRECTORIES.SPEND);
    
    if (!existsSync(spendDir)) {
      console.log('⚠️  No spend data found, skipping CSV generation');
      return null;
    }

    const spendFiles = readdirSync(spendDir)
      .filter(f => f.startsWith('page-') && f.endsWith('.json'))
      .sort();
    
    if (!spendFiles.length) {
      console.log('⚠️  No spend files found, skipping CSV generation');
      return null;
    }

    const allSpendRecords = [];
    
    for (const fileName of spendFiles) {
      const data = readJSON(path.join(spendDir, fileName));
      const records = data.teamMemberSpend || [];
      
      records.forEach(record => {
        // Convert cents to dollars for readability
        if (typeof record.spendCents === 'number') {
          record.spendDollars = (record.spendCents / 100).toFixed(2);
        }
        allSpendRecords.push(record);
      });
    }

    if (!allSpendRecords.length) {
      console.log('⚠️  No spend records found, skipping CSV generation');
      return null;
    }

    ensureDir(this.config.outputDir);
    const csvPath = path.join(this.config.outputDir, 'cursor_spend.csv');
    
    const headers = [
      'userId', 'name', 'email', 'role', 'spendCents', 'spendDollars',
      'fastPremiumRequests', 'hardLimitOverrideDollars'
    ];
    
    writeCSV(csvPath, headers, allSpendRecords);
    
    console.log(`✅ Generated spend CSV: ${csvPath} (${allSpendRecords.length} records)`);
    return csvPath;
  }

  /**
   * Generate usage events CSV from all event pages
   * @returns {Promise<string|null>} - CSV file path or null if no data
   */
  async generateUsageEventsCSV() {
    const eventsDir = path.join(this.config.dataDir, CursorBaseService.DIRECTORIES.USAGE_EVENTS);
    
    if (!existsSync(eventsDir)) {
      console.log('⚠️  No usage events data found, skipping CSV generation');
      return null;
    }

    const eventFiles = readdirSync(eventsDir)
      .filter(f => f.startsWith('events-') && f.endsWith('.json'))
      .sort();
    
    if (!eventFiles.length) {
      console.log('⚠️  No usage event files found, skipping CSV generation');
      return null;
    }

    const allEvents = [];
    const allEventColumns = new Set();
    
    for (const fileName of eventFiles) {
      const data = readJSON(path.join(eventsDir, fileName));
      const events = data.usageEvents || [];
      
      events.forEach(event => {
        // Normalize timestamp fields
        this.normalizeEventTimestamps(event);
        
        // Track all column names for header generation
        Object.keys(event).forEach(key => allEventColumns.add(key));
        allEvents.push(event);
      });
    }

    if (!allEvents.length) {
      console.log('⚠️  No usage event records found, skipping CSV generation');
      return null;
    }

    ensureDir(this.config.outputDir);
    const csvPath = path.join(this.config.outputDir, 'cursor_usage_events.csv');
    
    // Build header with preferred columns first
    const preferredHeaders = [
      'timestamp_ms', 'timestamp_iso', 'date', 'userEmail', 'model', 'kind',
      'requestsCosts', 'maxMode', 'isTokenBasedCall'
    ];
    
    const additionalHeaders = [...allEventColumns]
      .filter(col => !preferredHeaders.includes(col))
      .sort();
    
    const headers = [...preferredHeaders, ...additionalHeaders];
    
    writeCSV(csvPath, headers, allEvents);
    
    console.log(`✅ Generated usage events CSV: ${csvPath} (${allEvents.length} records)`);
    return csvPath;
  }

  /**
   * Generate aggregated reports (window and monthly summaries)
   * @returns {Promise<Array<string>>} - Array of generated report file paths
   */
  async generateAggregatedReports() {
    const reportFiles = [];
    
    // Generate window summary
    try {
      const windowPath = await this.generateWindowSummary();
      if (windowPath) reportFiles.push(windowPath);
    } catch (error) {
      console.warn('⚠️  Failed to generate window summary:', error.message);
    }
    
    // Generate monthly summary
    try {
      const monthlyPath = await this.generateMonthlySummary();
      if (monthlyPath) reportFiles.push(monthlyPath);
    } catch (error) {
      console.warn('⚠️  Failed to generate monthly summary:', error.message);
    }
    
    return reportFiles;
  }

  /**
   * Generate window-based user activity summary
   * @returns {Promise<string|null>} - CSV file path or null if no data
   */
  async generateWindowSummary() {
    const latestMonthly = this.findLatestFile('monthly_activity_*.json');
    
    if (!latestMonthly) {
      console.log('⚠️  No monthly activity data for window summary');
      return null;
    }

    const data = readJSON(latestMonthly);
    const rows = data.data || [];
    
    if (!rows.length) return null;

    const byUser = new Map();
    const allDates = new Set();

    // Process activity records
    for (const record of rows) {
      const date = parseDate(record.date);
      if (date) allDates.add(date.getTime());

      const userId = record.userId || 'UNKNOWN';
      let userRecord = byUser.get(userId);

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

      // Track presence and activity
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

    // Generate CSV
    ensureDir(this.config.outputDir);
    const csvPath = path.join(this.config.outputDir, 'cursor_window_usage.csv');
    
    const header = [
      'userId', 'email', 'windowStart', 'windowEnd', 'windowDays',
      'presentDays', 'daysActive', 'presenceRate', 'activeRate',
      'avgLinesAddedPerActiveDay', ...NUMERIC_FIELDS
    ];
    
    const lines = [header.join(',')];
    
    for (const userRecord of [...byUser.values()].sort((a, b) => a.userId.localeCompare(b.userId))) {
      const presentDays = userRecord._present.size;
      const activeDays = userRecord._active.size;

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

      const csvRow = header.map(field => userRecord[field] ?? '').join(',');
      lines.push(csvRow);
    }
    
    writeFileSync(csvPath, '\uFEFF' + lines.join('\n'), 'utf8');
    
    console.log(`✅ Generated window summary: ${csvPath} (${byUser.size} users)`);
    return csvPath;
  }

  /**
   * Generate monthly activity summary
   * @returns {Promise<string|null>} - CSV file path or null if no data
   */
  async generateMonthlySummary() {
    const monthlyFiles = this.findAllFiles('monthly_activity_*.json');
    
    if (!monthlyFiles.length) {
      console.log('⚠️  No monthly activity files for summary');
      return null;
    }

    const monthlyRecords = new Map();
    
    // Process all monthly files
    for (const filePath of monthlyFiles) {
      const data = readJSON(filePath);
      const rows = data.data || [];
      
      for (const record of rows) {
        const date = parseDate(record.date);
        if (!date) continue;
        
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
          
          for (const field of NUMERIC_FIELDS) {
            monthlyRecord[field] = 0;
          }
          
          monthlyRecords.set(key, monthlyRecord);
        }
        
        monthlyRecord.totalDays += 1;
        if (record.isActive) {
          monthlyRecord.daysActive += 1;
        }
        
        for (const field of NUMERIC_FIELDS) {
          if (typeof record[field] === 'number') {
            monthlyRecord[field] += record[field];
          }
        }
      }
    }

    // Generate CSV
    ensureDir(this.config.outputDir);
    const csvPath = path.join(this.config.outputDir, 'cursor_monthly_activity_summary.csv');
    
    const header = [
      'userId', 'email', 'month', 'daysActive', 'totalDays',
      'activeRate', 'avgLinesAddedPerActiveDay', ...NUMERIC_FIELDS
    ];
    
    const lines = [header.join(',')];
    
    const sortedRecords = [...monthlyRecords.values()].sort((a, b) => {
      return a.userId.localeCompare(b.userId) || a.month.localeCompare(b.month);
    });
    
    for (const record of sortedRecords) {
      const activeDays = record.daysActive;
      
      record.activeRate = record.totalDays ? (activeDays / record.totalDays).toFixed(4) : '';
      record.avgLinesAddedPerActiveDay = activeDays
        ? (record.totalLinesAdded / activeDays).toFixed(2)
        : '0.00';
      
      const csvRow = header.map(field => record[field] ?? '').join(',');
      lines.push(csvRow);
    }
    
    writeFileSync(csvPath, '\uFEFF' + lines.join('\n'), 'utf8');
    
    console.log(`✅ Generated monthly summary: ${csvPath} (${monthlyRecords.size} records)`);
    return csvPath;
  }

  /**
   * Generate summary metadata file
   * @private
   */
  async generateSummaryMetadata(results) {
    ensureDir(this.config.outputDir);
    const summaryPath = path.join(this.config.outputDir, 'cursor_csv_summary.json');
    
    const summaryData = {
      generated_at: new Date().toISOString(),
      files_generated: results.csvFiles.length,
      csv_files: results.csvFiles,
      errors: results.errors,
      service: 'CursorReportingService',
      version: '1.0.0'
    };
    
    writeJSON(summaryPath, summaryData);
    console.log(`✅ Generated summary metadata: ${summaryPath}`);
    
    return summaryPath;
  }

  // Helper methods

  /**
   * Build activity headers with preferred ordering
   * @private
   */
  buildActivityHeaders(rows) {
    const preferred = [
      'date', 'userId', 'email', 'isActive', 'totalLinesAdded', 'totalLinesDeleted',
      'acceptedLinesAdded', 'acceptedLinesDeleted', 'totalApplies', 'totalAccepts',
      'totalRejects', 'totalTabsShown', 'totalTabsAccepted', 'composerRequests',
      'chatRequests', 'agentRequests', 'cmdkUsages', 'subscriptionIncludedReqs',
      'apiKeyReqs', 'usageBasedReqs', 'bugbotUsages', 'mostUsedModel',
      'applyMostUsedExtension', 'tabMostUsedExtension', 'clientVersion'
    ];

    const allColumns = new Set();
    rows.forEach(row => {
      Object.keys(row).forEach(key => allColumns.add(key));
    });

    const additional = [...allColumns]
      .filter(col => !preferred.includes(col))
      .sort();

    return [...preferred, ...additional];
  }

  /**
   * Normalize date/timestamp fields in a record
   * @private
   */
  normalizeDates(obj) {
    for (const key of Object.keys(obj)) {
      const value = obj[key];
      if (value == null) continue;

      if (key === 'date' || /date$/i.test(key) || /At$/.test(key) || /timestamp/i.test(key)) {
        let timestamp = null;

        if (typeof value === 'number') {
          timestamp = value;
        } else if (typeof value === 'string' && /^\d{10,}$/.test(value)) {
          timestamp = Number(value);
        }

        if (timestamp) {
          if (timestamp < 1e12) timestamp *= 1000; // Convert seconds to milliseconds
          const date = new Date(timestamp);

          if (key.toLowerCase() === 'date' || /date$/i.test(key)) {
            obj[key] = date.toISOString().slice(0, 10);
          } else {
            obj[key] = date.toISOString();
          }
        }
      }
    }
  }

  /**
   * Normalize timestamp fields in usage events
   * @private
   */
  normalizeEventTimestamps(event) {
    const timestamp = event.timestamp;
    let timestampInt;

    if (typeof timestamp === 'string' && /^\d+$/.test(timestamp)) {
      timestampInt = Number(timestamp);
    } else if (typeof timestamp === 'number') {
      timestampInt = timestamp;
    }

    if (timestampInt) {
      if (timestampInt < 1e12) timestampInt *= 1000; // Convert to milliseconds

      event.timestamp_ms = timestampInt;
      event.timestamp_iso = new Date(timestampInt).toISOString();
      event.date = new Date(timestampInt).toISOString().slice(0, 10);
      event.timestamp = event.timestamp_iso;
    }
  }

  /**
   * Find latest file matching pattern
   * @private
   */
  findLatestFile(pattern) {
    const files = this.findAllFiles(pattern);
    return files.length > 0 ? files.sort().pop() : null;
  }

  /**
   * Find all files matching pattern
   * @private
   */
  findAllFiles(pattern) {
    const files = [];
    const regex = new RegExp(pattern.replace('*', '.*'));

    const walkDir = (dir) => {
      if (!existsSync(dir)) return;

      try {
        const entries = readdirSync(dir, { withFileTypes: true });

        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name);

          if (entry.isDirectory()) {
            walkDir(fullPath);
          } else if (entry.isFile() && regex.test(entry.name)) {
            files.push(fullPath.replace(/\\/g, '/'));
          }
        }
      } catch (error) {
        // Skip directories we can't read
      }
    };

    walkDir(this.config.dataDir);
    return files;
  }
}
