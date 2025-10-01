import https from 'node:https';

/**
 * HTTP Client for Cursor Admin API
 * Handles authentication and HTTP requests to the Cursor API endpoints
 */
export class CursorClient {
  constructor(baseUrl, key) {
    // Validate baseUrl
    if (typeof baseUrl !== 'string' || baseUrl.trim() === '') {
      throw new Error('CursorClient: baseUrl must be a non-empty string');
    }
    try {
      // Throws if invalid
      new URL(baseUrl);
    } catch (e) {
      throw new Error('CursorClient: baseUrl must be a valid URL');
    }
    // Validate key
    if (typeof key !== 'string' || key.trim() === '') {
      throw new Error('CursorClient: key must be a non-empty string');
    }
    this.baseUrl = baseUrl.replace(/\/$/, '');
    this.key = key;
  }

  /**
   * Make an HTTP request to the Cursor API
   * @param {string} method - HTTP method (GET, POST, etc.)
   * @param {string} path - API endpoint path
   * @param {object} body - Request body for POST requests
   * @returns {Promise<{ok: boolean, status: number, json: object}>}
   */
  async request(method, path, body) {
    const url = this.baseUrl + path;
    const auth = Buffer.from(`${this.key}:`).toString('base64');
    const payload = body ? JSON.stringify(body) : undefined;
    
    const headers = {
      'Authorization': `Basic ${auth}`,
      'Content-Type': 'application/json'
    };

    return new Promise((resolve) => {
      const req = https.request(url, { method, headers }, (res) => {
        let data = '';
        
        res.on('data', (chunk) => {
          data += chunk;
        });
        
        res.on('end', () => {
          let json = {};
          try {
            json = JSON.parse(data || '{}');
          } catch (error) {
            // Ignore JSON parse errors, return empty object
          }
          
          resolve({
            ok: res.statusCode >= 200 && res.statusCode < 300,
            status: res.statusCode,
            json
          });
        });
      });

      req.on('error', () => {
        resolve({
          ok: false,
          status: 0,
          json: {}
        });
      });

      if (payload) {
        req.write(payload);
      }
      
      req.end();
    });
  }

  /**
   * Make a POST request
   * @param {string} path - API endpoint path
   * @param {object} body - Request body
   * @returns {Promise<{ok: boolean, status: number, json: object}>}
   */
  post(path, body) {
    return this.request('POST', path, body);
  }

  /**
   * Make a GET request
   * @param {string} path - API endpoint path
   * @returns {Promise<{ok: boolean, status: number, json: object}>}
   */
  get(path) {
    return this.request('GET', path);
  }
}

/**
 * Load Cursor API key from environment variables
 * @returns {string|undefined} API key if found
 */
export function loadKey() {
  return process.env.CURSOR_API_KEY || process.env.CURSOR_TOKEN;
}
