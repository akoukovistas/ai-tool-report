import { writeFileSync, readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { GitHubBaseService } from './GitHubBaseService.js';
import {
  ensureDir,
  createDateDirStructure,
  cleanForCSV,
  addBOM,
  sleep
} from '../utils/common.js';

/**
 * Service for fetching and managing GitHub Copilot seat assignments
 */
export class GitHubSeatsService extends GitHubBaseService {
  constructor(options = {}) {
    super(options);
    this.nameCache = new Map();
    this.loadNameCache();
  }

  /**
   * Load name cache from file system
   * @private
   */
  loadNameCache() {
    const cachePath = this.config.nameCachePath || 'data/github-name-cache.json';
    if (existsSync(cachePath)) {
      try {
        const cacheData = JSON.parse(readFileSync(cachePath, 'utf8')) || {};
        for (const [login, data] of Object.entries(cacheData)) {
          this.nameCache.set(login, data);
        }
      } catch {
        // Ignore cache load errors
      }
    }
  }

  /**
   * Save name cache to file system
   * @private
   */
  saveNameCache() {
    const cachePath = this.config.nameCachePath || 'data/github-name-cache.json';
    try {
      const cacheObject = Object.fromEntries(this.nameCache);
      writeFileSync(cachePath, JSON.stringify(cacheObject, null, 2), 'utf8');
    } catch (error) {
      console.warn('[warn] Failed to save name cache:', error.message);
    }
  }

  /**
   * Fetch organization Copilot seat assignments
   * @param {Object} options - Fetch options
   * @returns {Promise<Object>} - Result with seats data and file paths
   */
  async fetchSeats(options = {}) {
    this.validateConfig();
    
    const fetchConfig = { ...this.config, ...options };
    const { org, perPage = 100, delayMs = 0, enrichNames = true } = fetchConfig;

    console.log(`Fetching Copilot seats for organization: ${org}`);
    
    try {
      // Fetch seats from GitHub API
      const requestOptions = { perPage, delayMs };
      const { seats, meta, pages } = await this.client.fetchOrgSeats(org, requestOptions);
      
      // Enrich with user names if requested
      if (enrichNames) {
        await this.enrichSeatsWithNames(seats, fetchConfig);
        this.saveNameCache();
      }
      
      // Save data
      const jsonPath = await this.saveSeatsJSON(seats, meta, pages, { org, ...fetchConfig });
      const csvPath = await this.saveSeatsCSV(seats, fetchConfig);
      
      console.log(`✓ Successfully fetched ${seats.length} seat assignments`);
      
      return { jsonPath, csvPath, count: seats.length, seats, meta };
      
    } catch (error) {
      console.error('❌ Failed to fetch seats:', error.message);
      throw error;
    }
  }

  /**
   * Enrich seats with user names from GitHub API
   * @private
   */
  async enrichSeatsWithNames(seats, config) {
    const nameDelayMs = config.nameDelayMs || 40;
    
    // Find logins that need name lookups
    const missingLogins = [];
    for (const seat of seats) {
      const login = seat.assignee?.login;
      if (!login) continue;
      if (!this.nameCache.has(login) || !this.nameCache.get(login).hasOwnProperty('name')) {
        missingLogins.push(login);
      }
    }
    
    if (missingLogins.length > 0) {
      console.log(`[names] Fetching ${missingLogins.length} missing user name(s)`);
      
      for (let i = 0; i < missingLogins.length; i++) {
        const login = missingLogins[i];
        try {
          const userData = await this.client.fetchUser(login);
          this.nameCache.set(login, { 
            name: userData.name || '',
            status: userData.status,
            fetched_at: new Date().toISOString()
          });
          console.log(`[names] [${i+1}/${missingLogins.length}] ${login} -> ${userData.name || '(empty)'}`);
        } catch (error) {
          console.warn(`[names] [${i+1}/${missingLogins.length}] ${login} error: ${error.message}`);
          this.nameCache.set(login, { 
            name: '', 
            status: 'error', 
            fetched_at: new Date().toISOString() 
          });
        }
        
        if (nameDelayMs > 0) {
          await sleep(nameDelayMs);
        }
      }
    } else {
      console.log('[names] No missing user names');
    }
    
    // Attach names to seats
    for (const seat of seats) {
      const login = seat.assignee?.login;
      if (login && this.nameCache.has(login)) {
        seat.assignee.enriched_name = this.nameCache.get(login).name || '';
      }
    }
  }

  /**
   * Save seats data as JSON
   * @private
   */
  async saveSeatsJSON(seats, meta, pages, config) {
    const fetchedAt = new Date().toISOString();
    const dataOutputDir = createDateDirStructure(config.dataDir || 'data/github');
    // Generate filename following pattern: copilot-seats_{org_name}_YYYY-MM-DD_to_YYYY-MM-DD
    const today = new Date(fetchedAt).toISOString().split('T')[0];
    const fileName = `copilot-seats_${config.org}_${today}_to_${today}.json`;
    const filePath = path.join(dataOutputDir, fileName);
    
    const jsonOutput = {
      meta: {
        org: config.org,
        fetched_at: fetchedAt,
        pages,
        seats_returned: seats.length,
        ...meta
      },
      seats
    };
    
    writeFileSync(filePath, JSON.stringify(jsonOutput, null, 2), 'utf8');
    console.log(`✓ Saved JSON data: ${filePath}`);
    
    return filePath;
  }

  /**
   * Save seats data as CSV
   * @private
   */
  async saveSeatsCSV(seats, config) {
    const outputDir = config.outputDir || 'output/csv/github';
    ensureDir(outputDir);
    
    const csvHeader = ['Login', 'Name', 'LastActivityAt', 'LastActivityEditor'];
    const lines = [csvHeader.join(',')];
    
    for (const seat of seats) {
      const assignee = seat.assignee || {};
      const login = assignee.login || '';
      const name = config.enrichNames ? (assignee.enriched_name || '') : '';
      
      // Normalize last_activity_at to ISO date
      let lastActivity = this.normalizeActivityDate(seat.last_activity_at);
      
      const row = [
        cleanForCSV(login),
        cleanForCSV(name),
        cleanForCSV(lastActivity),
        cleanForCSV(seat.last_activity_editor || '')
      ];
      
      lines.push(row.join(','));
    }
    
    const csvPath = path.join(outputDir, 'copilot-seat-assignments.csv');
    writeFileSync(csvPath, addBOM(lines.join('\n')), 'utf8');
    console.log(`✓ Saved CSV summary: ${csvPath}`);
    
    return csvPath;
  }

  /**
   * Normalize activity date to ISO format
   * @private
   */
  normalizeActivityDate(date) {
    if (!date) return '';
    
    if (typeof date === 'number') {
      if (date < 1e12) date *= 1000; // seconds -> ms
      return new Date(date).toISOString().slice(0, 10);
    }
    
    if (typeof date === 'string' && /^\d{10,}$/.test(date)) {
      let num = Number(date);
      if (num < 1e12) num *= 1000;
      return new Date(num).toISOString().slice(0, 10);
    }
    
    if (typeof date === 'string' && /T/.test(date)) {
      try {
        return new Date(date).toISOString().slice(0, 10);
      } catch {
        return date;
      }
    }
    
    return date;
  }

  /**
   * Get seats summary statistics
   * @param {Array} seats - Seats data
   * @returns {Object} - Summary statistics
   */
  getSeatsSummary(seats) {
    if (!seats || !seats.length) {
      return { count: 0, activeUsers: 0, lastActivityDates: [] };
    }

    const activeUsers = seats.filter(seat => seat.last_activity_at).length;
    const lastActivityDates = seats
      .map(seat => this.normalizeActivityDate(seat.last_activity_at))
      .filter(Boolean)
      .sort();

    return {
      count: seats.length,
      activeUsers,
      inactiveUsers: seats.length - activeUsers,
      lastActivityDates,
      mostRecentActivity: lastActivityDates.length > 0 ? lastActivityDates[lastActivityDates.length - 1] : null
    };
  }
}
