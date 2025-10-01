import https from 'node:https';

/**
 * GitHub API client with unified error handling and rate limiting
 */
export class GitHubClient {
  constructor(token, apiBase = 'https://api.github.com') {
    this.token = token;
    this.apiBase = apiBase.replace(/\/$/, '');
    this.userAgent = 'ai-metrics-report-node';
    this.apiVersion = '2022-11-28';
  }

  /**
   * Make HTTP request to GitHub API
   * @param {string} url - Full URL to request
   * @param {object} options - Request options
   * @returns {Promise<object>} - Response object
   */
  async request(url, options = {}) {
    const headers = {
      'User-Agent': this.userAgent,
      'Accept': 'application/vnd.github+json',
      'X-GitHub-Api-Version': this.apiVersion,
      ...options.headers
    };

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    return new Promise((resolve) => {
      https.get(url, { headers }, (res) => {
        let body = '';
        res.on('data', chunk => body += chunk);
        res.on('end', () => {
          let json = {};
          try {
            json = JSON.parse(body || '{}');
          } catch {
            // Ignore parse errors
          }

          const headersLower = Object.fromEntries(
            Object.entries(res.headers).map(([k, v]) => [k.toLowerCase(), v])
          );

          resolve({
            ok: res.statusCode >= 200 && res.statusCode < 300,
            status: res.statusCode,
            json,
            headers: headersLower,
            bodyText: body
          });
        });
      }).on('error', () => {
        resolve({
          ok: false,
          status: 0,
          json: {},
          headers: {},
          bodyText: ''
        });
      });
    });
  }

