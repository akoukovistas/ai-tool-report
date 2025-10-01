#!/usr/bin/env node

/**
 * One Shot AI Metrics Report Generator
 * 
 * Performs complete data fetch and report generation using services:
 * 1. Fetches GitHub Copilot activity metrics and seat assignments
 * 2. Fetches Cursor activity data
 * 3. Generates comprehensive reports using ReportingService
 * 
 * Usage:
 *   node scripts/one-shot-report.js
 */

import 'dotenv/config';
import { GitHubSeatsService } from '../src/github/services/GitHubSeatsService.js';
import { GitHubMetricsService } from '../src/github/services/GitHubMetricsService.js';
import { CursorActivityService } from '../src/cursor/services/CursorActivityService.js';
import { ReportingService } from '../src/reporting/ReportingService.js';
import { checkAndPromptMultipleOverwrite } from '../src/common/prompt.js';
import path from 'path';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';

/**
 * Execute a step with error handling and logging
 */
async function executeStep(stepName, stepFunction, required = true) {
  console.log(`\n🔄 ${stepName}...`);
  try {
    const result = await stepFunction();
    console.log(`✅ ${stepName} completed successfully!`);
    return result;
  } catch (error) {
    console.error(`❌ ${stepName} failed:`, error.message);
    if (required) {
      throw error;
    }
    console.log(`⚠️  Continuing despite ${stepName} failure...`);
    return null;
  }
}

/**
 * Main function to run all data fetching and report generation
 * @param {boolean} skipPrompt - Skip user prompts for automated runs
 */
async function runOneShotReport(skipPrompt = false) {
  console.log('🚀 Starting One Shot AI Metrics Report Generation');
  console.log('=' .repeat(60));
  
  const startTime = Date.now();
  const org = getOrgSlug();
  
  try {
    // Initialize services
    const githubSeatsService = new GitHubSeatsService({ org });
    const githubMetricsService = new GitHubMetricsService({ org });
    const cursorActivityService = new CursorActivityService();
    const reportingService = new ReportingService();

    // Step 1: Fetch GitHub Copilot metrics for last 7 days
    await executeStep(
      'Fetching GitHub Copilot metrics (last 7 days)',
      async () => {
        const dateRange = cursorActivityService.getDateRange({ days: 7 });
        return await githubMetricsService.fetchOrgMetrics({
          since: dateRange.startDate,
          until: dateRange.endDate,
          perPage: 100
        });
      },
      false
    );

    // Step 2: Fetch GitHub Copilot seat assignments
    await executeStep(
      'Fetching GitHub Copilot seat assignments',
      async () => {
        return await githubSeatsService.fetchSeats({
          enrichNames: true,
          perPage: 100
        });
      },
      false
    );

    // Step 3: Fetch Cursor activity for last 7 days
    await executeStep(
      'Fetching Cursor activity (last 7 days)',
      async () => {
        return await cursorActivityService.fetchWeeklyActivity();
      },
      false
    );

    console.log('\n🔄 Data fetching completed. Starting report generation...');
    console.log('=' .repeat(60));

    // Ensure required local data files exist for reporting
    ensureReportingPrerequisites(org);

    // Check for existing reports and prompt for overwrite (unless skipping prompts)
    let shouldProceedWithReports = true;
    
    if (!skipPrompt) {
      const reportFiles = [
        {
          path: path.join(process.cwd(), 'output', 'reports', 'active-users.md'),
          type: 'Active Users Report'
        },
        {
          path: path.join(process.cwd(), 'output', 'reports', 'ai-tooling-adoption-report.md'),
          type: 'AI Tooling Adoption Report'
        },
        {
          path: path.join(process.cwd(), 'output', 'reports', 'recent-activity-analysis.md'),
          type: 'Recent Activity Analysis Report'
        }
      ];

      shouldProceedWithReports = await checkAndPromptMultipleOverwrite(reportFiles);
      if (!shouldProceedWithReports) {
        console.log('❌ Report generation cancelled by user.');
        return;
      }
    } else {
      console.log('🔄 Automated run - skipping overwrite prompts, proceeding with report generation...');
    }

    // Step 4: Generate active users report
    await executeStep(
      'Generating Active Users Report',
      async () => {
        return await reportingService.generateActiveUsersReport({ skipPrompt: true });
      }
    );

    // Step 5: Generate AI tooling adoption report
    await executeStep(
      'Generating AI Tooling Adoption Report',
      async () => {
        return await reportingService.generateAIToolingAdoptionReport({ skipPrompt: true });
      }
    );

    // Step 6: Generate recent activity analysis
    await executeStep(
      'Generating Recent Activity Analysis',
      async () => {
        return await reportingService.generateRecentActivityReport({ skipPrompt: true });
      },
      false // This is optional as it depends on specific data files
    );

    // Summary
    const endTime = Date.now();
    const duration = ((endTime - startTime) / 1000).toFixed(1);
    
    console.log('\n🎉 One Shot Report Generation Completed Successfully!');
    console.log('=' .repeat(60));
    console.log(`⏱️  Total execution time: ${duration} seconds`);
    console.log('\n📊 Generated Reports:');
    console.log('   • output/reports/active-users.md');
    console.log('   • output/reports/ai-tooling-adoption-report.md');
    console.log('   • output/reports/recent-activity-analysis.md');
    
    console.log('\n📁 Fetched Data:');
    console.log('   • GitHub Copilot metrics and seat assignments');
    console.log('   • Cursor weekly activity data');
    
    console.log('\n💡 Next Steps:');
    console.log('   • Review the generated reports in output/reports/');
    console.log('   • Share findings with stakeholders');
    console.log('   • Schedule regular runs using this script');
    
  } catch (error) {
    console.error('\n💥 One Shot Report Generation Failed!');
    console.error('❌ Error:', error.message);
    
    // Provide helpful error messages for common issues
    if (error.message.includes('Missing CURSOR_API_KEY')) {
      console.log('\n💡 Cursor API Key Issue:');
      console.log('   Set your Cursor API key in .env file:');
      console.log('   CURSOR_API_KEY=your_api_key_here');
      console.log('   Get your API key from: https://cursor.com/dashboard → Settings → API Keys');
    }
    
    if (error.message.includes('Missing required configuration')) {
      console.log('\n💡 GitHub Configuration Issue:');
      console.log('   Set your GitHub configuration in .env file:');
      console.log('   GH_TOKEN=your_github_token_here');
      console.log('   GH_ORG=your_organization_name');
      console.log('   Token needs: manage_billing:copilot, read:org permissions');
    }
    
    if (error.message.includes('not found')) {
      console.log('\n💡 Data File Issue:');
      console.log('   Ensure these files exist:');
      console.log('   • data/user-lookup-table.csv');
      console.log('   • data/org/direct-reports.json');
    }
    
    console.log('\n🔧 For troubleshooting:');
    console.log('   • Check .env file has all required variables');
    console.log('   • Verify network connectivity');
    console.log('   • Run individual scripts to isolate issues');
    
    process.exit(1);
  }
}

