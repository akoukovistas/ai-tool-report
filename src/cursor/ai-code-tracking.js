import path from 'node:path';
import { createWriteStream } from 'node:fs';
import { pipeline } from 'node:stream/promises';
import { ensureDir, writeJSON } from '../common/fs.js';
import { CursorClient, loadKey } from './client.js';

/**
 * Cursor AI Code Tracking API Client
 * 
 * This service provides access to AI-generated code analytics for enterprise teams.
 * Includes per-commit AI usage and granular accepted AI changes.
 * 
 * API Documentation: https://docs.cursor.com/en/account/teams/ai-code-tracking-api
 * 
 * Note: This API is only available for enterprise teams and is currently in Alpha.
 * Response shapes and fields may change.
 */

/**
 * Build query string from parameters
 * @param {Object} params - Query parameters
 * @returns {string} Query string
 */
function buildQueryString(params) {
  const filtered = Object.entries(params)
    .filter(([_, value]) => value !== undefined && value !== null)
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`);
  
  return filtered.length > 0 ? `?${filtered.join('&')}` : '';
}

/**
 * Parse and validate query parameters
 * @param {Object} options - Raw options
 * @returns {Object} Parsed parameters
 */
function parseQueryParams(options = {}) {
  const {
    startDate,
    endDate,
    page,
    pageSize,
    user,
    ...rest
  } = options;

  const params = {};
  
  // Handle date parameters (ISO strings, "now", or relative like "7d")
  if (startDate) params.startDate = startDate;
  if (endDate) params.endDate = endDate;
  
  // Handle pagination
  if (page) params.page = typeof page === 'string' ? parseInt(page, 10) : page;
  if (pageSize) params.pageSize = typeof pageSize === 'string' ? parseInt(pageSize, 10) : pageSize;
  
  // Handle user filter (email, encoded ID, or numeric ID)
  if (user) params.user = user;

  return { params, ...rest };
}

/**
 * Get AI Commit Metrics (JSON, paginated)
 * 
 * Retrieve aggregated per-commit metrics that attribute lines to TAB, COMPOSER, and non-AI.
 * 
 * @param {Object} options - Query options
 * @param {string} [options.startDate] - Start date (ISO, "now", or relative like "7d")
 * @param {string} [options.endDate] - End date (ISO, "now", or relative like "0d")
 * @param {number} [options.page=1] - Page number (1-based)
 * @param {number} [options.pageSize=100] - Results per page (max 1000)
 * @param {string} [options.user] - Filter by user (email, encoded ID, or numeric ID)
 * @param {string} [options.baseUrl='https://api.cursor.com'] - API base URL
 * @returns {Promise<Object>} Commit metrics response
 */
export async function getAiCommitMetrics({
  startDate,
  endDate,
  page = 1,
  pageSize = 100,
  user,
  baseUrl = 'https://api.cursor.com'
} = {}) {
  const key = loadKey();
  if (!key) throw new Error('Missing CURSOR_API_KEY');

  const client = new CursorClient(baseUrl, key);
  const { params } = parseQueryParams({ startDate, endDate, page, pageSize, user });
  const queryString = buildQueryString(params);
  
  console.log(`Fetching AI commit metrics (JSON)...`);
  if (params.startDate || params.endDate) {
    console.log(`Date range: ${params.startDate || 'beginning'} to ${params.endDate || 'now'}`);
  }
  if (params.user) console.log(`Filtering by user: ${params.user}`);
  console.log(`Page ${params.page || 1}, size ${params.pageSize || 100}`);

  const res = await client.get(`/analytics/ai-code/commits${queryString}`);
  if (!res.ok) {
    console.error(`HTTP ${res.status} response:`, JSON.stringify(res.json, null, 2));
    const errorMsg = res.json?.message || res.json?.error || 'Unknown error';
    if (res.status === 401 || res.status === 403) {
      throw new Error(`AI Code Tracking API access denied (${res.status}): ${errorMsg}. Note: This API is only available for enterprise teams.`);
    }
    throw new Error(`AI commit metrics failed ${res.status}: ${errorMsg}`);
  }

  // Save the response
  const dir = 'data/cursor/ai-code-tracking/commits';
  ensureDir(dir);
  
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `commits-json_${timestamp}_page-${params.page || 1}.json`;
  const filepath = path.join(dir, filename);
  writeJSON(filepath, res.json);

  console.log(`Saved AI commit metrics: ${filename}`);
  console.log(`Total commits: ${res.json.totalCount || 0}`);
  console.log(`Page ${res.json.page || 1} of ${Math.ceil((res.json.totalCount || 0) / (res.json.pageSize || 100))}`);

  return res.json;
}

/**
 * Download AI Commit Metrics (CSV, streaming)
 * 
 * Download commit metrics data in CSV format for large data extractions.
 * This endpoint streams data in chunks for efficient handling of large datasets.
 * 
 * @param {Object} options - Query options
 * @param {string} [options.startDate] - Start date (ISO, "now", or relative like "7d")
 * @param {string} [options.endDate] - End date (ISO, "now", or relative like "0d")
 * @param {string} [options.user] - Filter by user (email, encoded ID, or numeric ID)
 * @param {string} [options.baseUrl='https://api.cursor.com'] - API base URL
 * @param {string} [options.outputFile] - Custom output file path
 * @returns {Promise<string>} Path to saved CSV file
 */
export async function downloadAiCommitMetricsCsv({
  startDate,
  endDate,
  user,
  baseUrl = 'https://api.cursor.com',
  outputFile
} = {}) {
  const key = loadKey();
  if (!key) throw new Error('Missing CURSOR_API_KEY');

  const { params } = parseQueryParams({ startDate, endDate, user });
  const queryString = buildQueryString(params);
  
  console.log(`Downloading AI commit metrics (CSV)...`);
  if (params.startDate || params.endDate) {
    console.log(`Date range: ${params.startDate || 'beginning'} to ${params.endDate || 'now'}`);
  }
  if (params.user) console.log(`Filtering by user: ${params.user}`);

  // Prepare output directory and file
  const dir = 'data/cursor/ai-code-tracking/commits';
  ensureDir(dir);
  
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = outputFile || `commits-csv_${timestamp}.csv`;
  const filepath = path.resolve(path.join(dir, path.basename(filename)));

  // Create HTTP request manually to handle streaming
  const https = await import('https');
  const url = new URL(`${baseUrl}/analytics/ai-code/commits.csv${queryString}`);
  const auth = Buffer.from(`${key}:`).toString('base64');
  
  const options = {
    hostname: url.hostname,
    port: url.port || 443,
    path: url.pathname + url.search,
    method: 'GET',
    headers: {
      'Authorization': `Basic ${auth}`,
      'Accept': 'text/csv'
    }
  };

  return new Promise((resolve, reject) => {
    const req = https.default.request(options, (res) => {
      if (res.statusCode !== 200) {
        let errorData = '';
        res.on('data', chunk => errorData += chunk);
        res.on('end', () => {
          console.error(`HTTP ${res.statusCode} ${res.statusMessage}`);
          console.error(`Response headers:`, res.headers);
          console.error(`Response body:`, errorData);
          reject(new Error(`Download failed ${res.statusCode}: ${errorData}`));
        });
        return;
      }

      console.log(`Streaming CSV data to: ${filepath}`);
      const writeStream = createWriteStream(filepath);
      
      let bytesReceived = 0;
      res.on('data', (chunk) => {
        bytesReceived += chunk.length;
        if (bytesReceived % (1024 * 1024) === 0) { // Log every MB
          console.log(`Downloaded ${Math.round(bytesReceived / 1024 / 1024)}MB...`);
        }
      });

      pipeline(res, writeStream)
        .then(() => {
          console.log(`\nDownload complete:`);
          console.log(`- File: ${filepath}`);
          console.log(`- Size: ${Math.round(bytesReceived / 1024)} KB`);
          resolve(filepath);
        })
        .catch(reject);
    });

    req.on('error', reject);
    req.end();
  });
}

/**
 * Get AI Code Change Metrics (JSON, paginated)
 * 
 * Retrieve granular accepted AI changes, grouped by deterministic changeId.
 * Useful to analyze accepted AI events independent of commits.
 * 
 * @param {Object} options - Query options
 * @param {string} [options.startDate] - Start date (ISO, "now", or relative like "7d")
 * @param {string} [options.endDate] - End date (ISO, "now", or relative like "0d")
 * @param {number} [options.page=1] - Page number (1-based)
 * @param {number} [options.pageSize=100] - Results per page (max 1000)
 * @param {string} [options.user] - Filter by user (email, encoded ID, or numeric ID)
 * @param {string} [options.baseUrl='https://api.cursor.com'] - API base URL
 * @returns {Promise<Object>} Code change metrics response
 */
export async function getAiCodeChangeMetrics({
  startDate,
  endDate,
  page = 1,
  pageSize = 100,
  user,
  baseUrl = 'https://api.cursor.com'
} = {}) {
  const key = loadKey();
  if (!key) throw new Error('Missing CURSOR_API_KEY');

  const client = new CursorClient(baseUrl, key);
  const { params } = parseQueryParams({ startDate, endDate, page, pageSize, user });
  const queryString = buildQueryString(params);
  
  console.log(`Fetching AI code change metrics (JSON)...`);
  if (params.startDate || params.endDate) {
    console.log(`Date range: ${params.startDate || 'beginning'} to ${params.endDate || 'now'}`);
  }
  if (params.user) console.log(`Filtering by user: ${params.user}`);
  console.log(`Page ${params.page || 1}, size ${params.pageSize || 100}`);

  const res = await client.get(`/analytics/ai-code/changes${queryString}`);
  if (!res.ok) {
    console.error(`HTTP ${res.status} response:`, JSON.stringify(res.json, null, 2));
    const errorMsg = res.json?.message || res.json?.error || 'Unknown error';
    if (res.status === 401 || res.status === 403) {
      throw new Error(`AI Code Tracking API access denied (${res.status}): ${errorMsg}. Note: This API is only available for enterprise teams.`);
    }
    throw new Error(`AI code change metrics failed ${res.status}: ${errorMsg}`);
  }

  // Save the response
  const dir = 'data/cursor/ai-code-tracking/changes';
  ensureDir(dir);
  
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `changes-json_${timestamp}_page-${params.page || 1}.json`;
  const filepath = path.join(dir, filename);
  writeJSON(filepath, res.json);

  console.log(`Saved AI code change metrics: ${filename}`);
  console.log(`Total changes: ${res.json.totalCount || 0}`);
  console.log(`Page ${res.json.page || 1} of ${Math.ceil((res.json.totalCount || 0) / (res.json.pageSize || 100))}`);

  return res.json;
}

/**
 * Download AI Code Change Metrics (CSV, streaming)
 * 
 * Download change metrics data in CSV format for large data extractions.
 * This endpoint streams data in chunks for efficient handling of large datasets.
 * 
 * @param {Object} options - Query options
 * @param {string} [options.startDate] - Start date (ISO, "now", or relative like "7d")
 * @param {string} [options.endDate] - End date (ISO, "now", or relative like "0d")
 * @param {string} [options.user] - Filter by user (email, encoded ID, or numeric ID)
 * @param {string} [options.baseUrl='https://api.cursor.com'] - API base URL
 * @param {string} [options.outputFile] - Custom output file path
 * @returns {Promise<string>} Path to saved CSV file
 */
export async function downloadAiCodeChangeMetricsCsv({
  startDate,
  endDate,
  user,
  baseUrl = 'https://api.cursor.com',
  outputFile
} = {}) {
  const key = loadKey();
  if (!key) throw new Error('Missing CURSOR_API_KEY');

  const { params } = parseQueryParams({ startDate, endDate, user });
  const queryString = buildQueryString(params);
  
  console.log(`Downloading AI code change metrics (CSV)...`);
  if (params.startDate || params.endDate) {
    console.log(`Date range: ${params.startDate || 'beginning'} to ${params.endDate || 'now'}`);
  }
  if (params.user) console.log(`Filtering by user: ${params.user}`);

  // Prepare output directory and file
  const dir = 'data/cursor/ai-code-tracking/changes';
  ensureDir(dir);
  
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = outputFile || `changes-csv_${timestamp}.csv`;
  const filepath = path.resolve(path.join(dir, path.basename(filename)));

  // Create HTTP request manually to handle streaming
  const https = await import('https');
  const url = new URL(`${baseUrl}/analytics/ai-code/changes.csv${queryString}`);
  const auth = Buffer.from(`${key}:`).toString('base64');
  
  const options = {
    hostname: url.hostname,
    port: url.port || 443,
    path: url.pathname + url.search,
    method: 'GET',
    headers: {
      'Authorization': `Basic ${auth}`,
      'Accept': 'text/csv'
    }
  };

  return new Promise((resolve, reject) => {
    const req = https.default.request(options, (res) => {
      if (res.statusCode !== 200) {
        let errorData = '';
        res.on('data', chunk => errorData += chunk);
        res.on('end', () => {
          console.error(`HTTP ${res.statusCode} ${res.statusMessage}`);
          console.error(`Response headers:`, res.headers);
          console.error(`Response body:`, errorData);
          reject(new Error(`Download failed ${res.statusCode}: ${errorData}`));
        });
        return;
      }

      console.log(`Streaming CSV data to: ${filepath}`);
      const writeStream = createWriteStream(filepath);
      
      let bytesReceived = 0;
      res.on('data', (chunk) => {
        bytesReceived += chunk.length;
        if (bytesReceived % (1024 * 1024) === 0) { // Log every MB
          console.log(`Downloaded ${Math.round(bytesReceived / 1024 / 1024)}MB...`);
        }
      });

      pipeline(res, writeStream)
        .then(() => {
          console.log(`\nDownload complete:`);
          console.log(`- File: ${filepath}`);
          console.log(`- Size: ${Math.round(bytesReceived / 1024)} KB`);
          resolve(filepath);
        })
        .catch(reject);
    });

    req.on('error', reject);
    req.end();
  });
}

/**
 * Fetch all AI Code Tracking data
 * 
 * Convenience function to fetch both commit and change metrics in JSON format.
 * For large datasets, consider using the CSV streaming endpoints instead.
 * 
 * @param {Object} options - Query options
 * @param {boolean} [options.continueOnError=false] - Continue if one endpoint fails
 * @returns {Promise<Object>} Combined results
 */
export async function fetchAllAiCodeMetrics({ continueOnError = false, ...options } = {}) {
  const results = {
    commits: null,
    changes: null,
    errors: []
  };

  const steps = [
    ['commits', () => getAiCommitMetrics(options)],
    ['changes', () => getAiCodeChangeMetrics(options)]
  ];

  for (const [label, fn] of steps) {
    try {
      console.log(`\n=== Fetching ${label} ===`);
      results[label] = await fn();
    } catch (e) {
      console.error(`[ai-code-tracking] ${label} failed:`, e.message);
      results.errors.push({ endpoint: label, error: e.message });
      if (!continueOnError) throw e;
    }
  }

  return results;
}
