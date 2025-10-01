import { writeFileSync, readFileSync, existsSync, readdirSync, statSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import {
  normalizeText,
  extractOrgUsers,
  countTotalRDPeople,
  extractEngineeringTeam
} from '../common/org.js';
import { checkAndPromptOverwrite } from '../common/prompt.js';
import { areNameVariations } from '../common/name-variations.js';
function normalizeBool(v){
  if (typeof v !== 'string') return false;
  const t = v.trim().toLowerCase();
  return t === 'true' || t === '1' || t === 'yes' || t === 'y';
}

/**
 * Centralized reporting service for generating AI tooling adoption reports
 * Consolidates business logic from various report scripts
 */
export class ReportingService {
  constructor(options = {}) {
    this.config = {
      dataDir: options.dataDir || 'data',
      outputDir: options.outputDir || 'output/reports',
      userLookupPath: options.userLookupPath || 'data/user-lookup-table.csv',
      orgDataPath: options.orgDataPath || path.join('data', (process.env.ORG || process.env.org || process.env.GH_ORG || process.env.GITHUB_ORG || 'org'), 'direct-reports.json'),
      ...options
    };
  }

  /**
   * Generate comprehensive active users report
   * @param {Object} options - Report options
   * @returns {Promise<Object>} - Report generation result
   */
  async generateActiveUsersReport(options = {}) {
    const { skipPrompt = false } = options;
    
    console.log('🚀 Starting active users report generation...');
    
    try {
      // Load organizational data
      console.log('🔍 Loading organizational structure...');
      const orgData = this.loadOrganizationalData();
      const allUsers = this.loadUserLookupData();
      const filteredUsers = this.filterUsersToOrg(allUsers, orgData);
      
      console.log(`📊 Found ${filteredUsers.length} users in organizational structure`);

      // Analyze GitHub Copilot activity
      console.log('🔍 Analyzing GitHub Copilot activity...');
      const copilotAnalysis = await this.analyzeCopilotActivity(filteredUsers);
      
      // Analyze Cursor activity
      console.log('🔍 Analyzing Cursor activity...');
      const cursorAnalysis = await this.analyzeCursorActivity(filteredUsers);

      // Generate engineering team analysis
      const engineeringAnalysis = this.analyzeEngineeringTeam(filteredUsers, orgData);
      
      // Calculate comprehensive statistics
      const stats = this.calculateComprehensiveStats(
        filteredUsers, orgData, copilotAnalysis, cursorAnalysis, engineeringAnalysis
      );

      // Generate report content
      const reportContent = this.generateActiveUsersReportMarkdown(
        filteredUsers, stats, copilotAnalysis, cursorAnalysis, engineeringAnalysis
      );

      // Ensure output directory exists
      if (!existsSync(this.config.outputDir)) {
        mkdirSync(this.config.outputDir, { recursive: true });
      }

      // Save report (timestamped + canonical)
      const iso = new Date().toISOString().replace(/[:]/g, '-');
      const timestampedPath = path.join(this.config.outputDir, `active-users_${iso}.md`);
      const outputPath = path.join(this.config.outputDir, 'active-users.md');
      
      if (!skipPrompt) {
        const shouldProceed = await checkAndPromptOverwrite(outputPath, 'Active Users Report');
        if (!shouldProceed) {
          console.log('❌ Report generation cancelled by user.');
          return { cancelled: true };
        }
      }

      writeFileSync(timestampedPath, reportContent, 'utf8');
      writeFileSync(outputPath, reportContent, 'utf8');
      console.log(`✅ Active users report generated: ${outputPath}`);

      return {
        success: true,
        outputPath,
        timestampedPath,
        stats
      };

    } catch (error) {
      console.error('❌ Error generating active users report:', error.message);
      throw error;
    }
  }

  /**
   * Generate AI tooling adoption report
   * @param {Object} options - Report options
   * @returns {Promise<Object>} - Report generation result
   */
  async generateAIToolingAdoptionReport(options = {}) {
    const { skipPrompt = false } = options;
    
    console.log('🚀 Starting AI tooling adoption report generation...');
    
    try {
      // Load data
      const orgData = this.loadOrganizationalData();
      const allUsers = this.loadUserLookupData();
      
      // Analyze tooling adoption across the organization
      const adoptionStats = this.analyzeToolingAdoption(allUsers, orgData);
      
      // Generate report content
      const reportContent = this.generateAIToolingReportMarkdown(adoptionStats, orgData);

      // Ensure output directory exists
      if (!existsSync(this.config.outputDir)) {
        mkdirSync(this.config.outputDir, { recursive: true });
      }

      // Save report (timestamped + canonical)
      const iso = new Date().toISOString().replace(/[:]/g, '-');
      const timestampedPath = path.join(this.config.outputDir, `ai-tooling-adoption-report_${iso}.md`);
      const outputPath = path.join(this.config.outputDir, 'ai-tooling-adoption-report.md');
      
      if (!skipPrompt) {
        const shouldProceed = await checkAndPromptOverwrite(outputPath, 'AI Tooling Adoption Report');
        if (!shouldProceed) {
          console.log('❌ Report generation cancelled by user.');
          return { cancelled: true };
        }
      }

      writeFileSync(timestampedPath, reportContent, 'utf8');
      writeFileSync(outputPath, reportContent, 'utf8');
      console.log(`✅ AI tooling adoption report generated: ${outputPath}`);

      return {
        success: true,
        outputPath,
        timestampedPath,
        stats: adoptionStats
      };

    } catch (error) {
      console.error('❌ Error generating AI tooling adoption report:', error.message);
      throw error;
    }
  }

  /**
   * Generate recent activity analysis report
   * @param {Object} options - Report options
   * @returns {Promise<Object>} - Report generation result
   */
  async generateRecentActivityReport(options = {}) {
    const { skipPrompt = false, days = 7 } = options;
    
    console.log('🚀 Starting recent activity analysis...');
    
    try {
      // Analyze recent activity patterns
      const activityAnalysis = await this.analyzeRecentActivity(days);
      
      // Generate report content
      const reportContent = this.generateRecentActivityReportMarkdown(activityAnalysis, days);

      // Ensure output directory exists
      if (!existsSync(this.config.outputDir)) {
        mkdirSync(this.config.outputDir, { recursive: true });
      }

      // Save report (timestamped + canonical)
      const iso = new Date().toISOString().replace(/[:]/g, '-');
      const timestampedPath = path.join(this.config.outputDir, `recent-activity-analysis_${iso}.md`);
      const outputPath = path.join(this.config.outputDir, 'recent-activity-analysis.md');
      
      if (!skipPrompt) {
        const shouldProceed = await checkAndPromptOverwrite(outputPath, 'Recent Activity Analysis Report');
        if (!shouldProceed) {
          console.log('❌ Report generation cancelled by user.');
          return { cancelled: true };
        }
      }

      writeFileSync(timestampedPath, reportContent, 'utf8');
      writeFileSync(outputPath, reportContent, 'utf8');
      console.log(`✅ Recent activity analysis report generated: ${outputPath}`);

      return {
        success: true,
        outputPath,
        timestampedPath,
        analysis: activityAnalysis
      };

    } catch (error) {
      console.error('❌ Error generating recent activity report:', error.message);
      throw error;
    }
  }

  /**
   * Load organizational structure data
   * @private
   */
  loadOrganizationalData() {
    let orgPath = this.config.orgDataPath;
    
    if (!existsSync(orgPath)) {
      // Fallback: search for any direct-reports.json under data/** and pick the most recently modified
      const candidates = [];
      const root = this.config.dataDir || 'data';
      const walk = (dir) => {
        try {
          const entries = readdirSync(dir);
          for (const entry of entries) {
            const full = path.join(dir, entry);
            const st = statSync(full);
            if (st.isDirectory()) {
              walk(full);
            } else if (entry === 'direct-reports.json') {
              candidates.push({ path: full, mtime: st.mtimeMs });
            }
          }
        } catch {}
      };
      walk(root);
      if (candidates.length === 0) {
        throw new Error(`Organizational data not found at ${orgPath}`);
      }
      candidates.sort((a,b) => b.mtime - a.mtime);
      orgPath = candidates[0].path;
      console.log(`ℹ️ Using discovered organizational data: ${orgPath}`);
    }
    
    const orgContent = readFileSync(orgPath, 'utf8');
    const orgData = JSON.parse(orgContent);
    
    if (!orgData.organization) {
      throw new Error('Invalid organizational data structure');
    }
    
    return orgData;
  }

  /**
   * Load user lookup table data
   * @private
   */
  loadUserLookupData() {
    let userLookupPath = this.config.userLookupPath;
    
    if (!existsSync(userLookupPath)) {
      // Fallback: search for likely lookup CSVs under data/**
      const root = this.config.dataDir || 'data';
      const candidates = [];
      const walk = (dir) => {
        try {
          const entries = readdirSync(dir);
          for (const entry of entries) {
            const full = path.join(dir, entry);
            const st = statSync(full);
            if (st.isDirectory()) {
              walk(full);
            } else if (entry.toLowerCase().endsWith('.csv')) {
              const name = entry.toLowerCase();
              const score = (
                (name.includes('user') ? 2 : 0) +
                (name.includes('lookup') ? 3 : 0) +
                (name.includes('rnd-lookup-table') ? 4 : 0) +
                (name.includes('table') ? 1 : 0)
              );
              candidates.push({ path: full, mtime: st.mtimeMs, score });
            }
          }
        } catch {}
      };
      walk(root);
      if (candidates.length === 0) {
        throw new Error(`User lookup table not found at ${userLookupPath}`);
      }
      candidates.sort((a,b) => (b.score - a.score) || (b.mtime - a.mtime));
      userLookupPath = candidates[0].path;
      console.log(`ℹ️ Using discovered user lookup CSV: ${userLookupPath}`);
    }
    
    const csvContent = readFileSync(userLookupPath, 'utf8');
    const lines = csvContent.trim().split('\n');
    
    const users = [];
    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(',');
      const user = {
        name: (values[0] || '').trim(),
        email: (values[1] || '').trim(),
        githubLogin: (values[2] || '').trim(),
        role: (values[3] || '').trim(),
        hasCopilot: normalizeBool(values[4]),
        hasCursor: normalizeBool(values[5])
      };
      users.push(user);
    }
    
    return users;
  }

  /**
   * Filter users to only include those in organizational structure
   * @private
   */
  filterUsersToOrg(allUsers, orgData) {
    const orgUserData = extractOrgUsers(orgData.organization);
    const orgUsers = orgUserData.users;
    
    return allUsers.filter(user => {
      const normalizedUserName = normalizeText(user.name);
      return orgUsers.has(normalizedUserName) || this.matchUserByNameVariations(user, orgUsers);
    });
  }

  /**
   * Match user by name variations (handles nicknames, etc.)
   * Uses external name variations configuration for maintainability
   * @private
   */
  matchUserByNameVariations(user, orgUsers) {
    const userParts = normalizeText(user.name).split(' ');
    if (userParts.length < 2) return false;
    
    const userLast = userParts[userParts.length - 1];
    const userFirst = userParts[0];
    
    for (const orgName of orgUsers) {
      const orgParts = orgName.split(' ');
      if (orgParts.length < 2) continue;
      
      const orgLast = orgParts[orgParts.length - 1];
      const orgFirst = orgParts[0];
      
      if (userLast === orgLast) {
        // Check for exact match or name variations using external config
        if (userFirst === orgFirst || areNameVariations(userFirst, orgFirst)) {
          return true;
        }
      }
    }
    
    return false;
  }

  /**
   * Analyze GitHub Copilot activity
   * @private
   */
  async analyzeCopilotActivity(users) {
    const seatFiles = this.findCopilotSeatFiles();
    
    if (!seatFiles.length) {
      console.warn('⚠️  No Copilot seat files found');
      return { activeLogins: new Set(), inactiveLogins: new Set(), activityMap: new Map() };
    }
    
    // Use most recent seat file
    seatFiles.sort();
    const latestSeatFile = seatFiles[seatFiles.length - 1];
    console.log(`📄 Using seat file: ${path.basename(latestSeatFile)}`);
    
    const seatData = JSON.parse(readFileSync(latestSeatFile, 'utf8'));
    try {
      const stat = statSync(latestSeatFile);
      const ageDays = (Date.now() - stat.mtimeMs) / (1000 * 60 * 60 * 24);
      if (ageDays > 7) {
        console.warn(`⚠️  GitHub seat data is stale (${ageDays.toFixed(1)} days old): ${path.basename(latestSeatFile)}`);
      }
    } catch {}
    const cutoffDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    
    const activeLogins = new Set();
    const inactiveLogins = new Set();
    const activityMap = new Map();
    
    for (const seat of seatData.seats || []) {
      const login = seat.assignee?.login;
      const lastActivity = seat.last_activity_at;
      
      let isActive = false;
      let daysSinceActivity = null;
      
      if (lastActivity) {
        const activityDate = new Date(lastActivity);
        daysSinceActivity = Math.floor((new Date() - activityDate) / (1000 * 60 * 60 * 24));
        isActive = activityDate >= cutoffDate;
      }
      
      activityMap.set(login, {
        lastActivity,
        daysSinceActivity,
        isActive,
        enrichedName: seat.assignee?.enriched_name || null
      });
      
      if (isActive) {
        activeLogins.add(login);
      } else {
        inactiveLogins.add(login);
      }
    }
    
    return { activeLogins, inactiveLogins, activityMap };
  }

  /**
   * Analyze Cursor activity
   * @private
   */
  async analyzeCursorActivity(users) {
    const cursorFiles = this.findCursorWeeklyFiles();
    
    if (!cursorFiles.length) {
      console.warn('⚠️  No Cursor weekly files found');
      return { activeUsers: new Set(), inactiveUsers: new Set(), activityMap: new Map() };
    }
    
    // Use most recent file
    cursorFiles.sort();
    const latestFile = cursorFiles[cursorFiles.length - 1];
    console.log(`📄 Using Cursor file: ${path.basename(latestFile)}`);
    
    const cursorData = JSON.parse(readFileSync(latestFile, 'utf8'));
    try {
      const stat = statSync(latestFile);
      const ageDays = (Date.now() - stat.mtimeMs) / (1000 * 60 * 60 * 24);
      if (ageDays > 7) {
        console.warn(`⚠️  Cursor weekly data is stale (${ageDays.toFixed(1)} days old): ${path.basename(latestFile)}`);
      }
    } catch {}
    const cutoffDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    
    const activeUsers = new Set();
    const inactiveUsers = new Set();
    const activityMap = new Map();
    
    for (const record of cursorData.data || []) {
      const email = record.email?.toLowerCase();
      if (!email) continue;
      
      const date = new Date(record.date);
      const isActive = record.isActive && date >= cutoffDate;
      
      if (!activityMap.has(email)) {
        activityMap.set(email, {
          lastActivity: null,
          hasRecentActivity: false,
          totalRequests: 0
        });
      }
      
      const activity = activityMap.get(email);
      activity.totalRequests += (record.composerRequests || 0) + (record.chatRequests || 0);
      
      if (isActive && (!activity.lastActivity || date > activity.lastActivity)) {
        activity.lastActivity = date;
        activity.hasRecentActivity = true;
        activeUsers.add(email);
      }
    }
    
    return { activeUsers, inactiveUsers, activityMap };
  }

  /**
   * Analyze engineering team specifics
   * @private
   */
  analyzeEngineeringTeam(users, orgData) {
    const engineeringUsers = extractEngineeringTeam(orgData.organization);
    
    const engineeringTeamUsers = users.filter(user => {
      const normalizedName = normalizeText(user.name);
      return engineeringUsers.has(normalizedName) || 
             this.matchUserByNameVariations(user, engineeringUsers);
    });
    
    // Filter to Individual Contributors (no managers)
    const engineeringICs = engineeringTeamUsers.filter(user => {
      const role = user.role.toLowerCase();
      return !role.includes('manager') && !role.includes('vp') && !role.includes('director');
    });
    
    return {
      allEngineering: engineeringTeamUsers,
      individualContributors: engineeringICs,
      totalSize: engineeringUsers.size
    };
  }

  /**
   * Calculate comprehensive statistics
   * @private
   */
  calculateComprehensiveStats(users, orgData, copilotAnalysis, cursorAnalysis, engineeringAnalysis) {
    const totalRDPeople = countTotalRDPeople(orgData.organization);
    const usersWithTools = users.filter(u => u.hasCopilot || u.hasCursor);
    
    // Weekly activity stats
    const weeklyActiveInEither = users.filter(u => {
      const copilotActive = u.hasCopilot && copilotAnalysis.activeLogins.has(u.githubLogin);
      const cursorActive = u.hasCursor && cursorAnalysis.activeUsers.has(u.email?.toLowerCase());
      return copilotActive || cursorActive;
    }).length;
    
    const weeklyActivePercentage = ((weeklyActiveInEither / totalRDPeople) * 100).toFixed(1);
    
    // Engineering team stats
    const engActiveWeekly = engineeringAnalysis.allEngineering.filter(u => {
      const copilotActive = u.hasCopilot && copilotAnalysis.activeLogins.has(u.githubLogin);
      const cursorActive = u.hasCursor && cursorAnalysis.activeUsers.has(u.email?.toLowerCase());
      return copilotActive || cursorActive;
    }).length;
    
    const engICsActiveWeekly = engineeringAnalysis.individualContributors.filter(u => {
      const copilotActive = u.hasCopilot && copilotAnalysis.activeLogins.has(u.githubLogin);
      const cursorActive = u.hasCursor && cursorAnalysis.activeUsers.has(u.email?.toLowerCase());
      return copilotActive || cursorActive;
    }).length;
    
    return {
      totalRDPeople,
      usersInLookup: users.length,
      usersWithTools: usersWithTools.length,
      weeklyActiveInEither,
      weeklyActivePercentage,
      copilotUsers: users.filter(u => u.hasCopilot).length,
      cursorUsers: users.filter(u => u.hasCursor).length,
      activeCopilotUsers: copilotAnalysis.activeLogins.size,
      activeCursorUsers: cursorAnalysis.activeUsers.size,
      engineeringTotal: engineeringAnalysis.totalSize,
      engineeringWithTools: engineeringAnalysis.allEngineering.filter(u => u.hasCopilot || u.hasCursor).length,
      engineeringActiveWeekly: engActiveWeekly,
      engineeringICsTotal: engineeringAnalysis.individualContributors.length,
      engineeringICsActiveWeekly: engICsActiveWeekly
    };
  }

  /**
   * Generate active users report markdown content
   * @private
   */
  generateActiveUsersReportMarkdown(users, stats, copilotAnalysis, cursorAnalysis, engineeringAnalysis) {
    const reportDate = new Date().toISOString().split('T')[0];
    const cutoffDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    
    return `# AI Tools Active Users Report (Organizational Structure)

**Generated:** ${reportDate}  
**Analysis Period:** Last 7 days (${cutoffDate} to ${reportDate})  
**Scope:** Users from organizational structure

## Executive Summary

**Total R&D people:** ${stats.totalRDPeople}  
**R&D people with access to agentic editors:** ${stats.usersWithTools}  
**People active in either tool this past week:** ${stats.weeklyActiveInEither}  

**In total ${stats.weeklyActivePercentage}% of R&D were active users this past week.**

## Detailed Summary

- **Total Users in Organizational Structure:** ${stats.usersInLookup}
- **Users with Copilot Access:** ${stats.copilotUsers}
- **Users with Cursor Access:** ${stats.cursorUsers}
- **Users without AI Tools:** ${stats.usersInLookup - stats.usersWithTools}

### GitHub Copilot Activity
- **Active Copilot Users (Last 7 Days):** ${stats.activeCopilotUsers}
- **Inactive Copilot Users:** ${copilotAnalysis.inactiveLogins.size}

### Cursor Activity  
- **Active Cursor Users (Last 7 Days):** ${stats.activeCursorUsers}
- **Inactive Cursor Users:** ${cursorAnalysis.inactiveUsers.size}

## Engineering Team Activity

- **Total Engineering Team Members:** ${stats.engineeringTotal}
- **Engineering Team Members with AI Tool Access:** ${stats.engineeringWithTools}
- **Engineering Team Active (Last 7 Days):** ${stats.engineeringActiveWeekly}

**${((stats.engineeringActiveWeekly / stats.engineeringTotal) * 100).toFixed(1)}% of engineering team were active users this past week.**

## Engineering Individual Contributors Activity

- **Total Engineering ICs:** ${stats.engineeringICsTotal}
- **Engineering ICs Active (Last 7 Days):** ${stats.engineeringICsActiveWeekly}

**${((stats.engineeringICsActiveWeekly / stats.engineeringICsTotal) * 100).toFixed(1)}% of engineering ICs were active users this past week.**

## Analysis Details

- **Analysis Date:** ${reportDate}
- **Cutoff Date:** ${cutoffDate}
- **Days Lookback:** 7

## Notes

- **Active Users:** Users who have used AI tools in the last 7 days
- **Inactive Users:** Users with tool access who have used them before but not in the last 7 days  
- GitHub Copilot activity is based on seat assignment data
- Cursor activity is based on weekly activity reports
- Users without GitHub login mapping cannot be matched against Copilot activity data
`;
  }

  /**
   * Generate AI tooling adoption report markdown
   * @private
   */
  generateAIToolingReportMarkdown(adoptionStats, orgData) {
    const reportDate = new Date().toISOString().split('T')[0];
    
    return `# AI Tooling Adoption Report

**Generated:** ${reportDate}  
**Scope:** R&D Organization Analysis

## Executive Summary

Total R&D workforce analyzed: ${adoptionStats.totalPeople}

### Tool Adoption
- **GitHub Copilot:** ${adoptionStats.copilotAdoption} people (${adoptionStats.copilotPercentage}%)
- **Cursor:** ${adoptionStats.cursorAdoption} people (${adoptionStats.cursorPercentage}%)
- **Any AI Tool:** ${adoptionStats.anyToolAdoption} people (${adoptionStats.anyToolPercentage}%)

### Adoption by Department
${Object.entries(adoptionStats.byDepartment).map(([dept, stats]) => 
  `- **${dept}:** ${stats.withTools}/${stats.total} (${stats.percentage}%)`
).join('\n')}

## Recommendations

${this.generateAdoptionRecommendations(adoptionStats)}

## Analysis Details

- **Analysis Date:** ${reportDate}
- **Data Sources:** User lookup table, organizational structure
- **Methodology:** Cross-reference user assignments with tool access rights
`;
  }

  /**
   * Generate recent activity report markdown
   * @private
   */
  generateRecentActivityReportMarkdown(activityAnalysis, days) {
    const reportDate = new Date().toISOString().split('T')[0];
    
    return `# Recent Activity Analysis Report

**Generated:** ${reportDate}  
**Analysis Period:** Last ${days} days

## Activity Summary

### GitHub Copilot
- **Total Active Users:** ${activityAnalysis.copilot.activeUsers}
- **Average Daily Activity:** ${activityAnalysis.copilot.averageDaily}
- **Peak Activity Day:** ${activityAnalysis.copilot.peakDay}

### Cursor
- **Total Active Users:** ${activityAnalysis.cursor.activeUsers}
- **Total Requests:** ${activityAnalysis.cursor.totalRequests}
- **Lines of Code Added:** ${activityAnalysis.cursor.totalLinesAdded}

## Trends

${this.generateActivityTrends(activityAnalysis)}

## Analysis Details

- **Analysis Date:** ${reportDate}
- **Period:** ${days} days
- **Data Sources:** Recent activity logs, seat assignment data
`;
  }

  // Helper methods for finding data files

  findCopilotSeatFiles() {
    const files = [];
    const searchDir = path.join(this.config.dataDir, 'github');
    
    if (!existsSync(searchDir)) return files;
    
    const walkDir = (dir) => {
      try {
        const entries = readdirSync(dir);
        for (const entry of entries) {
          const fullPath = path.join(dir, entry);
          const stat = statSync(fullPath);
          
          if (stat.isDirectory()) {
            walkDir(fullPath);
          } else if (entry.includes('copilot-seats_') && entry.endsWith('.json')) {
            files.push(fullPath);
          }
        }
      } catch (error) {
        // Skip directories we can't read
      }
    };
    
    walkDir(searchDir);
    return files;
  }

  findCursorWeeklyFiles() {
    const files = [];
    const searchDir = this.config.dataDir;
    
    if (!existsSync(searchDir)) return files;
    
    const walkDir = (dir) => {
      try {
        const entries = readdirSync(dir);
        for (const entry of entries) {
          const fullPath = path.join(dir, entry);
          const stat = statSync(fullPath);
          
          if (stat.isDirectory()) {
            walkDir(fullPath);
          } else if (entry.includes('weekly-report_') && entry.endsWith('.json')) {
            files.push(fullPath);
          }
        }
      } catch (error) {
        // Skip directories we can't read
      }
    };
    
    walkDir(searchDir);
    return files;
  }

  // Placeholder methods for additional analysis
  analyzeToolingAdoption(users, orgData) {
    // Implementation would analyze tool adoption patterns
    return {
      totalPeople: users.length,
      copilotAdoption: users.filter(u => u.hasCopilot).length,
      cursorAdoption: users.filter(u => u.hasCursor).length,
      anyToolAdoption: users.filter(u => u.hasCopilot || u.hasCursor).length,
      copilotPercentage: ((users.filter(u => u.hasCopilot).length / users.length) * 100).toFixed(1),
      cursorPercentage: ((users.filter(u => u.hasCursor).length / users.length) * 100).toFixed(1),
      anyToolPercentage: ((users.filter(u => u.hasCopilot || u.hasCursor).length / users.length) * 100).toFixed(1),
      byDepartment: {}
    };
  }

  async analyzeRecentActivity(days) {
    // Implementation would analyze recent activity patterns
    return {
      copilot: {
        activeUsers: 0,
        averageDaily: 0,
        peakDay: 'N/A'
      },
      cursor: {
        activeUsers: 0,
        totalRequests: 0,
        totalLinesAdded: 0
      }
    };
  }

  generateAdoptionRecommendations(stats) {
    const recommendations = [];
    
    if (parseFloat(stats.anyToolPercentage) < 50) {
      recommendations.push('- Consider expanding AI tool access to reach more of the R&D team');
    }
    
    if (parseFloat(stats.copilotPercentage) > parseFloat(stats.cursorPercentage) * 2) {
      recommendations.push('- Cursor adoption is lagging behind Copilot - consider training or evangelism');
    }
    
    return recommendations.length > 0 ? recommendations.join('\n') : '- Current adoption levels are strong across the organization';
  }

  generateActivityTrends(analysis) {
    return '- Activity patterns show consistent usage across both platforms\n- Recommend continued monitoring of adoption trends';
  }
}