  /**
   * Handle paginated requests
   * @param {string} baseUrl - Base URL for the API endpoint
   * @param {object} params - Query parameters
   * @param {object} options - Request options
   * @returns {Promise<Array>} - All items from all pages
   */
  async fetchAllPages(baseUrl, params = {}, options = {}) {
    const { perPage = 100, delayMs = 0, singlePage = false, startPage = 1 } = options;
    const allItems = [];
    let currentPage = startPage;

    while (true) {
      const queryParams = new URLSearchParams({
        ...params,
        per_page: String(perPage),
        page: String(currentPage)
      });

      const url = `${baseUrl}?${queryParams.toString()}`;
      const response = await this.request(url);

      if (!response.ok) {
        throw this.createAPIError(response);
      }

      const items = Array.isArray(response.json) ? response.json : 
                   Array.isArray(response.json.seats) ? response.json.seats : [];
      
      allItems.push(...items);

      // Check for next page
      const linkHeader = response.headers.link || response.headers.Link;
      const hasNext = linkHeader && /<[^>]*[?&]page=\d+[^>]*>; rel="next"/i.test(linkHeader);

      if (singlePage || !hasNext || items.length === 0) {
        break;
      }

      currentPage++;
      if (delayMs > 0) {
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
    }

    return { items: allItems, pages: currentPage };
  }

  /**
   * Fetch user information
   * @param {string} username - GitHub username
   * @returns {Promise<object>} - User data
   */
  async fetchUser(username) {
    const url = `${this.apiBase}/users/${encodeURIComponent(username)}`;
    const response = await this.request(url);
    
    if (!response.ok) {
      if (response.status === 404) {
        return { name: '', status: 'not_found' };
      }
      return { name: '', status: `http_${response.status}` };
    }

    return {
      name: response.json.name || '',
      status: response.json.name ? 'ok' : 'no_name',
      ...response.json
    };
  }

  /**
   * Fetch organization Copilot metrics
   * @param {string} org - Organization name
   * @param {object} params - Query parameters
   * @returns {Promise<Array>} - Metrics data
   */
  async fetchOrgMetrics(org, params = {}, options = {}) {
    const url = `${this.apiBase}/orgs/${encodeURIComponent(org)}/copilot/metrics`;
    const result = await this.fetchAllPages(url, params, options);
    return result.items;
  }

  /**
   * Fetch team Copilot metrics
   * @param {string} org - Organization name
   * @param {string} teamSlug - Team slug
   * @param {object} params - Query parameters
   * @returns {Promise<Array>} - Team metrics data
   */
  async fetchTeamMetrics(org, teamSlug, params = {}, options = {}) {
    const url = `${this.apiBase}/orgs/${encodeURIComponent(org)}/team/${encodeURIComponent(teamSlug)}/copilot/metrics`;
    try {
      const result = await this.fetchAllPages(url, params, options);
      return result.items;
    } catch (error) {
      // Team metrics might not be available (< 5 users, no data, etc.)
      if (error.status === 404 || error.status === 403) {
        return null;
      }
      throw error;
    }
  }

  /**
   * Fetch organization Copilot seats
   * @param {string} org - Organization name
   * @param {object} options - Request options
   * @returns {Promise<object>} - Seats data with metadata
   */
  async fetchOrgSeats(org, options = {}) {
    const url = `${this.apiBase}/orgs/${encodeURIComponent(org)}/copilot/billing/seats`;
    let firstResponse = null;
    const { items: seats, pages } = await this.fetchAllPages(url, {}, {
      ...options,
      // Intercept first response to get metadata
      onFirstResponse: (response) => { firstResponse = response; }
    });

    // Get first page to extract metadata
    if (!firstResponse) {
      const response = await this.request(`${url}?per_page=1`);
      if (response.ok) firstResponse = response;
    }

    const meta = firstResponse?.json ? {
      total_seats: firstResponse.json.total_seats,
      total_seats_used: firstResponse.json.total_seats_used,
      public_code_suggestions_seats: firstResponse.json.public_code_suggestions_seats,
      public_code_suggestions_seats_used: firstResponse.json.public_code_suggestions_seats_used,
      inactive_user_seats: firstResponse.json.inactive_user_seats,
      inactive_user_seats_used: firstResponse.json.inactive_user_seats_used,
      total_pending_cancellation_seats: firstResponse.json.total_pending_cancellation_seats
    } : {};

    return { seats, meta, pages };
  }

  /**
   * Create a standardized API error
   * @param {object} response - Response object
   * @returns {Error} - Standardized error
   */
  createAPIError(response) {
    let message = `GitHub API error status=${response.status}`;
    
    // Try to extract specific error message from response body
    let specificError = '';
    try {
      const errorBody = JSON.parse(response.bodyText || '{}');
      if (errorBody.message) {
        specificError = errorBody.message;
      }
    } catch {
      // Ignore JSON parse errors
    }
    
    switch (response.status) {
      case 401:
        message = 'Unauthorized – invalid or missing token';
        break;
      case 403:
        message = 'Forbidden – missing required scopes or policy disabled';
        break;
      case 404:
        message = 'Not found – org not found or token lacks access';
        break;
      case 422:
        message = specificError || 'Unprocessable – API access policy disabled for org/enterprise';
        break;
    }

    const error = new Error(message);
    error.status = response.status;
    error.body = response.bodyText;
    return error;
  }

  /**
   * Check API authentication status
   * @returns {Promise<object>} - Auth status
   */
  async checkAuth() {
    const response = await this.request(`${this.apiBase}/user`);
    const scopes = (response.headers['x-oauth-scopes'] || '').toString();
    const tokenType = response.headers['github-authentication-token-type'] || '(unknown)';
    
    return {
      authenticated: response.ok,
      status: response.status,
      user: response.json,
      scopes,
      tokenType
    };
  }
}

/**
 * Create GitHub client with automatic token detection
 * @param {object} options - Client options
 * @returns {GitHubClient} - Configured client
 */
export const createGitHubClient = (options = {}) => {
  const token = options.token || process.env.GH_TOKEN || process.env.GITHUB_TOKEN;
  const apiBase = options.apiBase || process.env.GH_API_BASE || 'https://api.github.com';
  
  return new GitHubClient(token, apiBase);
};
