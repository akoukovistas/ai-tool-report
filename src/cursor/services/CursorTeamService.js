import { writeFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { CursorBaseService } from './CursorBaseService.js';
import { ensureDir, readJSON } from '../../common/fs.js';

/**
 * Service for managing Cursor team and user data
 * Handles team member information, spend data, and user management
 */
export class CursorTeamService extends CursorBaseService {
  constructor(options = {}) {
    super(options);
  }

  /**
   * Fetch team members data
   * @param {Object} options - Fetch options
   * @returns {Promise<Object>} - Team members data and file path
   */
  async fetchTeamMembers(options = {}) {
    this.validateConfig();
    
    console.log('Fetching team members data...');
    
    try {
      const response = await this.safeRequest(
        () => this.client.get('/api/team/members')
      );

      const teamData = response.json;
      
      // Save data
      const filePath = await this.saveTeamMembers(teamData);
      
      console.log(`✓ Successfully fetched team members: ${teamData.teamMembers?.length || 0} members`);
      
      return {
        filePath,
        data: teamData,
        count: teamData.teamMembers?.length || 0
      };
      
    } catch (error) {
      console.error('❌ Failed to fetch team members:', error.message);
      throw error;
    }
  }

  /**
   * Fetch team spend data with pagination
   * @param {Object} options - Fetch options
   * @returns {Promise<Object>} - Spend data and file paths
   */
  async fetchTeamSpend(options = {}) {
    this.validateConfig();
    
    const { maxPages = 10, pageSize = 100 } = options;
    
    console.log('Fetching team spend data...');
    
    try {
      const spendFiles = [];
      let page = 1;
      let hasMore = true;
      
      while (hasMore && page <= maxPages) {
        console.log(`Fetching spend page ${page}...`);
        
        const response = await this.safeRequest(
          () => this.client.get(`/api/team/spend?page=${page}&pageSize=${pageSize}`)
        );

        const spendData = response.json;
        
        // Save page data
        const filePath = await this.saveSpendPage(spendData, page);
        spendFiles.push(filePath);
        
        // Check if there are more pages
        hasMore = spendData.teamMemberSpend && 
                  spendData.teamMemberSpend.length === pageSize;
        page++;
        
        // Add delay between requests
        if (hasMore && this.config.delayMs > 0) {
          await this.sleep(this.config.delayMs);
        }
      }
      
      console.log(`✓ Successfully fetched spend data: ${spendFiles.length} page(s)`);
      
      return {
        filePaths: spendFiles,
        pageCount: spendFiles.length
      };
      
    } catch (error) {
      console.error('❌ Failed to fetch team spend:', error.message);
      throw error;
    }
  }

  /**
   * Fetch usage events with filtering and pagination
   * @param {Object} options - Fetch options
   * @returns {Promise<Object>} - Usage events data and file paths
   */
  async fetchUsageEvents(options = {}) {
    this.validateConfig();
    
    const {
      startDate,
      endDate,
      email,
      userId,
      model,
      pageSize = 100,
      maxPages = 50,
      page = 1
    } = options;
    
    console.log('Fetching usage events...');
    
    try {
      const eventFiles = [];
      let currentPage = page;
      let hasMore = true;
      
      while (hasMore && currentPage <= maxPages) {
        const queryParams = new URLSearchParams({
          page: currentPage,
          pageSize
        });
        
        // Add optional filters
        if (startDate) queryParams.append('startDate', startDate);
        if (endDate) queryParams.append('endDate', endDate);
        if (email) queryParams.append('email', email);
        if (userId) queryParams.append('userId', userId);
        if (model) queryParams.append('model', model);
        
        console.log(`Fetching usage events page ${currentPage}...`);
        
        const response = await this.safeRequest(
          () => this.client.get(`/api/usage/events?${queryParams}`)
        );

        const eventsData = response.json;
        
        // Save page data
        const filePath = await this.saveUsageEventsPage(eventsData, currentPage, options);
        eventFiles.push(filePath);
        
        // Check if there are more pages
        hasMore = eventsData.usageEvents && 
                  eventsData.usageEvents.length === pageSize;
        currentPage++;
        
        // Add delay between requests
        if (hasMore && this.config.delayMs > 0) {
          await this.sleep(this.config.delayMs);
        }
      }
      
      console.log(`✓ Successfully fetched usage events: ${eventFiles.length} page(s)`);
      
      return {
        filePaths: eventFiles,
        pageCount: eventFiles.length
      };
      
    } catch (error) {
      console.error('❌ Failed to fetch usage events:', error.message);
      throw error;
    }
  }

  /**
   * Save team members data to file
   * @private
   */
  async saveTeamMembers(data) {
    const outputDir = this.config.dataDir;
    ensureDir(outputDir);
    
    const fileName = 'team-members.json';
    const filePath = path.join(outputDir, fileName);
    
    const outputData = {
      meta: {
        fetched_at: new Date().toISOString(),
        type: 'team_members'
      },
      ...data
    };
    
    writeFileSync(filePath, JSON.stringify(outputData, null, 2), 'utf8');
    console.log(`✓ Saved team members data: ${filePath}`);
    
    return filePath;
  }

  /**
   * Save spend page data to file
   * @private
   */
  async saveSpendPage(data, page) {
    const outputDir = path.join(this.config.dataDir, CursorBaseService.DIRECTORIES.SPEND);
    ensureDir(outputDir);
    
    const fileName = `page-${page}.json`;
    const filePath = path.join(outputDir, fileName);
    
    const outputData = {
      meta: {
        fetched_at: new Date().toISOString(),
        page: page,
        type: 'team_spend'
      },
      ...data
    };
    
    writeFileSync(filePath, JSON.stringify(outputData, null, 2), 'utf8');
    console.log(`✓ Saved spend page ${page}: ${filePath}`);
    
    return filePath;
  }

  /**
   * Save usage events page data to file
   * @private
   */
  async saveUsageEventsPage(data, page, options = {}) {
    const outputDir = path.join(this.config.dataDir, CursorBaseService.DIRECTORIES.USAGE_EVENTS);
    ensureDir(outputDir);
    
    const fileName = `events-${page}.json`;
    const filePath = path.join(outputDir, fileName);
    
    const outputData = {
      meta: {
        fetched_at: new Date().toISOString(),
        page: page,
        type: 'usage_events',
        filters: {
          startDate: options.startDate,
          endDate: options.endDate,
          email: options.email,
          userId: options.userId,
          model: options.model
        }
      },
      ...data
    };
    
    writeFileSync(filePath, JSON.stringify(outputData, null, 2), 'utf8');
    console.log(`✓ Saved usage events page ${page}: ${filePath}`);
    
    return filePath;
  }

  /**
   * Get team members data from file
   * @returns {Object|null} - Team members data or null if not found
   */
  getTeamMembers() {
    const filePath = path.join(this.config.dataDir, 'team-members.json');
    
    if (!existsSync(filePath)) {
      return null;
    }
    
    try {
      return readJSON(filePath);
    } catch (error) {
      console.warn('Failed to read team members data:', error.message);
      return null;
    }
  }

  /**
   * Get team statistics from team members data
   * @param {Object} teamData - Team members data
   * @returns {Object} - Team statistics
   */
  getTeamStats(teamData) {
    if (!teamData || !Array.isArray(teamData.teamMembers)) {
      return { totalMembers: 0, roles: {}, emailDomains: {} };
    }

    const members = teamData.teamMembers;
    const roles = {};
    const emailDomains = {};
    
    for (const member of members) {
      // Count roles
      const role = member.role || 'Unknown';
      roles[role] = (roles[role] || 0) + 1;
      
      // Count email domains
      if (member.email && member.email.includes('@')) {
        const domain = member.email.split('@')[1];
        emailDomains[domain] = (emailDomains[domain] || 0) + 1;
      }
    }
    
    return {
      totalMembers: members.length,
      roles,
      emailDomains,
      fetchedAt: teamData.meta?.fetched_at
    };
  }

  /**
   * Find team member by email or user ID
   * @param {string} identifier - Email or user ID to search for
   * @returns {Object|null} - Team member data or null if not found
   */
  findTeamMember(identifier) {
    const teamData = this.getTeamMembers();
    if (!teamData || !Array.isArray(teamData.teamMembers)) {
      return null;
    }
    
    return teamData.teamMembers.find(member => 
      member.email === identifier || 
      member.id === identifier ||
      member.userId === identifier
    ) || null;
  }

  /**
   * Validate team member data structure
   * @param {Object} data - Team member data to validate
   * @returns {Object} - Validation result
   */
  validateTeamData(data) {
    const issues = [];
    
    if (!data) {
      issues.push('No data provided');
      return { valid: false, issues };
    }
    
    if (!data.teamMembers) {
      issues.push('Missing teamMembers array');
    } else if (!Array.isArray(data.teamMembers)) {
      issues.push('teamMembers is not an array');
    } else {
      // Check individual members
      for (let i = 0; i < data.teamMembers.length; i++) {
        const member = data.teamMembers[i];
        const memberPrefix = `Member ${i + 1}:`;
        
        if (!member.id && !member.userId) {
          issues.push(`${memberPrefix} Missing id/userId`);
        }
        
        if (!member.email) {
          issues.push(`${memberPrefix} Missing email`);
        } else if (!member.email.includes('@')) {
          issues.push(`${memberPrefix} Invalid email format`);
        }
        
        if (!member.name) {
          issues.push(`${memberPrefix} Missing name`);
        }
      }
    }
    
    return {
      valid: issues.length === 0,
      issues
    };
  }
}
