import 'dotenv/config';
import { CursorClient } from '../client.js';

/**
 * Base service class for Cursor Admin API operations
 * Provides common functionality for authentication, configuration, and client management
 */
export class CursorBaseService {
  
  // Shared directory structure constants
  static DIRECTORIES = {
    SPEND: 'spend',
    USAGE_EVENTS: 'usage-events'
  };

  constructor(options = {}) {
    this.config = this.parseConfig(options);
    this.client = this.createClient();
  }

  /**
   * Parse configuration from options and environment variables
   * @param {Object} options - Override options
   * @returns {Object} - Parsed configuration
   */
  parseConfig(options = {}) {
    const config = {
      // API Configuration
      apiKey: options.apiKey || process.env.CURSOR_API_KEY || process.env.CURSOR_TOKEN,
      baseUrl: options.baseUrl || process.env.CURSOR_BASE_URL || 'https://api.cursor.com',
      
      // Data directories
      dataDir: options.dataDir || 'data/cursor',
      outputDir: options.outputDir || 'output/csv/cursor',
      
      // Request options
      delayMs: options.delayMs || 0,
      maxRetries: options.maxRetries || 3,
      timeout: options.timeout || 30000,
      
      // Override any additional options
      ...options
    };

    return config;
  }

  /**
   * Create and configure Cursor API client
   * @returns {CursorClient} - Configured client instance
   */
  createClient() {
    if (!this.config.apiKey) {
      throw new Error('Missing CURSOR_API_KEY environment variable');
    }

    return new CursorClient(this.config.baseUrl, this.config.apiKey);
  }

  /**
   * Validate required configuration fields
   * @param {Array} required - List of required field names
   * @throws {Error} - If required fields are missing
   */
  validateConfig(required = ['apiKey']) {
    const missing = [];
    
    for (const field of required) {
      if (!this.config[field]) {
        missing.push(field);
      }
    }

    if (missing.length > 0) {
      throw new Error(`Missing required configuration: ${missing.join(', ')}`);
    }
  }

  /**
   * Make a safe API request with error handling and retries
   * @param {Function} requestFn - Function that makes the API request
   * @param {Object} options - Request options
   * @returns {Promise<Object>} - API response
   */
  async safeRequest(requestFn, options = {}) {
    const { maxRetries = this.config.maxRetries, delayMs = this.config.delayMs } = options;
    
    let lastError;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const result = await requestFn();
        
        if (result.ok) {
          return result;
        } else {
          throw new Error(`API request failed with status ${result.status}`);
        }
        
      } catch (error) {
        lastError = error;
        
        if (attempt < maxRetries) {
          console.warn(`[cursor-api] Attempt ${attempt} failed, retrying in ${delayMs}ms: ${error.message}`);
          if (delayMs > 0) {
            await this.sleep(delayMs);
          }
        }
      }
    }

    throw new Error(`API request failed after ${maxRetries} attempts: ${lastError.message}`);
  }

  /**
   * Sleep for specified milliseconds
   * @param {number} ms - Milliseconds to sleep
   * @returns {Promise<void>}
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Format date to ISO string
   * @param {Date|string|number} date - Date to format
   * @returns {string} - ISO formatted date
   */
  formatDate(date) {
    if (!date) return '';
    
    if (typeof date === 'number') {
      // Handle unix timestamps (seconds or milliseconds)
      if (date < 1e12) date *= 1000;
      return new Date(date).toISOString();
    }
    
    if (typeof date === 'string') {
      return new Date(date).toISOString();
    }
    
    if (date instanceof Date) {
      return date.toISOString();
    }
    
    return date.toString();
  }

  /**
   * Get date range for queries
   * @param {Object} options - Date range options
   * @returns {Object} - Start and end dates
   */
  getDateRange(options = {}) {
    const { days = 7, startDate, endDate } = options;
    
    let start, end;
    
    if (startDate && endDate) {
      start = new Date(startDate);
      end = new Date(endDate);
    } else {
      end = new Date();
      start = new Date(end);
      start.setDate(start.getDate() - days);
    }
    
    return {
      startDate: start.toISOString().split('T')[0],
      endDate: end.toISOString().split('T')[0]
    };
  }
}
