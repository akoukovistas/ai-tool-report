import { createGitHubClient } from '../utils/github-client.js';
import { parseConfig } from '../utils/common.js';

/**
 * Service for diagnosing GitHub API access and permissions
 */
export class GitHubDiagnosticService {
  constructor(options = {}) {
    this.config = { ...parseConfig(), ...options };
    this.client = createGitHubClient({ 
      token: this.config.token, 
      apiBase: this.config.apiBase 
    });
  }

  /**
   * Run comprehensive diagnostic of GitHub API access
   * @param {Object} options - Diagnostic options
   * @returns {Promise<Object>} - Diagnostic results
   */
  async diagnoseSeats(options = {}) {
    const config = { ...this.config, ...options };
    const { org } = config;

    console.log('--- GitHub Copilot Seats Diagnostic ---');
    
    const results = {
      timestamp: new Date().toISOString(),
      token: this.analyzeTokenStatus(),
      user: null,
      org: org || null,
      seats: null,
      permissions: [],
      recommendations: []
    };

    try {
      // Check user authentication
      results.user = await this.checkUserAuth();
      
      // Check organization access if org provided
      if (org) {
        results.seats = await this.checkSeatsAccess(org);
        results.permissions = this.analyzePermissions(results.user, results.seats);
        results.recommendations = this.generateRecommendations(results);
      } else {
        console.log('Provide --org=<org> to also test the seats endpoint.');
        results.recommendations.push({
          priority: 'low',
          issue: 'No organization specified',
          solution: 'Specify an organization to test Copilot seats access'
        });
      }

      console.log('--- End Diagnostic ---');
      return results;
      
    } catch (error) {
      console.error('❌ Diagnostic failed:', error.message);
      results.error = error.message;
      return results;
    }
  }

  /**
   * Analyze token status
   * @private
   */
  analyzeTokenStatus() {
    const hasToken = !!this.config.token;
    console.log(`Token present: ${hasToken ? 'Yes' : 'No'}`);
    
    if (!hasToken) {
      console.log('[warn] No token set (GH_TOKEN / GITHUB_TOKEN).');
    }

    return {
      present: hasToken,
      source: this.config.token === process.env.GH_TOKEN ? 'GH_TOKEN' : 
              this.config.token === process.env.GITHUB_TOKEN ? 'GITHUB_TOKEN' : 'options'
    };
  }

  /**
   * Check user authentication status
   * @private
   */
  async checkUserAuth() {
    const authStatus = await this.client.checkAuth();
    
    console.log('User endpoint status:', authStatus.status);
    console.log('Token type:', authStatus.tokenType);
    console.log('Token scopes:', authStatus.scopes || '(none)');
    
    if (authStatus.user?.login) {
      console.log('Authenticated as:', authStatus.user.login);
    }

    return {
      authenticated: authStatus.authenticated,
      status: authStatus.status,
      user: authStatus.user,
      scopes: authStatus.scopes,
      tokenType: authStatus.tokenType
    };
  }

  /**
   * Check Copilot seats access
   * @private
   */
  async checkSeatsAccess(org) {
    try {
      const url = `${this.client.apiBase}/orgs/${encodeURIComponent(org)}/copilot/billing/seats?per_page=1`;
      const response = await this.client.request(url);
      
      console.log('Seats endpoint status:', response.status);
      
      const bodyPreview = response.bodyText.slice(0, 400).replace(/\s+/g, ' ').trim();
      console.log('Seats body (first 400 chars):', bodyPreview);
      
      const rateLimit = response.headers['x-ratelimit-limit'];
      const rateRemain = response.headers['x-ratelimit-remaining'];
      if (rateLimit) {
        console.log(`Rate limit: ${rateRemain}/${rateLimit}`);
      }

      // Provide specific guidance based on status
      if (response.status === 404) {
        console.log('NOTE: 404 here often means insufficient permission (needs manage_billing:copilot) or wrong org name.');
      } else if (response.status === 403) {
        console.log('NOTE: 403 indicates forbidden – missing scope/role (org owner or billing manager required).');
      }

      return {
        accessible: response.ok,
        status: response.status,
        rateLimit: rateLimit ? { limit: rateLimit, remaining: rateRemain } : null,
        bodyPreview,
        seatsCount: response.json?.total_seats || null
      };
      
    } catch (error) {
      console.warn('Failed to check seats access:', error.message);
      return {
        accessible: false,
        error: error.message
      };
    }
  }

