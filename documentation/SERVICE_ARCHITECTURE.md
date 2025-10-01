# AI Metrics Report - Service Architecture

This document explains the service-based architecture that powers the AI Metrics Report tool, providing guidance for developers and contributors.

## Architecture Overview

The AI Metrics Report tool follows a **clean service-based architecture** that separates concerns, promotes reusability, and enables maintainable code.

```
src/
├── cli/                      # Command-line interface layer
│   ├── index.js             # Main CLI entry point
│   └── commands/            # Command definitions by domain
│       └── reports.js       # Reporting & analysis
├── cursor/services/         # Cursor domain services
├── github/services/         # GitHub domain services
├── reporting/               # Cross-platform reporting services
├── common/                  # Shared utilities and helpers
└── server/                  # Web dashboard (existing)
```

## Design Principles

### 1. **Separation of Concerns**
- **CLI Layer**: Command parsing, validation, and user interaction
- **Service Layer**: Business logic, API interactions, and data processing
- **Common Layer**: Shared utilities and helper functions

### 2. **Domain-Driven Design**
Services are organized by domain (GitHub, Cursor, Reporting) with clear boundaries and responsibilities.

### 3. **Consistent Patterns**
All services follow the same structural patterns for predictability and maintainability.

### 4. **Testability**
Business logic is isolated from CLI concerns, making it easy to unit test services independently.

### 5. **Extensibility**
New services can be added following established patterns without modifying existing code.

## Service Layers

### CLI Layer (`src/cli/`)

The CLI layer handles user interaction and delegates to appropriate services.

#### **Main CLI (`src/cli/index.js`)**
- Entry point using Commander.js
- Global option handling (`--verbose`, `--dry-run`)
- Command group registration
- Error handling and help system

#### **Command Modules (`src/cli/commands/*.js`)**
Each command module:
- Defines related commands for a domain
- Handles argument parsing and validation
- Creates service instances with appropriate configuration
- Formats and displays results to the user
- Provides consistent error handling

**Example Command Structure:**
```javascript
// src/cli/commands/github.js
export function createGitHubCommands(program) {
  const github = new Command('github')
    .description('GitHub Copilot operations');

  github
    .command('seats')
    .description('Fetch GitHub Copilot seat assignments')
    .option('--org <org>', 'Organization name')
    .action(async (options) => {
      const service = new GitHubSeatsService(options);
      const result = await service.fetchSeats(options);
      console.log(`✅ Fetched ${result.count} seats`);
    });

  program.addCommand(github);
}
```

### Service Layer

Services contain the core business logic and API interactions. Each service extends a base service class for consistent behavior.

#### **GitHub Services (`src/github/services/`)**

**GitHubBaseService**
- Common GitHub API configuration
- Shared authentication and error handling
- Rate limiting and retry logic
- Configuration validation

**GitHubSeatsService**
```javascript
export class GitHubSeatsService extends GitHubBaseService {
  async fetchSeats(options = {}) {
    this.validateConfig();
    
    // Fetch from API
    const { seats, meta } = await this.client.fetchOrgSeats(org, options);
    
    // Enrich with names if requested
    if (options.enrichNames) {
      await this.enrichSeatsWithNames(seats, options);
    }
    
    // Save data
    const jsonPath = await this.saveSeatsJSON(seats, meta);
    const csvPath = await this.saveSeatsCSV(seats);
    
    return { jsonPath, csvPath, count: seats.length, seats };
  }
}
```

**GitHubMetricsService**
- Fetches usage metrics for date ranges
- Handles pagination and rate limiting
- Saves structured data with metadata

**GitHubUserService**
- Manages user lookup tables
- Builds login-to-name mappings
- Handles name cache for performance

**GitHubAnalysisService**
- Performs activity analysis
- Generates insights and reports
- Supports multiple output formats

**GitHubDiagnosticService**
- Tests API connectivity and permissions
- Validates token scopes
- Provides troubleshooting information

#### **Cursor Services (`src/cursor/services/`)**

**CursorBaseService**
```javascript
export class CursorBaseService {
  constructor(options = {}) {
    this.config = this.parseConfig(options);
    this.client = this.createClient();
  }
  
  validateConfig(required = ['apiKey']) {
    // Validation logic
  }
  
  async safeRequest(requestFn, options = {}) {
    // Retry logic and error handling
  }
}
```

**CursorActivityService**
- Fetches weekly activity data used by the one-shot workflow
- Provides activity statistics and analysis
- Handles date range calculations and normalization

**CursorTeamService**
- Manages team member data
- Fetches spend information with pagination
- Handles usage events with filtering

