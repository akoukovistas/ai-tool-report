#!/usr/bin/env node

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import https from 'node:https';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { createGitHubClient } from './utils/github-client.js';
import { ensureDir, cleanForCSV, addBOM, sleep } from './utils/common.js';

/**
 * Service for enriching CSV data with GitHub user information
 */
class GitHubEnrichmentService {
  constructor(options = {}) {
    this.client = createGitHubClient(options);
    this.nameCache = new Map();
  }

  /**
   * Parse CSV content
   * @private
   */
  parseCSV(text) {
	const lines = text.split(/\r?\n/).filter(l => l.length);
	if (!lines.length) return { header: [], rows: [] };
    
	const parseLine = line => {
      const out = []; 
      let cur = ''; 
      let inQ = false; 
      for (let i = 0; i < line.length; i++) { 
        const c = line[i]; 
        if (inQ) { 
          if (c === '"' && line[i+1] === '"') { 
            cur += '"'; i++; 
          } else if (c === '"') { 
            inQ = false; 
          } else cur += c; 
        } else { 
          if (c === '"') { 
            inQ = true; 
          } else if (c === ',') { 
            out.push(cur); cur = ''; 
          } else cur += c; 
        } 
      } 
      out.push(cur); 
      return out; 
    };
    
    const header = parseLine(lines[0]).map(s => s.trim());
    const rows = lines.slice(1).map(ln => { 
      const cols = parseLine(ln); 
      const obj = {}; 
      header.forEach((h, i) => obj[h] = (cols[i] ?? '').trim()); 
      return obj; 
    });
    
	return { header, rows };
}

  /**
   * Load name cache from file
   * @private
   */
  loadNameCache(cachePath) {
    if (existsSync(cachePath)) {
      try {
        const cacheData = JSON.parse(readFileSync(cachePath, 'utf8'));
        for (const [login, data] of Object.entries(cacheData)) {
          this.nameCache.set(login, data);
        }
      } catch {
        // Ignore cache load errors
      }
    }
  }

  /**
   * Save name cache to file
   * @private
   */
  saveNameCache(cachePath) {
    try {
      const cacheObject = Object.fromEntries(this.nameCache);
      writeFileSync(cachePath, JSON.stringify(cacheObject, null, 2));
    } catch (error) {
      console.warn('Failed to save name cache:', error.message);
    }
  }

  /**
   * Fetch user name with fallback strategies
   * @private
   */
  async fetchUserName(username, token) {
    // Check cache first
    if (this.nameCache.has(username) && this.nameCache.get(username).name !== undefined) {
      const cached = this.nameCache.get(username);
      return { name: cached.name, status: cached.status, fromCache: true };
    }

    try {
      // Try API first
      const userData = await this.client.fetchUser(username);
      this.nameCache.set(username, {
        name: userData.name || '',
        status: userData.status,
        fetched_at: Date.now() / 1000 | 0
      });
      return { name: userData.name || '', status: userData.status, fromCache: false };
    } catch (error) {
      // Fallback to scraping GitHub profile page if API fails
      if (error.message.includes('403')) {
        return await this.scrapeGitHubProfile(username);
      }
      
      this.nameCache.set(username, { name: '', status: 'error' });
      return { name: '', status: 'error', fromCache: false };
    }
  }

  /**
   * Scrape GitHub profile page as fallback
   * @private
   */
  async scrapeGitHubProfile(username) {
    try {
      const html = await this.fetchText(`https://github.com/${username}`);
      const nameMatch = html.match(/itemprop="name"[^>]*>\s*([^<]+)\s*</) || 
                       html.match(/class="p-name[^"]*"[^>]*>\s*([^<]+)\s*</);
      
      let name = '';
      let status = 'no_name';
      
      if (nameMatch) {
        name = nameMatch[1].trim();
        if (name.toLowerCase() === username.toLowerCase()) {
          name = '';
        } else {
          status = 'ok';
        }
      }
      
      this.nameCache.set(username, { name, status });
      return { name, status, fromCache: false };
    } catch {
      this.nameCache.set(username, { name: '', status: 'scrape_failed' });
      return { name: '', status: 'scrape_failed', fromCache: false };
    }
  }

  /**
   * Fetch text content from URL
   * @private
   */
  fetchText(url, headers = {}) {
    return new Promise((resolve) => {
      https.get(url, { headers }, (res) => {
        let body = '';
        res.on('data', d => body += d);
        res.on('end', () => resolve(body));
      }).on('error', () => resolve(''));
    });
  }