// Run the one shot report if called directly
if (import.meta.url.startsWith('file://') && process.argv[1] && import.meta.url.includes(process.argv[1].replace(/\\/g, '/'))) {
  runOneShotReport(true); // Always skip prompts when run directly
}

export { runOneShotReport };

function ensureReportingPrerequisites(orgSlug) {
  try {
    // Ensure data/<org> directory and direct-reports.json only if nothing else exists
    const orgDir = path.join(process.cwd(), 'data', orgSlug);
    const orgFile = path.join(orgDir, 'direct-reports.json');
    const anyOrgJsonExists = findAnyDirectReportsJson(orgSlug);
    if (!anyOrgJsonExists) {
      if (!existsSync(orgDir)) {
        mkdirSync(orgDir, { recursive: true });
      }
      if (!existsSync(orgFile)) {
        const stub = {
          organization: [
            {
              name: "Engineering",
              username: "engineering",
              title: "Org Root",
              directReports: []
            }
          ]
        };
        writeFileSync(orgFile, JSON.stringify(stub, null, 2), 'utf8');
        console.log(`🧩 Created default org structure at ${orgFile}`);
      }
    }
  } catch {
    // Best-effort; reporting will surface specific errors if needed
  }
}

function findAnyDirectReportsJson(orgSlug){
  try {
    const primary = path.join(process.cwd(), 'data', orgSlug);
    const fallbackRoot = path.join(process.cwd(), 'data');
    const stack = [primary, fallbackRoot];
    while (stack.length){
      const dir = stack.pop();
      if (!dir) continue;
      try {
        const entries = require('node:fs').readdirSync(dir, { withFileTypes: true });
        for (const e of entries){
          const full = path.join(dir, e.name);
          if (e.isDirectory()) stack.push(full);
          else if (e.isFile() && e.name === 'direct-reports.json') return true;
        }
      } catch {}
    }
  } catch {}
  return false;
}
function getOrgSlug(){
  const raw = (process.env.ORG || process.env.org || process.env.GH_ORG || process.env.GITHUB_ORG || 'your-org');
  return String(raw).trim();
}
