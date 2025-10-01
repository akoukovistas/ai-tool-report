import { existsSync, readFileSync, writeFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { createGitHubClient } from '../utils/github-client.js';
import { 
  parseConfig, 
  validateConfig, 
  ensureDir, 
  addBOM,
  sleep 
} from '../utils/common.js';

/**
 * Service for managing GitHub user data and mappings
 */
export class GitHubUserService {
  constructor(options = {}) {
    this.config = { ...parseConfig(), ...options };
    this.client = createGitHubClient({ 
      token: this.config.token, 
      apiBase: this.config.apiBase 
    });
    this.nameCache = new Map();
    this.loadNameCache();
  }

  /**
   * Validate service configuration
   */
  validateConfig(requiredFields = ['org']) {
    validateConfig(this.config, requiredFields);
  }

  /**
   * Load name cache from file system
   * @private
   */
  loadNameCache() {
    const cachePath = this.config.cachePath || 'data/github-name-cache.json';
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
    const cachePath = this.config.cachePath || 'data/github-name-cache.json';
    try {
      const cacheObject = Object.fromEntries(this.nameCache);
      writeFileSync(cachePath, JSON.stringify(cacheObject, null, 2), 'utf8');
    } catch (error) {
      console.warn('[warn] Failed to save name cache:', error.message);
    }
  }

  /**
   * Build user lookup CSV from seat assignment files
   * @param {Object} options - Build options
   * @returns {Promise<Object>} - Result with CSV path and statistics
   */
  async buildUserLookup(options = {}) {
    this.validateConfig();
    
    const buildConfig = { ...this.config, ...options };
    const { org, dataDir = 'data/github', delayMs = 50, forceRefresh = false } = buildConfig;

    console.log(`Building user lookup for organization: ${org}`);
    
    try {
      // Collect unique logins from seat files
      const usernames = await this.collectLoginsFromSeatFiles(dataDir, org);
      console.log(`Found ${usernames.length} unique login(s)`);

      // Fetch missing user data
      await this.fetchMissingUserData(usernames, { delayMs, forceRefresh });
      this.saveNameCache();

      // Generate and save CSV
      const csvPath = await this.generateUserLookupCSV(usernames, buildConfig);
      
      return { 
        csvPath, 
        count: usernames.length 
      };
      
    } catch (error) {
      console.error('❌ Failed to build user lookup:', error.message);
      throw error;
    }
  }

  /**
   * Build login-email mapping CSV scaffold
   * @param {Object} options - Build options
   * @returns {Promise<Object>} - Result with CSV path and statistics
   */
  async buildLoginEmailMap(options = {}) {
    this.validateConfig();
    
    const buildConfig = { ...this.config, ...options };
    const { org, dataDir = 'data/github', outFile = 'data/github/login-email-map.csv' } = buildConfig;

    console.log(`Building login-email map for organization: ${org}`);
    
    try {
      // Find and use most recent seat file
      const seatFiles = this.collectSeatFiles(dataDir, org);
      if (!seatFiles.length) {
        throw new Error(`No seat JSON files found for org ${org} under ${dataDir}`);
      }
      
      seatFiles.sort((a, b) => b.localeCompare(a));
      const latestFile = seatFiles[0];
      console.log(`Using seat data from: ${latestFile}`);
      
      // Extract unique logins
      const seatData = JSON.parse(readFileSync(latestFile, 'utf8'));
      const seats = Array.isArray(seatData.seats) ? seatData.seats : [];
      const logins = Array.from(new Set(
        seats
          .map(seat => seat.assignee && seat.assignee.login)
          .filter(Boolean)
      )).sort();
      
      console.log(`Found ${logins.length} unique logins`);
      
      // Load existing mappings and merge
      const { rows, stats } = await this.mergeWithExistingEmailMap(logins, outFile);
      
      // Save updated CSV
      await this.saveEmailMapCSV(rows, outFile);
      
      console.log(`✓ Successfully built login-email map:`);
      console.log(`  - Total entries: ${rows.length}`);
      console.log(`  - New logins: ${stats.newCount}`);
      console.log(`  - Existing preserved: ${stats.existingCount}`);
      
      return { 
        outFile, 
        count: rows.length, 
        source: latestFile,
        ...stats 
      };
      
    } catch (error) {
      console.error('❌ Failed to build login-email map:', error.message);
      throw error;
    }
  }

  /**
   * Collect unique logins from seat assignment files
   * @private
   */
  async collectLoginsFromSeatFiles(dataDir, org) {
    const files = this.collectSeatFiles(dataDir, org);
    if (!files.length) {
      throw new Error(`No seat assignment JSON files found for org ${org} in ${dataDir}`);
    }

    const logins = new Set();
    for (const filePath of files) {
      try {
        const json = JSON.parse(readFileSync(filePath, 'utf8'));
        const seats = Array.isArray(json.seats) ? json.seats : [];
        for (const seat of seats) {
          const login = seat?.assignee?.login;
          if (login) logins.add(login);
        }
      } catch (error) {
        console.warn(`[warn] Failed reading ${filePath}: ${error.message}`);
      }
    }

    return Array.from(logins).sort();
  }

  /**
   * Recursively collect seat assignment files for an organization
   * @private
   */
  collectSeatFiles(dataDir, org) {
    const results = [];
    
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
          entry.name.startsWith(`copilot-seat-assignments_${org}_`) &&
          entry.name.endsWith('.json')
        ) {
          results.push(fullPath.replace(/\\/g, '/'));
        }
      }
    }
    
    walkDirectory(dataDir);
    return results;
  }

  /**
   * Fetch missing user data from GitHub API
   * @private
   */
  async fetchMissingUserData(usernames, options = {}) {
    const { delayMs = 50, forceRefresh = false } = options;
    
    const toFetch = [];
    for (const username of usernames) {
      if (forceRefresh || !this.nameCache.has(username) || this.nameCache.get(username).name === undefined) {
        toFetch.push(username);
      }
    }
    
    console.log(`${toFetch.length} user(s) to fetch${forceRefresh ? ' (force refresh)' : ''}`);
    
    if (toFetch.length === 0) return;

    for (let i = 0; i < toFetch.length; i++) {
      const login = toFetch[i];
      try {
        const userData = await this.client.fetchUser(login);
        this.nameCache.set(login, {
          name: userData.name || '',
          status: userData.status || 'ok',
          fetched_at: new Date().toISOString()
        });
        console.log(`[user-lookup] [${i+1}/${toFetch.length}] ${login} -> ${userData.name || '(no name)'}`);
      } catch (error) {
        console.warn(`[user-lookup] [${i+1}/${toFetch.length}] ${login} error: ${error.message}`);
        this.nameCache.set(login, {
          name: '',
          status: 'error',
          fetched_at: new Date().toISOString()
        });
      }
      
      if (delayMs > 0) {
        await sleep(delayMs);
      }
    }
  }

  /**
   * Generate user lookup CSV
   * @private
   */
  async generateUserLookupCSV(usernames, config) {
    const primaryDir = path.join(config.dataDir || 'data/github', 'users');
    ensureDir(primaryDir);
    
    // Load existing CSV for merging
    const existingMap = new Map();
    const primaryPath = path.join(primaryDir, 'user-lookup.csv');
    
    if (existsSync(primaryPath)) {
      await this.loadExistingUserLookup(primaryPath, existingMap);
    }
    
    // Merge data
    let added = 0, updated = 0, unchanged = 0;
    
    for (const username of usernames) {
      const cachedData = this.nameCache.get(username);
      const newName = (cachedData && cachedData.name || '').trim();
      
      if (!existingMap.has(username)) {
        existingMap.set(username, newName);
        added++;
      } else {
        const oldName = (existingMap.get(username) || '').trim();
        if (!oldName && newName) {
          existingMap.set(username, newName);
          updated++;
        } else {
          unchanged++;
        }
      }
    }
    
    // Save CSV
    await this.saveUserLookupCSV(existingMap, primaryPath);
    
    console.log(`✓ User lookup merge summary: added=${added} updated=${updated} unchanged=${unchanged}`);
    console.log(`✓ Saved CSV -> ${primaryPath}`);
    
    return primaryPath;
  }

  /**
   * Load existing user lookup CSV
   * @private
   */
  async loadExistingUserLookup(filePath, targetMap) {
    try {
      const content = readFileSync(filePath, 'utf8').replace(/^\uFEFF/, '');
      const lines = content.split(/\r?\n/).filter(line => line.trim().length);
      
      if (lines.length === 0) return;
      
      const header = lines[0].split(',').map(s => s.trim());
      const loginIdx = header.findIndex(h => /^login$/i.test(h));
      const nameIdx = header.findIndex(h => /^name$/i.test(h));
      
      for (let i = 1; i < lines.length; i++) {
        const parts = lines[i].split(',');
        const login = (parts[loginIdx] || '').trim();
        if (!login) continue;
        
        const name = (parts[nameIdx] || '').trim();
        targetMap.set(login, name);
      }
    } catch (error) {
      console.warn('[user-lookup] Failed reading existing CSV (will recreate):', error.message);
    }
  }

  /**
   * Save user lookup CSV
   * @private
   */
  async saveUserLookupCSV(dataMap, filePath) {
    const header = ['Login', 'Name'];
    const lines = [header.join(',')];
    
    const sortedEntries = Array.from(dataMap.entries())
      .sort((a, b) => a[0].localeCompare(b[0], 'en'));
    
    for (const [login, name] of sortedEntries) {
      lines.push([
        (login || '').replace(/,/g, ' '),
        (name || '').replace(/,/g, ' ')
      ].join(','));
    }
    
    writeFileSync(filePath, addBOM(lines.join('\n')), 'utf8');
  }

  /**
   * Merge with existing email mapping
   * @private
   */
  async mergeWithExistingEmailMap(logins, outFile) {
    const existingMap = {};
    
    if (existsSync(outFile)) {
      try {
        const content = readFileSync(outFile, 'utf8').replace(/^\uFEFF/, '');
        const lines = content.split(/\r?\n/).filter(line => line.trim());
        
        if (lines.length > 0) {
          const header = lines[0].split(',');
          const loginIdx = header.indexOf('Login');
          const emailIdx = header.indexOf('Email');
          
          for (let i = 1; i < lines.length; i++) {
            const parts = lines[i].split(',');
            const login = parts[loginIdx];
            const email = emailIdx >= 0 ? parts[emailIdx] : '';
            if (login) {
              existingMap[login] = { email };
            }
          }
        }
        console.log(`Loaded ${Object.keys(existingMap).length} existing mappings`);
      } catch (error) {
        console.warn('Failed to parse existing file, creating new one:', error.message);
      }
    }
    
    // Build final mapping
    const rows = [];
    let newCount = 0;
    let existingCount = 0;
    
    for (const login of logins) {
      const email = existingMap[login]?.email || '';
      rows.push({ login, email });
      
      if (existingMap[login]) {
        existingCount++;
      } else {
        newCount++;
      }
    }
    
    return { 
      rows, 
      stats: { newCount, existingCount } 
    };
  }

  /**
   * Save email mapping CSV
   * @private
   */
  async saveEmailMapCSV(rows, outFile) {
    ensureDir(path.dirname(outFile));
    
    const header = ['Login', 'Email'];
    const csvLines = [header.join(',')];
    
    for (const row of rows) {
      const csvRow = [
        (row.login || '').replace(/,/g, ' '),
        (row.email || '').replace(/,/g, ' ')
      ];
      csvLines.push(csvRow.join(','));
    }
    
    const csvContent = addBOM(csvLines.join('\n'));
    writeFileSync(outFile, csvContent, 'utf8');
    console.log(`✓ Saved to: ${outFile}`);
  }

  /**
   * Get user statistics
   * @param {Array} usernames - List of usernames
   * @returns {Object} - User statistics
   */
  getUserStats(usernames) {
    const stats = {
      total: usernames.length,
      withNames: 0,
      withoutNames: 0,
      errors: 0
    };

    for (const username of usernames) {
      const userData = this.nameCache.get(username);
      if (!userData) {
        stats.withoutNames++;
      } else if (userData.status === 'error') {
        stats.errors++;
      } else if (userData.name) {
        stats.withNames++;
      } else {
        stats.withoutNames++;
      }
    }

    return stats;
  }
}

