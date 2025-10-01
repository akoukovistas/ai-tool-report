/**
 * Cursor Services
 * Provides a clean service layer for Cursor Admin API operations
 */

// Main service classes
export { CursorBaseService } from './CursorBaseService.js';
export { CursorActivityService } from './CursorActivityService.js';
export { CursorTeamService } from './CursorTeamService.js';
export { CursorReportingService } from './CursorReportingService.js';

// Import all services for re-export and factory functions
import { CursorActivityService } from './CursorActivityService.js';
import { CursorTeamService } from './CursorTeamService.js';
import { CursorReportingService } from './CursorReportingService.js';

/**
 * Create a pre-configured activity service instance
 * @param {Object} options - Configuration options
 * @returns {CursorActivityService} - Configured activity service
 */
export function createActivityService(options = {}) {
  return new CursorActivityService(options);
}

/**
 * Create a pre-configured team service instance
 * @param {Object} options - Configuration options
 * @returns {CursorTeamService} - Configured team service
 */
export function createTeamService(options = {}) {
  return new CursorTeamService(options);
}

/**
 * Create a pre-configured reporting service instance
 * @param {Object} options - Configuration options
 * @returns {CursorReportingService} - Configured reporting service
 */
export function createReportingService(options = {}) {
  return new CursorReportingService(options);
}

/**
 * Create a complete set of Cursor services
 * @param {Object} options - Configuration options
 * @returns {Object} - Object containing all service instances
 */
export function createCursorServices(options = {}) {
  return {
    activity: new CursorActivityService(options),
    team: new CursorTeamService(options),
    reporting: new CursorReportingService(options)
  };
}
