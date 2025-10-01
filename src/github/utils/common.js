import { existsSync, mkdirSync } from 'node:fs';

/**
 * Sleep for specified milliseconds
 * @param {number} ms - Milliseconds to sleep
 * @returns {Promise<void>}
 */
export const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Ensure directory exists, creating it recursively if needed
 * @param {string} dirPath - Directory path to ensure
 */
export const ensureDir = dirPath => {
  if (!existsSync(dirPath)) {
    mkdirSync(dirPath, { recursive: true });
  }
};

/**
 * Normalize date string to ISO format
 * @param {string} dateStr - Date string (YYYY-MM-DD or ISO format)
 * @returns {string|undefined} - Normalized ISO date or undefined
 */
export const normalizeDate = (dateStr) => {
  if (!dateStr) return undefined;
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return `${dateStr}T00:00:00Z`;
  return dateStr;
};

/**
 * Generate timestamped filename
 * @param {string} prefix - File prefix
 * @param {string} suffix - File suffix/extension
 * @param {Date} timestamp - Optional timestamp (defaults to now)
 * @returns {string} - Timestamped filename
 */
export const generateTimestampedFilename = (prefix, suffix, timestamp = new Date()) => {
  const iso = timestamp.toISOString();
  const cleanTimestamp = iso.replace(/[:T]/g, '-').replace(/\..+/, '');
  return `${prefix}_${cleanTimestamp}${suffix}`;
};

/**
 * Create directory structure based on date
 * @param {string} baseDir - Base directory
 * @param {Date} date - Date to create structure for
 * @returns {string} - Created directory path
 */
export const createDateDirStructure = (baseDir, date = new Date()) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const dirPath = `${baseDir}/${year}/${month}/${day}`;
  ensureDir(dirPath);
  return dirPath;
};

/**
 * Clean string for CSV output (remove commas, trim whitespace)
 * @param {string} value - Value to clean
 * @returns {string} - Cleaned value
 */
export const cleanForCSV = (value) => {
  return (value || '').toString().replace(/,/g, ' ').trim();
};

/**
 * Add UTF-8 BOM for Excel compatibility
 * @param {string} content - CSV content
 * @returns {string} - Content with BOM
 */
export const addBOM = (content) => '\uFEFF' + content;

/**
 * Parse environment configuration
 * @returns {object} - Configuration object
 */
export const parseConfig = () => {
  return {
    org: process.env.GH_ORG,
    token: process.env.GH_TOKEN || process.env.GITHUB_TOKEN,
    apiBase: process.env.GH_API_BASE || 'https://api.github.com',
    dataDir: process.env.DATA_DIR || 'data/github',
    outputDir: process.env.OUTPUT_DIR || 'output/csv/github'
  };
};

/**
 * Validate required configuration
 * @param {object} config - Configuration object
 * @param {string[]} required - Required field names
 * @throws {Error} If required fields are missing
 */
export const validateConfig = (config, required = []) => {
  const missing = required.filter(field => !config[field]);
  if (missing.length > 0) {
    throw new Error(`Missing required configuration: ${missing.join(', ')}`);
  }
};