**CursorReportingService**
- Generates CSV reports from collected data
- Performs data aggregation and summaries
- Creates window-based and monthly summaries

#### **Reporting Services (`src/reporting/`)**

**ReportingService**
- Cross-platform report generation
- Combines data from multiple sources
- Generates comprehensive analysis reports
- Supports multiple output formats (Markdown, JSON)

```javascript
export class ReportingService {
  async generateActiveUsersReport(options = {}) {
    // Load organizational data
    const orgData = this.loadOrganizationalData();
    const users = this.loadUserLookupData();
    
    // Analyze across platforms
    const copilotAnalysis = await this.analyzeCopilotActivity(users);
    const cursorAnalysis = await this.analyzeCursorActivity(users);
    
    // Generate comprehensive report
    const reportContent = this.generateReportMarkdown(/* ... */);
    
    // Save and return results
    return { success: true, outputPath, stats };
  }
}
```

### Common Layer (`src/common/`)

Shared utilities and helper functions used across services.

**File System Utilities (`fs.js`)**
- Directory creation and management
- JSON/CSV reading and writing
- File discovery and pattern matching

**Organization Utilities (`org.js`)**
- Name normalization and matching
- Organizational structure parsing
- User filtering and categorization

**Prompting Utilities (`prompt.js`)**
- User confirmation prompts
- Overwrite protection
- Interactive CLI elements

## Data Flow

### Typical Data Flow Pattern

1. **CLI Command** receives user input and options
2. **Command Handler** parses options and creates service instance
3. **Service** validates configuration and authenticates with APIs
4. **Service** fetches data from external APIs (GitHub, Cursor)
5. **Service** processes and validates data
6. **Service** saves data to structured files
7. **Service** returns results to command handler
8. **Command Handler** formats and displays results to user

### Data Storage Strategy

**Raw Data Storage**
```
data/
├── github/
│   ├── YYYY/MM/DD/              # Date-structured storage
│   │   ├── copilot-seats_*.json
│   │   └── copilot-metrics_*.json
│   └── users/
│       └── user-lookup.csv      # Curated user mappings
├── cursor/
│   ├── YYYY/MM/DD/              # Daily activity
│   ├── YYYY/MM/                 # Monthly summaries
│   ├── team-members.json
│   ├── spend/page-*.json
│   └── usage-events/events-*.json
└── org/
    └── direct-reports.json      # Organizational structure
```

**Processed Outputs**
```
output/
├── csv/                         # Structured CSV exports
│   ├── github/
│   └── cursor/
└── reports/                     # Human-readable reports
    ├── active-users.md
    ├── ai-tooling-adoption.md
    └── recent-activity-analysis.md
```

## Configuration Management

### Environment-Based Configuration
Services use environment variables with sensible defaults:

```javascript
const config = {
  // API Configuration
  apiKey: options.apiKey || process.env.CURSOR_API_KEY,
  baseUrl: options.baseUrl || process.env.CURSOR_BASE_URL || 'https://api.cursor.com',
  
  // Data directories
  dataDir: options.dataDir || 'data/cursor',
  outputDir: options.outputDir || 'output/csv/cursor',
  
  // Request options
  delayMs: options.delayMs || 0,
  maxRetries: options.maxRetries || 3,
  
  // Override any additional options
  ...options
};
```

### Option Inheritance
Options flow from CLI → Command Handler → Service, allowing override at each level.

## Error Handling Strategy

### Layered Error Handling
1. **Service Level**: Domain-specific error handling and recovery
2. **Command Level**: User-friendly error formatting
3. **CLI Level**: Global error catching and exit codes

### Error Types
- **Configuration Errors**: Missing API keys, invalid options
- **Network Errors**: API failures, rate limiting, timeouts
- **Data Errors**: Invalid responses, parsing failures
- **File System Errors**: Permission issues, disk space

### Example Error Handling
```javascript
// Service Level
async fetchSeats(options) {
  try {
    return await this.safeRequest(() => this.client.fetchOrgSeats(org));
  } catch (error) {
    throw new Error(`Failed to fetch seats: ${error.message}`);
  }
}

// Command Level  
.action(async (options) => {
  try {
    const result = await service.fetchSeats(options);
    console.log(`✅ Success: ${result.count} seats fetched`);
  } catch (error) {
    console.error('❌ Failed to fetch seats:', error.message);
    
    // Provide helpful context
    if (error.message.includes('403')) {
      console.log('💡 Check that GH_TOKEN has manage_billing:copilot scope');
    }
    
    process.exit(1);
  }
});
```