  /**
   * Enrich CSV with GitHub user data
   */
  async enrichCSV(config) {
    const { input, outDir, cachePath } = config;
    
    if (!existsSync(input)) {
      throw new Error(`Input file not found: ${input}`);
    }
    
	ensureDir(outDir);
    
    // Load existing cache
    this.loadNameCache(cachePath);
    
	const token = process.env.GH_TOKEN || process.env.GITHUB_TOKEN;
    const csvText = readFileSync(input, 'utf8');
    const { header, rows } = this.parseCSV(csvText);
    
    if (!header.includes('Login')) {
      throw new Error('Input CSV missing Login column');
    }
    
    // Extract unique users
    const seen = new Set();
    const users = [];
    for (const row of rows) {
      const login = row.Login?.trim();
      if (!login || seen.has(login) || login.toLowerCase() === 'login') continue;
      seen.add(login);
      users.push(login);
    }
    
    console.log(`Processing ${users.length} unique users`);
    
    // Generate GitHub URLs file
    const urlFile = path.join(outDir, 'github-urls.txt');
    writeFileSync(urlFile, users.map(u => `https://github.com/${u}`).join('\n') + '\n', 'utf8');
	console.log(`Wrote ${users.length} URLs -> ${urlFile}`);
    
    // Enrich user data
    const enriched = {};
    for (let i = 0; i < users.length; i++) {
      const username = users[i];
      try {
        const { name, status, fromCache } = await this.fetchUserName(username, token);
        enriched[username] = { 
          name, 
          status, 
          cached: fromCache ? 'yes' : 'no' 
        };
        console.log(`[${i+1}/${users.length}] ${username}: ${status}${fromCache ? ' (cache)' : ''}`);
        
        // Rate limiting for unauthenticated requests
        if (!token && !fromCache) {
          await sleep(250);
        }
      } catch (error) {
        console.warn(`[${i+1}/${users.length}] ${username}: error - ${error.message}`);
        enriched[username] = { name: '', status: 'error', cached: 'no' };
      }
    }
    
    // Save updated cache
    this.saveNameCache(cachePath);
    
    // Generate enriched CSV
    const outHeader = [
      'Report Time', 'Login', 'GitHub URL', 'Name', 
      'Last Authenticated At', 'Last Activity At', 'Last Surface Used', 
      'Name Status', 'Cached'
    ];
    const lines = [outHeader.join(',')];
    
    for (const row of rows) {
      const login = row.Login || '';
      const meta = enriched[login] || {};
      
      const csvRow = [
        row['Report Time'] || '',
        login,
        `https://github.com/${login}`,
        meta.name || '',
        row['Last Authenticated At'] || '',
        row['Last Activity At'] || '',
        row['Last Surface Used'] || '',
        meta.status || '',
        meta.cached || ''
      ].map(v => cleanForCSV(v));
      
      lines.push(csvRow.join(','));
    }
    
    const outCSV = path.join(outDir, 'copilot-users.csv');
    writeFileSync(outCSV, addBOM(lines.join('\n')), 'utf8');
	console.log(`Wrote enriched CSV -> ${outCSV}`);
    
    return {
      inputFile: input,
      outputCSV: outCSV,
      urlsFile: urlFile,
      processedUsers: users.length,
      enrichedUsers: Object.keys(enriched).length
    };
  }
}

export async function enrich(options = {}) {
  const config = {
    input: 'data/github/seat-activity-sample.csv',
    outDir: 'output/csv/github',
    cachePath: 'data/github/name-cache.json',
    ...options
  };
  
  const service = new GitHubEnrichmentService(config);
  return await service.enrichCSV(config);
}

// CLI execution
if (import.meta.url === `file://${process.argv[1]}`) {
  const { values: args } = parseArgs({
    options: {
      input: { type: 'string', short: 'i', default: 'data/github/seat-activity-sample.csv' },
      'out-dir': { type: 'string', default: 'output/csv/github' },
      'cache-path': { type: 'string' },
      help: { type: 'boolean', short: 'h' }
    }
  });

  if (args.help) {
    console.log(`
Usage: node enrich.js [options]

Enrich CSV data with GitHub user information.
Processes a CSV file with Login column and adds user display names.

Options:
  -i, --input <file>       Input CSV file (default: data/github/seat-activity-sample.csv)
      --out-dir <path>     Output directory (default: output/csv/github)
      --cache-path <path>  Name cache file path (default: data/github/name-cache.json)
  -h, --help               Show this help

Environment Variables:
  GH_TOKEN                 GitHub token (for API access)

Examples:
  node enrich.js --input ./users.csv
  node enrich.js --input ./users.csv --out-dir ./output
`);
    process.exit(0);
  }

  try {
    const result = await enrich({
      input: args.input,
      outDir: args['out-dir'],
      cachePath: args['cache-path']
    });
    
    console.log(`\n✅ Completed successfully!`);
    console.log(`📄 Input: ${result.inputFile}`);
    console.log(`📊 Output CSV: ${result.outputCSV}`);
    console.log(`🔗 URLs file: ${result.urlsFile}`);
    console.log(`👥 Users processed: ${result.processedUsers}`);
    
  } catch (error) {
    console.error(`❌ Error: ${error.message}`);
    process.exit(1);
  }
}