  /**
   * Analyze permissions based on diagnostic results
   * @private
   */
  analyzePermissions(userResult, seatsResult) {
    const permissions = [];

    if (!userResult.authenticated) {
      permissions.push({
        permission: 'basic_auth',
        status: 'missing',
        description: 'Basic GitHub authentication failed'
      });
      return permissions;
    }

    permissions.push({
      permission: 'basic_auth',
      status: 'granted',
      description: 'Basic GitHub authentication successful'
    });

    // Check for required scopes
    const scopes = userResult.scopes ? userResult.scopes.split(',').map(s => s.trim()) : [];
    const hasManageBilling = scopes.includes('manage_billing:copilot');
    const hasReadOrg = scopes.includes('read:org');
    
    permissions.push({
      permission: 'manage_billing:copilot',
      status: hasManageBilling ? 'granted' : 'missing',
      description: 'Required for accessing Copilot seat assignments'
    });

    permissions.push({
      permission: 'read:org',
      status: hasReadOrg ? 'granted' : 'missing',
      description: 'Required for organization access'
    });

    if (seatsResult) {
      permissions.push({
        permission: 'copilot_seats_access',
        status: seatsResult.accessible ? 'granted' : 'denied',
        description: 'Ability to access Copilot seats endpoint'
      });
    }

    return permissions;
  }

  /**
   * Generate recommendations based on diagnostic results
   * @private
   */
  generateRecommendations(results) {
    const recommendations = [];

    if (!results.token.present) {
      recommendations.push({
        priority: 'high',
        issue: 'No GitHub token configured',
        solution: 'Set GH_TOKEN or GITHUB_TOKEN environment variable with a valid GitHub token'
      });
      return recommendations;
    }

    if (!results.user?.authenticated) {
      recommendations.push({
        priority: 'high',
        issue: 'Authentication failed',
        solution: 'Verify your GitHub token is valid and not expired'
      });
      return recommendations;
    }

    const missingScopes = results.permissions
      .filter(p => p.status === 'missing' && p.permission.includes(':'))
      .map(p => p.permission);

    if (missingScopes.length > 0) {
      recommendations.push({
        priority: 'high',
        issue: `Missing required scopes: ${missingScopes.join(', ')}`,
        solution: 'Create a new token with the required scopes or request additional permissions'
      });
    }

    if (results.seats && !results.seats.accessible) {
      if (results.seats.status === 403) {
        recommendations.push({
          priority: 'high',
          issue: 'Access forbidden to Copilot seats',
          solution: 'Ensure you are an organization owner or billing manager with Copilot access'
        });
      } else if (results.seats.status === 404) {
        recommendations.push({
          priority: 'medium',
          issue: 'Copilot seats endpoint not found',
          solution: 'Verify the organization name is correct and Copilot is enabled for the org'
        });
      }
    }

    if (results.seats?.rateLimit && results.seats.rateLimit.remaining < 100) {
      recommendations.push({
        priority: 'medium',
        issue: `Low rate limit remaining: ${results.seats.rateLimit.remaining}`,
        solution: 'Consider waiting before making more API calls or using a different token'
      });
    }

    return recommendations;
  }

  /**
   * Print diagnostic summary
   * @param {Object} results - Diagnostic results
   */
  printSummary(results) {
    console.log('\n=== DIAGNOSTIC SUMMARY ===');
    console.log(`Timestamp: ${results.timestamp}`);
    console.log(`Token Status: ${results.token.present ? '✓ Present' : '❌ Missing'}`);
    console.log(`Authentication: ${results.user?.authenticated ? '✓ Success' : '❌ Failed'}`);
    
    if (results.org) {
      console.log(`Organization: ${results.org}`);
      console.log(`Seats Access: ${results.seats?.accessible ? '✓ Accessible' : '❌ Denied'}`);
    }

    if (results.recommendations.length > 0) {
      console.log('\n--- RECOMMENDATIONS ---');
      for (const rec of results.recommendations) {
        const priority = rec.priority || 'unknown';
        console.log(`[${priority.toUpperCase()}] ${rec.issue}`);
        console.log(`  Solution: ${rec.solution}`);
      }
    }
  }
}

