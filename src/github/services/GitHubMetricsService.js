import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { GitHubBaseService } from './GitHubBaseService.js';
import { normalizeDate, createDateDirStructure } from '../utils/common.js';

/**
 * Service for fetching and managing GitHub Copilot metrics
 */
export class GitHubMetricsService extends GitHubBaseService {
  constructor(options = {}) {
    super(options);
  }

  /**
   * Fetch organization Copilot metrics
   * @param {Object} options - Fetch options
   * @returns {Promise<Object>} - Result with metrics and file path
   */
  async fetchOrgMetrics(options = {}) {
    this.validateConfig();
    
    const fetchConfig = { ...this.config, ...options };
    const { org, since, until, perPage = 100, delayMs = 0, singlePage = false, page = 1 } = fetchConfig;

    console.log(`Fetching Copilot metrics for organization: ${org}`);
    
    try {
      // Prepare API parameters
      const params = {};
      if (since) params.since = normalizeDate(since);
      if (until) params.until = normalizeDate(until);

      const requestOptions = {
        perPage,
        delayMs,
        singlePage,
        startPage: page
      };

      // Fetch metrics from GitHub API
      const metrics = await this.client.fetchOrgMetrics(org, params, requestOptions);
      
      // Save results
      const result = await this.saveMetrics(metrics, {
        org,
        since: params.since,
        until: params.until,
        dataDir: fetchConfig.dataDir
      });

      console.log(`✓ Successfully fetched ${metrics.length} metric records`);
      return result;
      
    } catch (error) {
      console.error('❌ Failed to fetch metrics:', error.message);
      throw error;
    }
  }

  /**
   * Save metrics to file system
   * @private
   */
  async saveMetrics(metrics, metadata) {
    const fetchedAt = new Date().toISOString();
    const outputDir = createDateDirStructure(path.join(metadata.dataDir || 'data/github', 'metrics'));
    
    // Generate filename following pattern: copilot-metrics_{org_name}_YYYY-MM-DD_to_YYYY-MM-DD
    let startDate, endDate;
    
    if (metadata.since || metadata.until) {
      // Use specified date range, extract YYYY-MM-DD part
      startDate = metadata.since ? metadata.since.split('T')[0] : 'unspecified';
      endDate = metadata.until ? metadata.until.split('T')[0] : 'unspecified';
    } else {
      // No date range specified - use actual data range if available
      if (metrics.length > 0) {
        const dates = metrics.map(m => m.date).filter(Boolean).sort();
        if (dates.length > 0) {
          startDate = dates[0];
          endDate = dates[dates.length - 1];
        } else {
          startDate = endDate = 'unknown';
        }
      } else {
        startDate = endDate = 'unknown';
      }
    }
    
    const fileName = `copilot-metrics_${metadata.org}_${startDate}_to_${endDate}.json`;
    const filePath = path.join(outputDir, fileName);
    
    // Prepare output structure
    const output = {
      meta: {
        org: metadata.org,
        fetched_at: fetchedAt,
        count_days: metrics.length,
        since: metadata.since,
        until: metadata.until
      },
      data: metrics
    };

    writeFileSync(filePath, JSON.stringify(output, null, 2), 'utf8');
    console.log(`✓ Saved to: ${filePath}`);
    
    return { 
      jsonPath: filePath, 
      count: metrics.length, 
      items: metrics 
    };
  }

  /**
   * Get metrics summary statistics
   * @param {Array} metrics - Metrics data
   * @returns {Object} - Summary statistics
   */
  getMetricsSummary(metrics) {
    if (!metrics || !metrics.length) {
      return { count: 0, dateRange: null };
    }

    const dates = metrics
      .map(m => m.date)
      .filter(Boolean)
      .sort();
    
    return {
      count: metrics.length,
      dateRange: dates.length > 0 ? {
        start: dates[0],
        end: dates[dates.length - 1]
      } : null,
      totalActiveUsers: metrics.reduce((sum, m) => sum + (m.total_active_users || 0), 0),
      totalEngagedUsers: metrics.reduce((sum, m) => sum + (m.total_engaged_users || 0), 0)
    };
  }
}
