import { writeFileSync, existsSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { CursorBaseService } from './CursorBaseService.js';
import { ensureDir, readJSON, writeJSON } from '../../common/fs.js';

/**
 * Service for managing Cursor activity data
 * Handles fetching daily, weekly, and monthly activity data
 */
export class CursorActivityService extends CursorBaseService {
  constructor(options = {}) {
    super(options);
  }

  /**
   * Fetch daily activity data for a specific date
   * @param {Object} options - Fetch options
   * @returns {Promise<Object>} - Activity data and file path
   */
  async fetchDailyActivity(options = {}) {
    this.validateConfig();
    
    const { date = new Date().toISOString().split('T')[0] } = options;
    
    console.log(`Fetching daily activity for date: ${date}`);
    
    try {
      // Admin API uses POST /teams/daily-usage-data with epoch millis
      const d = new Date(date);
      const start = new Date(d.getFullYear(), d.getMonth(), d.getDate());
      const end = start; // same day
      const response = await this.safeRequest(
        () => this.client.post('/teams/daily-usage-data', { startDate: start.getTime(), endDate: end.getTime() })
      );

      const activityData = response.json;
      
      // Save data
      const filePath = await this.saveDailyActivity(activityData, date);
      
      console.log(`✓ Successfully fetched daily activity: ${activityData.data?.length || 0} records`);
      
      return {
        filePath,
        data: activityData,
        date,
        count: activityData.data?.length || 0
      };
      
    } catch (error) {
      console.error(`❌ Failed to fetch daily activity for ${date}:`, error.message);
      throw error;
    }
  }

  /**
   * Fetch monthly activity data for a date range
   * @param {Object} options - Fetch options
   * @returns {Promise<Object>} - Activity data and file path
   */
  async fetchMonthlyActivity(options = {}) {
    this.validateConfig();
    
    const dateRange = this.getDateRange({ days: 30, ...options });
    const { startDate, endDate } = dateRange;
    
    console.log(`Fetching monthly activity: ${startDate} to ${endDate}`);
    
    try {
      // Admin API uses POST /teams/daily-usage-data for ranges
      const start = new Date(startDate);
      const end = new Date(endDate);
      const response = await this.safeRequest(
        () => this.client.post('/teams/daily-usage-data', { startDate: start.getTime(), endDate: end.getTime() })
      );

      const activityData = response.json;
      
      // Save data
      const filePath = await this.saveMonthlyActivity(activityData, startDate, endDate);
      
      console.log(`✓ Successfully fetched monthly activity: ${activityData.data?.length || 0} records`);
      
      return {
        filePath,
        data: activityData,
        dateRange,
        count: activityData.data?.length || 0
      };
      
    } catch (error) {
      console.error(`❌ Failed to fetch monthly activity:`, error.message);
      throw error;
    }
  }

  /**
   * Fetch weekly activity data
   * @param {Object} options - Fetch options
   * @returns {Promise<Object>} - Activity data and file path
   */
  async fetchWeeklyActivity(options = {}) {
    this.validateConfig();
    
    const dateRange = this.getDateRange({ days: 7, ...options });
    const { startDate, endDate } = dateRange;
    
    console.log(`Fetching weekly activity: ${startDate} to ${endDate}`);
    
    try {
      // Admin API uses POST /teams/daily-usage-data for ranges
      const start = new Date(startDate);
      const end = new Date(endDate);
      const response = await this.safeRequest(
        () => this.client.post('/teams/daily-usage-data', { startDate: start.getTime(), endDate: end.getTime() })
      );

      const activityData = response.json;
      
      // Save data
      const filePath = await this.saveWeeklyActivity(activityData, startDate, endDate);
      
      console.log(`✓ Successfully fetched weekly activity: ${activityData.data?.length || 0} records`);
      
      return {
        filePath,
        data: activityData,
        dateRange,
        count: activityData.data?.length || 0
      };
      
    } catch (error) {
      console.error(`❌ Failed to fetch weekly activity:`, error.message);
      throw error;
    }
  }

  /**
   * Validate and parse date string
   * @private
   * @param {string} date - Date string to validate
   * @param {string} context - Context for error messages
   * @returns {Date} - Valid Date object
   * @throws {Error} - If date is invalid
   */
  validateDate(date, context = 'operation') {
    if (!date) {
      throw new Error(`Date parameter is required for ${context}`);
    }
    
    if (typeof date !== 'string') {
      throw new Error(`Date parameter must be a string for ${context}, got: ${typeof date}`);
    }
    
    const dateObj = new Date(date);
    
    if (isNaN(dateObj.getTime())) {
      throw new Error(`Invalid date format for ${context}: ${date}. Expected format: YYYY-MM-DD`);
    }
    
    // Additional validation for reasonable date ranges (not before 2020 or too far in future)
    const year = dateObj.getFullYear();
    if (year < 2020 || year > 2030) {
      throw new Error(`Date year out of reasonable range for ${context}: ${date}. Year should be between 2020-2030`);
    }
    
    return dateObj;
  }

  /**
   * Save daily activity data to file
   * @private
   */
  async saveDailyActivity(data, date) {
    const dateObj = this.validateDate(date, 'daily activity save');
    const year = dateObj.getFullYear();
    const month = String(dateObj.getMonth() + 1).padStart(2, '0');
    const day = String(dateObj.getDate()).padStart(2, '0');
    
    const outputDir = path.join(this.config.dataDir, String(year), month, day);
    ensureDir(outputDir);
    
    const fileName = `daily_activity_${date}.json`;
    const filePath = path.join(outputDir, fileName);
    
    const outputData = {
      meta: {
        fetched_at: new Date().toISOString(),
        date: date,
        type: 'daily_activity'
      },
      data: data.data || data
    };
    
    writeFileSync(filePath, JSON.stringify(outputData, null, 2), 'utf8');
    console.log(`✓ Saved daily activity data: ${filePath}`);
    
    return filePath;
  }

  /**
   * Save monthly activity data to file
   * @private
   */
  async saveMonthlyActivity(data, startDate, endDate) {
    const startDateObj = this.validateDate(startDate, 'monthly activity save (start date)');
    const endDateObj = this.validateDate(endDate, 'monthly activity save (end date)');
    const year = startDateObj.getFullYear();
    const month = String(startDateObj.getMonth() + 1).padStart(2, '0');
    
    const outputDir = path.join(this.config.dataDir, String(year), month);
    ensureDir(outputDir);
    
    const fileName = `monthly_activity_${startDate}_${endDate}.json`;
    const filePath = path.join(outputDir, fileName);
    
    const outputData = {
      meta: {
        fetched_at: new Date().toISOString(),
        start_date: startDate,
        end_date: endDate,
        type: 'monthly_activity'
      },
      data: data.data || data
    };
    
    writeFileSync(filePath, JSON.stringify(outputData, null, 2), 'utf8');
    console.log(`✓ Saved monthly activity data: ${filePath}`);
    
    return filePath;
  }

  /**
   * Save weekly activity data to file
   * @private
   */
  async saveWeeklyActivity(data, startDate, endDate) {
    // Validate dates to ensure proper file naming
    this.validateDate(startDate, 'weekly activity save (start date)');
    this.validateDate(endDate, 'weekly activity save (end date)');
    
    const outputDir = this.config.dataDir;
    ensureDir(outputDir);
    
    const fileName = `weekly-report_${startDate}_${endDate}.json`;
    const filePath = path.join(outputDir, fileName);
    
    const outputData = {
      meta: {
        fetched_at: new Date().toISOString(),
        start_date: startDate,
        end_date: endDate,
        type: 'weekly_activity'
      },
      data: data.data || data
    };
    
    writeFileSync(filePath, JSON.stringify(outputData, null, 2), 'utf8');
    console.log(`✓ Saved weekly activity data: ${filePath}`);
    
    return filePath;
  }

  /**
   * Get the most recent activity file of a given type
   * @param {string} type - Activity type ('daily', 'monthly', 'weekly')
   * @returns {string|null} - Path to most recent file or null if none found
   */
  findLatestActivity(type = 'monthly') {
    const files = this.findActivityFiles(type);
    if (!files.length) return null;
    
    return files.sort().pop(); // Get most recent file
  }

  /**
   * Find all activity files of a given type
   * @param {string} type - Activity type ('daily', 'monthly', 'weekly')  
   * @returns {Array<string>} - Array of file paths
   */
  findActivityFiles(type = 'monthly') {
    const files = [];
    
    const searchPatterns = {
      daily: /^daily_activity_\d{4}-\d{2}-\d{2}\.json$/,
      monthly: /^monthly_activity_\d{4}-\d{2}-\d{2}_\d{4}-\d{2}-\d{2}\.json$/,
      weekly: /^weekly-report_\d{4}-\d{2}-\d{2}_\d{4}-\d{2}-\d{2}\.json$/
    };
    
    const pattern = searchPatterns[type];
    if (!pattern) return files;
    
    const walkDir = (dir) => {
      if (!existsSync(dir)) return;
      
      try {
        const entries = readdirSync(dir, { withFileTypes: true });
        
        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name);
          
          if (entry.isDirectory()) {
            walkDir(fullPath);
          } else if (entry.isFile() && pattern.test(entry.name)) {
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

  /**
   * Get activity statistics from data
   * @param {Object} data - Activity data
   * @returns {Object} - Statistics summary
   */
  getActivityStats(data) {
    if (!data || !Array.isArray(data.data)) {
      return { totalRecords: 0, activeUsers: 0, inactiveUsers: 0 };
    }

    const records = data.data;
    const userStats = new Map();
    
    for (const record of records) {
      const userId = record.userId || 'unknown';
      const isActive = record.isActive || false;
      
      if (!userStats.has(userId)) {
        userStats.set(userId, { active: 0, total: 0 });
      }
      
      const stats = userStats.get(userId);
      stats.total++;
      if (isActive) {
        stats.active++;
      }
    }
    
    const activeUsers = Array.from(userStats.values())
      .filter(stats => stats.active > 0).length;
    const inactiveUsers = userStats.size - activeUsers;
    
    return {
      totalRecords: records.length,
      uniqueUsers: userStats.size,
      activeUsers,
      inactiveUsers,
      activeUserPercentage: userStats.size > 0 
        ? ((activeUsers / userStats.size) * 100).toFixed(1) 
        : 0
    };
  }
}
