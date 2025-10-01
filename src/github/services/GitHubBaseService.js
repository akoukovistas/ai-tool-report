import { parseConfig, validateConfig } from '../utils/common.js';
import { createGitHubClient } from '../utils/github-client.js';

export class GitHubBaseService {
  constructor(options = {}) {
    this.config = { ...parseConfig(), ...options };
    this.client = createGitHubClient({
      token: this.config.token,
      apiBase: this.config.apiBase
    });
  }

  validateConfig(required = ['org', 'token']) {
    validateConfig(this.config, required);
  }
}