## Testing Strategy

The service architecture enables comprehensive testing at multiple levels.

### Unit Testing Services
Services can be tested in isolation with mocked dependencies:

```javascript
// Example service test
import { GitHubSeatsService } from '../src/github/services/GitHubSeatsService.js';

describe('GitHubSeatsService', () => {
  test('fetchSeats returns expected data structure', async () => {
    const service = new GitHubSeatsService({ 
      org: 'test-org',
      token: 'mock-token' 
    });
    
    // Mock the HTTP client
    service.client.fetchOrgSeats = jest.fn().mockResolvedValue({
      seats: mockSeatData,
      meta: mockMetadata
    });
    
    const result = await service.fetchSeats();
    
    expect(result.count).toBe(mockSeatData.length);
    expect(result.seats).toEqual(mockSeatData);
  });
});
```

### Integration Testing
Test complete workflows using real or mock APIs:

```javascript
describe('End-to-End Workflows', () => {
  test('one-shot report generates all expected files', async () => {
    // Setup test environment
    // Run one-shot command
    // Verify output files exist and have expected structure
  });
});
```

## Adding New Services

### 1. Create Base Service (if needed)
```javascript
// src/newdomain/services/NewDomainBaseService.js
export class NewDomainBaseService {
  constructor(options = {}) {
    this.config = this.parseConfig(options);
  }
  
  parseConfig(options) {
    return {
      apiKey: options.apiKey || process.env.NEW_DOMAIN_API_KEY,
      // ... other config
    };
  }
  
  validateConfig(required = ['apiKey']) {
    // Validation logic
  }
}
```

### 2. Create Specific Service
```javascript
// src/newdomain/services/NewDomainDataService.js
import { NewDomainBaseService } from './NewDomainBaseService.js';

export class NewDomainDataService extends NewDomainBaseService {
  async fetchData(options = {}) {
    this.validateConfig();
    
    // API interaction
    const data = await this.client.getData(options);
    
    // Data processing
    const processedData = this.processData(data);
    
    // Save results
    const filePath = await this.saveData(processedData);
    
    return { filePath, count: data.length, data: processedData };
  }
  
  private async processData(rawData) {
    // Business logic
  }
  
  private async saveData(data) {
    // File system operations
  }
}
```

### 3. Add CLI Commands
```javascript
// src/cli/commands/newdomain.js
export function createNewDomainCommands(program) {
  const newdomain = new Command('newdomain')
    .description('New domain operations');

  newdomain
    .command('fetch-data')
    .description('Fetch data from new domain')
    .option('--option <value>', 'Description')
    .action(async (options) => {
      const service = new NewDomainDataService(options);
      const result = await service.fetchData(options);
      console.log(`✅ Fetched ${result.count} records`);
    });

  program.addCommand(newdomain);
}
```

### 4. Register Commands
```javascript
// src/cli/index.js
import { createNewDomainCommands } from './commands/newdomain.js';

// Add to main CLI
createNewDomainCommands(program);
```

## Benefits of This Architecture

### 1. **Maintainability**
- Clear separation of concerns
- Consistent patterns across domains
- Easy to locate and modify functionality

### 2. **Testability**
- Services can be tested in isolation
- Business logic separated from CLI concerns
- Easy to mock dependencies

### 3. **Reusability**
- Services can be used programmatically
- CLI and web dashboard can share services
- Components can be composed for complex workflows

### 4. **Extensibility**
- New services follow established patterns
- Easy to add new data sources or operations
- Minimal impact on existing functionality

### 5. **Debuggability**
- Clear error handling at appropriate levels
- Structured logging and verbose modes
- Easy to trace issues through layers

## Performance Considerations

### API Rate Limiting
- Built-in retry logic with exponential backoff
- Configurable delays between requests
- Respect API rate limits and headers

### Data Caching
- Name lookups cached to avoid repeated API calls
- Incremental updates preserve manual edits
- File-based caching with cache invalidation

### Memory Management
- Stream processing for large datasets
- Pagination for API responses
- Cleanup of temporary resources

## Security Considerations

### API Key Management
- Environment variable configuration
- No API keys in source code or logs
- Masked display in status outputs

### Data Privacy
- Only fetch necessary data
- No sensitive data in logs
- Secure file permissions for cached data

### Input Validation
- Validate all user inputs and options
- Sanitize file paths and names
- Prevent injection attacks

## Migration Guide

For existing code using the old architecture:

The dashboard scheduler triggers the one-shot workflow every 6 hours to fetch data and generate reports automatically.
