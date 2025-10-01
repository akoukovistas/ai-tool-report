import { readFileSync, existsSync, readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { GitHubSeatsService } from './GitHubSeatsService.js';
import { parseConfig, ensureDir } from '../utils/common.js';

/**
 * Service for analyzing GitHub Copilot data and generating insights
 */
export class GitHubAnalysisService {
  constructor(options = {}) {
    this.config = { ...parseConfig(), ...options };
    this.seatsService = new GitHubSeatsService(options);
    this.userLookup = new Map();
    this.loadUserLookup();
  }

  /**
   * Load user lookup table from CSV file
   * @private
   */
  loadUserLookup() {
    const lookupPath = this.config.userLookupPath || 'data/user-lookup-table.csv';
    if (!existsSync(lookupPath)) {
      console.warn(`[warn] User lookup table not found at ${lookupPath}`);
      return;
    }

    try {
      const content = readFileSync(lookupPath, 'utf8');
      const lines = content.split('\n').filter(line => line.trim());
      
      // Skip header row
      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        
        const columns = line.split(',');
        if (columns.length >= 3) {
          const fullName = columns[0].trim();
          const githubLogin = columns[2].trim();
          
          if (githubLogin && fullName) {
            this.userLookup.set(githubLogin, {
              fullName,
              workEmail: columns[1]?.trim() || '',
              role: columns[3]?.trim() || '',
              hasCopilot: columns[4]?.trim().toLowerCase() === 'true',
              hasCursor: columns[5]?.trim().toLowerCase() === 'true'
            });
          }
        }
      }
      
      console.log(`[info] Loaded ${this.userLookup.size} user mappings from lookup table`);
    } catch (error) {
      console.warn(`[warn] Failed to load user lookup table: ${error.message}`);
    }
  }

  /**
   * Get full name for a GitHub login, falling back to enriched name or login
   * @param {Object} assignee - Seat assignee object
   * @returns {string} - Full name or fallback
   */
  getDisplayName(assignee) {
    if (!assignee) return 'Unknown';
    
    const login = assignee.login;
    if (!login) return 'Unknown';
    
    // Try user lookup table first
    const lookupData = this.userLookup.get(login);
    if (lookupData && lookupData.fullName) {
      return lookupData.fullName;
    }
    
    // Fall back to enriched name from GitHub API
    if (assignee.enriched_name) {
      return assignee.enriched_name;
    }
    
    // Fall back to login
    return login;
  }

  /**
   * Get the path to today's seat assignments file
   * @param {string} org - Organization name
   * @returns {string|null} - File path if exists, null otherwise
   */
  getTodaysSeatsFile(org) {
    const today = new Date().toISOString().split('T')[0];
    const year = today.split('-')[0];
    const month = today.split('-')[1];
    const day = today.split('-')[2];
    
    const dataDir = this.config.dataDir || 'data/github';
    const todayDir = path.join(dataDir, year, month, day);
    
    if (!existsSync(todayDir)) {
      return null;
    }

    // Look for today's seat assignments file
    const expectedFilename = `copilot-seats_${org}_${today}_to_${today}.json`;
    const filePath = path.join(todayDir, expectedFilename);
    
    return existsSync(filePath) ? filePath : null;
  }

  /**
   * Get the most recent seat assignments file for an organization
   * @param {string} org - Organization name
   * @returns {string|null} - Path to most recent file, null if none found
   */
  getLatestSeatsFile(org) {
    const dataDir = this.config.dataDir || 'data/github';
    
    if (!existsSync(dataDir)) {
      return null;
    }

    const seatsFiles = [];
    
    // Recursively find all seat assignment files
    function walkDirectory(dir) {
      let entries = [];
      try {
        entries = readdirSync(dir, { withFileTypes: true });
      } catch {
        return;
      }
      
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          walkDirectory(fullPath);
        } else if (
          entry.isFile() && 
          entry.name.startsWith(`copilot-seats_${org}_`) &&
          entry.name.endsWith('.json')
        ) {
          seatsFiles.push({
            path: fullPath,
            name: entry.name,
            // Extract date from filename for sorting
            date: entry.name.match(/(\d{4}-\d{2}-\d{2})/)?.[1] || '1970-01-01'
          });
        }
      }
    }
    
    walkDirectory(dataDir);
    
    if (seatsFiles.length === 0) {
      return null;
    }

    // Sort by date descending and return the most recent
    seatsFiles.sort((a, b) => b.date.localeCompare(a.date));
    return seatsFiles[0].path;
  }

  /**
   * Get the most recent metrics file for an organization
   * @param {string} org - Organization name
   * @returns {string|null} - Path to most recent metrics file, null if none found
   */
  getLatestMetricsFile(org) {
    const dataDir = this.config.dataDir || 'data/github';
    const metricsDir = path.join(dataDir, 'metrics');
    
    if (!existsSync(metricsDir)) {
      return null;
    }

    const metricsFiles = [];
    
    // Recursively find all metrics files
    function walkDirectory(dir) {
      let entries = [];
      try {
        entries = readdirSync(dir, { withFileTypes: true });
      } catch {
        return;
      }
      
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          walkDirectory(fullPath);
        } else if (
          entry.isFile() && 
          entry.name.startsWith(`copilot-metrics_${org}_`) &&
          entry.name.endsWith('.json')
        ) {
          // Extract date from filename for sorting
          const dateMatch = entry.name.match(/(\d{4}-\d{2}-\d{2})_to_(\d{4}-\d{2}-\d{2})\.json$/);
          const endDate = dateMatch ? dateMatch[2] : '1970-01-01';
          
          metricsFiles.push({
            path: fullPath,
            name: entry.name,
            endDate
          });
        }
      }
    }
    
    walkDirectory(metricsDir);
    
    if (metricsFiles.length === 0) {
      return null;
    }

    // Sort by end date descending and return the most recent
    metricsFiles.sort((a, b) => b.endDate.localeCompare(a.endDate));
    return metricsFiles[0].path;
  }

  /**
   * Load metrics data from file
   * @param {string} filePath - Path to the JSON file
   * @returns {Object} - Parsed metrics data
   */
  loadMetricsData(filePath) {
    if (!existsSync(filePath)) {
      throw new Error(`Metrics file not found: ${filePath}`);
    }

    try {
      const content = readFileSync(filePath, 'utf8');
      return JSON.parse(content);
    } catch (error) {
      throw new Error(`Failed to parse metrics file ${filePath}: ${error.message}`);
    }
  }

  /**
   * Calculate total acceptance metrics from metrics data
   * @param {Object} metricsData - Parsed metrics data
   * @returns {Object} - Aggregated metrics
   */
  calculateAcceptanceMetrics(metricsData) {
    let totalLinesSuggested = 0;
    let totalLinesAccepted = 0;
    let totalSuggestions = 0;
    let totalAcceptances = 0;

    if (!metricsData.data || !Array.isArray(metricsData.data)) {
      return {
        totalLinesSuggested: 0,
        totalLinesAccepted: 0,
        totalSuggestions: 0,
        totalAcceptances: 0,
        acceptanceRate: 0,
        lineAcceptanceRate: 0,
        periodStart: null,
        periodEnd: null,
        daysCovered: 0
      };
    }

    // Aggregate across all days and editors
    for (const dayData of metricsData.data) {
      if (dayData.copilot_ide_code_completions?.editors) {
        for (const editor of dayData.copilot_ide_code_completions.editors) {
          if (editor.models) {
            for (const model of editor.models) {
              if (model.languages) {
                for (const language of model.languages) {
                  totalLinesSuggested += language.total_code_lines_suggested || 0;
                  totalLinesAccepted += language.total_code_lines_accepted || 0;
                  totalSuggestions += language.total_code_suggestions || 0;
                  totalAcceptances += language.total_code_acceptances || 0;
                }
              }
            }
          }
        }
      }
    }

    // Calculate rates
    const acceptanceRate = totalSuggestions > 0 ? (totalAcceptances / totalSuggestions) * 100 : 0;
    const lineAcceptanceRate = totalLinesSuggested > 0 ? (totalLinesAccepted / totalLinesSuggested) * 100 : 0;

    return {
      totalLinesSuggested,
      totalLinesAccepted,
      totalSuggestions,
      totalAcceptances,
      acceptanceRate: Math.round(acceptanceRate * 100) / 100, // Round to 2 decimal places
      lineAcceptanceRate: Math.round(lineAcceptanceRate * 100) / 100,
      periodStart: metricsData.meta?.since || null,
      periodEnd: metricsData.meta?.until || null,
      daysCovered: metricsData.data.length
    };
  }

  /**
   * Load seat assignments data from file
   * @param {string} filePath - Path to the JSON file
   * @returns {Object} - Parsed seat assignments data
   */
  loadSeatsData(filePath) {
    if (!existsSync(filePath)) {
      throw new Error(`Seats file not found: ${filePath}`);
    }

    try {
      const content = readFileSync(filePath, 'utf8');
      return JSON.parse(content);
    } catch (error) {
      throw new Error(`Failed to parse seats file ${filePath}: ${error.message}`);
    }
  }

  /**
   * Get team breakdown from seat assignments
   * @param {Array} seats - Array of seat assignment objects
   * @returns {Object} - Team breakdown data
   */
  getTeamBreakdown(seats) {
    const teamStats = new Map();

    for (const seat of seats) {
      const assigningTeam = seat.assigning_team;
      if (!assigningTeam) continue;

      const teamSlug = assigningTeam.slug;
      const teamName = assigningTeam.name;

      if (!teamStats.has(teamSlug)) {
        teamStats.set(teamSlug, {
          slug: teamSlug,
          name: teamName,
          description: assigningTeam.description || '',
          totalSeats: 0,
          users: []
        });
      }

      const team = teamStats.get(teamSlug);
      team.totalSeats++;
      team.users.push({
        login: seat.assignee?.login,
        name: this.getDisplayName(seat.assignee),
        lastActivity: seat.last_activity_at,
        lastActivityEditor: seat.last_activity_editor
      });
    }

    return Object.fromEntries(teamStats);
  }

  /**
   * Get users active within the past N days with team breakdown
   * @param {Array} seats - Array of seat assignment objects
   * @param {number} days - Number of days to look back (default: 7)
   * @returns {Object} - Analysis results with team breakdown
   */
  getActiveUsersInPastDays(seats, days = 7) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);
    cutoffDate.setHours(0, 0, 0, 0); // Start of day

    const activeUsers = [];
    const inactiveUsers = [];

    for (const seat of seats) {
      const login = seat.assignee?.login;
      const name = this.getDisplayName(seat.assignee);
      const lastActivity = seat.last_activity_at;

      const userInfo = {
        login,
        name,
        lastActivity: lastActivity || null,
        daysSinceActivity: null,
        lastActivityEditor: seat.last_activity_editor || 'Unknown'
      };

      if (!lastActivity) {
        // Users with no activity are considered inactive
        userInfo.daysSinceActivity = null;
        inactiveUsers.push(userInfo);
        continue;
      }

      // Parse the last activity date
      let activityDate;
      try {
        activityDate = new Date(lastActivity);
      } catch {
        // Users with unparseable activity dates are considered inactive
        inactiveUsers.push(userInfo);
        continue;
      }

      const daysSinceActivity = Math.floor((new Date() - activityDate) / (1000 * 60 * 60 * 24));
      userInfo.lastActivity = activityDate.toISOString();
      userInfo.daysSinceActivity = daysSinceActivity;

      if (activityDate >= cutoffDate) {
        activeUsers.push(userInfo);
      } else {
        // Users with activity before the cutoff period are considered inactive
        inactiveUsers.push(userInfo);
      }
    }

    // Sort active users by most recent activity
    activeUsers.sort((a, b) => new Date(b.lastActivity) - new Date(a.lastActivity));
    
    // Sort inactive users by most recent activity (null dates go to end)
    inactiveUsers.sort((a, b) => {
      if (!a.lastActivity && !b.lastActivity) return 0;
      if (!a.lastActivity) return 1;
      if (!b.lastActivity) return -1;
      return new Date(b.lastActivity) - new Date(a.lastActivity);
    });

    // Get team breakdown
    const teamBreakdown = this.getTeamBreakdown(seats);
    
    // Analyze each team
    const teamAnalysis = {};
    for (const [teamSlug, teamData] of Object.entries(teamBreakdown)) {
      const teamActiveUsers = [];
      const teamInactiveUsers = [];

      for (const user of teamData.users) {
        if (!user.lastActivity) {
          teamInactiveUsers.push({
            ...user,
            daysSinceActivity: null
          });
          continue;
        }

        let activityDate;
        try {
          activityDate = new Date(user.lastActivity);
        } catch {
          teamInactiveUsers.push({
            ...user,
            daysSinceActivity: null
          });
          continue;
        }

        const daysSinceActivity = Math.floor((new Date() - activityDate) / (1000 * 60 * 60 * 24));
        const userInfo = {
          ...user,
          lastActivity: activityDate.toISOString(),
          daysSinceActivity
        };

        if (activityDate >= cutoffDate) {
          teamActiveUsers.push(userInfo);
        } else {
          teamInactiveUsers.push(userInfo);
        }
      }

      // Sort users within team
      teamActiveUsers.sort((a, b) => new Date(b.lastActivity) - new Date(a.lastActivity));
      teamInactiveUsers.sort((a, b) => {
        if (!a.lastActivity && !b.lastActivity) return 0;
        if (!a.lastActivity) return 1;
        if (!b.lastActivity) return -1;
        return new Date(b.lastActivity) - new Date(a.lastActivity);
      });

      teamAnalysis[teamSlug] = {
        name: teamData.name,
        slug: teamSlug,
        description: teamData.description,
        totalSeats: teamData.totalSeats,
        activeUsers: {
          count: teamActiveUsers.length,
          percentage: Math.round((teamActiveUsers.length / teamData.totalSeats) * 100),
          users: teamActiveUsers
        },
        inactiveUsers: {
          count: teamInactiveUsers.length,
          percentage: Math.round((teamInactiveUsers.length / teamData.totalSeats) * 100),
          users: teamInactiveUsers
        }
      };
    }

    return {
      totalSeats: seats.length,
      activeUsers: {
        count: activeUsers.length,
        percentage: Math.round((activeUsers.length / seats.length) * 100),
        users: activeUsers
      },
      inactiveUsers: {
        count: inactiveUsers.length,
        percentage: Math.round((inactiveUsers.length / seats.length) * 100),
        users: inactiveUsers
      },
      teamAnalysis,
      analysisConfig: {
        daysLookback: days,
        cutoffDate: cutoffDate.toISOString(),
        analyzedAt: new Date().toISOString()
      }
    };
  }

  /**
   * Analyze active users in the past week, fetching fresh data if needed
   * @param {Object} options - Analysis options
   * @returns {Promise<Object>} - Analysis results with metadata
   */
  async analyzeActiveUsersInPastWeek(options = {}) {
    const { org = this.config.org, days = 7, forceRefresh = false, includeMetrics = true } = options;
    
    if (!org) {
      throw new Error('Organization name is required');
    }

    let seatsData = null;
    let dataSource = null;
    let filePath = null;

    // Check if we should use today's file or force refresh
    if (!forceRefresh) {
      filePath = this.getTodaysSeatsFile(org);
      if (filePath) {
        console.log(`📄 Using today's seat assignments file: ${filePath}`);
        seatsData = this.loadSeatsData(filePath);
        dataSource = 'today_file';
      }
    }

    // If no today's file or force refresh, try to get latest file
    if (!seatsData && !forceRefresh) {
      filePath = this.getLatestSeatsFile(org);
      if (filePath) {
        console.log(`📄 Using latest seat assignments file: ${filePath}`);
        seatsData = this.loadSeatsData(filePath);
        dataSource = 'latest_file';
      }
    }

    // If no file found or force refresh, fetch from API
    if (!seatsData || forceRefresh) {
      console.log(`🔄 Fetching fresh seat assignments from GitHub API for org: ${org}`);
      try {
        const result = await this.seatsService.fetchSeats({ org, ...options });
        seatsData = { seats: result.seats, meta: result.meta };
        filePath = result.jsonPath;
        dataSource = 'api_fresh';
        console.log(`✅ Successfully fetched ${result.count} seat assignments`);
      } catch (error) {
        throw new Error(`Failed to fetch seat assignments from API: ${error.message}`);
      }
    }

    // Perform the analysis
    const analysis = this.getActiveUsersInPastDays(seatsData.seats, days);

    // Load metrics data if requested
    let metricsData = null;
    let metricsFilePath = null;
    let teamMetrics = {};
    
    if (includeMetrics) {
      try {
        metricsFilePath = this.getLatestMetricsFile(org);
        if (metricsFilePath) {
          console.log(`📊 Using metrics file: ${path.basename(metricsFilePath)}`);
          const rawMetricsData = this.loadMetricsData(metricsFilePath);
          metricsData = this.calculateAcceptanceMetrics(rawMetricsData);
        } else {
          console.log(`⚠️  No metrics data found for org: ${org}`);
        }
      } catch (error) {
        console.warn(`⚠️  Failed to load metrics data: ${error.message}`);
      }

      // Fetch team-specific metrics
      if (analysis.teamAnalysis && Object.keys(analysis.teamAnalysis).length > 0) {
        console.log(`📊 Fetching team-specific metrics...`);
        for (const teamSlug of Object.keys(analysis.teamAnalysis)) {
          try {
            const teamRawMetrics = await this.seatsService.client.fetchTeamMetrics(org, teamSlug);
            if (teamRawMetrics && teamRawMetrics.length > 0) {
              teamMetrics[teamSlug] = this.calculateAcceptanceMetrics({ data: teamRawMetrics });
              console.log(`📊 ✓ Team metrics loaded for: ${teamSlug}`);
            } else {
              console.log(`📊 ⚠️  No metrics available for team: ${teamSlug} (may need ≥5 active users)`);
            }
          } catch (error) {
            console.warn(`📊 ⚠️  Failed to load metrics for team ${teamSlug}: ${error.message}`);
          }
        }
      }
    }

    return {
      ...analysis,
      metrics: metricsData,
      teamMetrics,
      metadata: {
        org,
        dataSource,
        filePath,
        metricsFilePath,
        fetchedAt: seatsData.meta?.fetched_at || null,
        totalSeatsFromAPI: seatsData.meta?.total_seats || null
      }
    };
  }

  /**
   * Generate a summary report of active users
   * @param {Object} analysisResult - Result from analyzeActiveUsersInPastWeek
   * @returns {string} - Formatted summary report
   */
  generateSummaryReport(analysisResult) {
    const { activeUsers, inactiveUsers, totalSeats, analysisConfig, metadata, metrics, teamAnalysis, teamMetrics } = analysisResult;
    
    const lines = [];
    lines.push(`🔍 GitHub Copilot Activity Analysis - ${metadata.org}`);
    lines.push(`📅 Analysis Period: Past ${analysisConfig.daysLookback} days (since ${analysisConfig.cutoffDate.split('T')[0]})`);
    const dataSourceDisplay = metadata.filePath ? path.basename(metadata.filePath) : metadata.dataSource;
    lines.push(`📊 Data Source: ${dataSourceDisplay}`);
    lines.push('');
    
    lines.push(`📈 SUMMARY:`);
    lines.push(`  Total Seats: ${totalSeats}`);
    lines.push(`  Active Users (past ${analysisConfig.daysLookback} days): ${activeUsers.count} (${activeUsers.percentage}%)`);
    lines.push(`  Inactive Users: ${inactiveUsers.count} (${inactiveUsers.percentage}%)`);
    
    // Add metrics if available
    if (metrics) {
      lines.push('');
      lines.push(`📊 COPILOT METRICS (${metrics.daysCovered} days):`);
      lines.push(`  Total Suggestions: ${metrics.totalSuggestions.toLocaleString()}`);
      lines.push(`  Total Acceptances: ${metrics.totalAcceptances.toLocaleString()}`);
      lines.push(`  Acceptance Rate: ${metrics.acceptanceRate}%`);
      lines.push(`  Period: ${metrics.periodStart?.split('T')[0]} to ${metrics.periodEnd?.split('T')[0]}`);
    }
    
    lines.push('');

    if (activeUsers.count > 0) {
      lines.push(`✅ ACTIVE USERS (${activeUsers.count}):`);
      for (const user of activeUsers.users) {
        const daysSince = user.daysSinceActivity === 0 ? 'today' : `${user.daysSinceActivity} days ago`;
        lines.push(`  • ${user.name} (@${user.login}) - Last active: ${daysSince} (${user.lastActivityEditor})`);
      }
      lines.push('');
    }

    if (inactiveUsers.count > 0 && inactiveUsers.count <= 15) {
      lines.push(`⚠️  INACTIVE USERS (${inactiveUsers.count}):`);
      for (const user of inactiveUsers.users) {
        const activityInfo = user.daysSinceActivity !== null 
          ? `Last active: ${user.daysSinceActivity} days ago`
          : 'No activity recorded';
        lines.push(`  • ${user.name} (@${user.login}) - ${activityInfo}`);
      }
    } else if (inactiveUsers.count > 15) {
      lines.push(`⚠️  INACTIVE USERS (${inactiveUsers.count}) - showing first 15:`);
      for (const user of inactiveUsers.users.slice(0, 15)) {
        const activityInfo = user.daysSinceActivity !== null 
          ? `Last active: ${user.daysSinceActivity} days ago`
          : 'No activity recorded';
        lines.push(`  • ${user.name} (@${user.login}) - ${activityInfo}`);
      }
        lines.push(`  ... and ${inactiveUsers.count - 15} more`);
    }

    // Add team breakdown if available
    if (teamAnalysis && Object.keys(teamAnalysis).length > 0) {
      lines.push('');
      lines.push(`📋 TEAM BREAKDOWN:`);
      
      for (const [teamSlug, team] of Object.entries(teamAnalysis)) {
        lines.push(`  ${team.name}:`);
        lines.push(`    Active: ${team.activeUsers.count}/${team.totalSeats} (${team.activeUsers.percentage}%)`);
        
        // Add team metrics if available
        if (teamMetrics && teamMetrics[teamSlug]) {
          const tm = teamMetrics[teamSlug];
          lines.push(`    Suggestions: ${tm.totalSuggestions.toLocaleString()}, Acceptance Rate: ${tm.acceptanceRate}%`);
        }
      }
    }

    return lines.join('\n');
  }

  /**
   * Generate and save a structured markdown report
   * @param {Object} analysisResult - Result from analyzeActiveUsersInPastWeek
   * @param {Object} options - Report options
   * @returns {string} - Path to saved report file
   */
  generateMarkdownReport(analysisResult, options = {}) {
    const { activeUsers, inactiveUsers, totalSeats, analysisConfig, metadata, metrics, teamAnalysis, teamMetrics } = analysisResult;
    const { outputDir = 'output/analysis' } = options;
    
    // Ensure output directory exists
    ensureDir(outputDir);
    
    // Generate filename with date
    const reportDate = new Date().toISOString().split('T')[0];
    const fileName = `metrics-report_${reportDate}.md`;
    const filePath = path.join(outputDir, fileName);
    
    // Generate report content
    const lines = [];
    lines.push(`# GitHub Copilot`);
    lines.push(`${activeUsers.count} / ${totalSeats}`);
    lines.push('');
    
    // Add metrics if available
    if (metrics) {
      lines.push(`Total Suggestions: ${metrics.totalSuggestions.toLocaleString()}`);
      lines.push(`Total Acceptances: ${metrics.totalAcceptances.toLocaleString()}`);
      lines.push(`Acceptance Rate: ${metrics.acceptanceRate}%`);
      lines.push('');
    }
    
    // List inactive users
    if (inactiveUsers.count > 0) {
      lines.push(`List of inactive users: ${inactiveUsers.users.map(user => user.name).join(', ')}`);
    } else {
      lines.push('List of inactive users: None');
    }
    lines.push('');
    
    // Add metadata section
    lines.push('---');
    lines.push('');
    lines.push('## Report Details');
    lines.push(`- **Analysis Date**: ${analysisConfig.analyzedAt.split('T')[0]}`);
    lines.push(`- **Analysis Period**: Past ${analysisConfig.daysLookback} days`);
    const markdownDataSourceDisplay = metadata.filePath ? path.basename(metadata.filePath) : metadata.dataSource;
    lines.push(`- **Data Source**: ${markdownDataSourceDisplay}`);
    lines.push(`- **Organization**: ${metadata.org}`);
    if (metadata.fetchedAt) {
      lines.push(`- **Data Fetched**: ${metadata.fetchedAt.split('T')[0]}`);
    }
    lines.push('');
    
    // Add breakdown section
    lines.push('## Breakdown');
    lines.push(`- **Active Users**: ${activeUsers.count} (${activeUsers.percentage}%)`);
    lines.push(`- **Inactive Users**: ${inactiveUsers.count} (${inactiveUsers.percentage}%)`);
    
    // Add metrics breakdown if available
    if (metrics) {
      lines.push('');
      lines.push('## Copilot Metrics');
      lines.push(`- **Total Suggestions**: ${metrics.totalSuggestions.toLocaleString()}`);
      lines.push(`- **Total Acceptances**: ${metrics.totalAcceptances.toLocaleString()}`);
      lines.push(`- **Suggestion Acceptance Rate**: ${metrics.acceptanceRate}%`);
      lines.push(`- **Total Lines Suggested**: ${metrics.totalLinesSuggested.toLocaleString()}`);
      lines.push(`- **Total Lines Accepted**: ${metrics.totalLinesAccepted.toLocaleString()}`);
      lines.push(`- **Line Acceptance Rate**: ${metrics.lineAcceptanceRate}%`);
      lines.push(`- **Metrics Period**: ${metrics.periodStart?.split('T')[0]} to ${metrics.periodEnd?.split('T')[0]} (${metrics.daysCovered} days)`);
    }
    
    lines.push('');
    
    // Add inactive users detail if any
    if (inactiveUsers.count > 0) {
      lines.push('## Inactive Users Detail');
      lines.push('');
      
      for (const user of inactiveUsers.users) {
        const activityInfo = user.daysSinceActivity !== null 
          ? `Last active: ${user.daysSinceActivity} days ago`
          : 'No activity recorded';
        lines.push(`- **${user.name}** (@${user.login}) - ${activityInfo}`);
      }
      lines.push('');
    }

    // Add team breakdown if available
    if (teamAnalysis && Object.keys(teamAnalysis).length > 0) {
      lines.push('## Team Breakdown');
      lines.push('');
      
      for (const [teamSlug, team] of Object.entries(teamAnalysis)) {
        lines.push(`### ${team.name}`);
        if (team.description) {
          lines.push(`*${team.description}*`);
          lines.push('');
        }
        
        lines.push(`- **Total Seats**: ${team.totalSeats}`);
        lines.push(`- **Active Users**: ${team.activeUsers.count} (${team.activeUsers.percentage}%)`);
        lines.push(`- **Inactive Users**: ${team.inactiveUsers.count} (${team.inactiveUsers.percentage}%)`);
        
        // Add team metrics if available
        if (teamMetrics && teamMetrics[teamSlug]) {
          const tm = teamMetrics[teamSlug];
          lines.push('');
          lines.push('**Team Metrics:**');
          lines.push(`- Total Suggestions: ${tm.totalSuggestions.toLocaleString()}`);
          lines.push(`- Total Acceptances: ${tm.totalAcceptances.toLocaleString()}`);
          lines.push(`- Acceptance Rate: ${tm.acceptanceRate}%`);
          lines.push(`- Total Lines Suggested: ${tm.totalLinesSuggested.toLocaleString()}`);
          lines.push(`- Total Lines Accepted: ${tm.totalLinesAccepted.toLocaleString()}`);
          lines.push(`- Line Acceptance Rate: ${tm.lineAcceptanceRate}%`);
        }
        
        // Add team member details for smaller teams
        if (team.activeUsers.count <= 10 && team.activeUsers.count > 0) {
          lines.push('');
          lines.push('**Active Members:**');
          for (const user of team.activeUsers.users) {
            const daysSince = user.daysSinceActivity === 0 ? 'today' : `${user.daysSinceActivity} days ago`;
            lines.push(`- ${user.name} (@${user.login}) - Last active: ${daysSince}`);
          }
        }
        
        if (team.inactiveUsers.count <= 5 && team.inactiveUsers.count > 0) {
          lines.push('');
          lines.push('**Inactive Members:**');
          for (const user of team.inactiveUsers.users) {
            const activityInfo = user.daysSinceActivity !== null 
              ? `Last active: ${user.daysSinceActivity} days ago`
              : 'No activity recorded';
            lines.push(`- ${user.name} (@${user.login}) - ${activityInfo}`);
          }
        }
        
        lines.push('');
      }
    }
    
    // Write the report
    const reportContent = lines.join('\n');
    writeFileSync(filePath, reportContent, 'utf8');
    
    console.log(`✅ Markdown report saved: ${filePath}`);
    return filePath;
  }

  /**
   * Analyze active users and generate both console report and markdown file
   * @param {Object} options - Analysis options
   * @returns {Promise<Object>} - Analysis results with report path
   */
  async analyzeAndReport(options = {}) {
    const analysis = await this.analyzeActiveUsersInPastWeek(options);
    
    // Generate console report
    const consoleReport = this.generateSummaryReport(analysis);
    console.log(consoleReport);
    
    // Generate markdown report
    const reportPath = this.generateMarkdownReport(analysis, options);
    
    return {
      ...analysis,
      reportPath
    };
  }
}
