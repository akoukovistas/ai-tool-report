import { Command } from 'commander';
import { ReportingService } from '../../reporting/ReportingService.js';
import { runOneShotReport } from '../../../scripts/one-shot-report.js';

/**
 * Create reporting and analysis CLI commands
 * @param {Command} program - Commander program instance
 */
export function createReportCommands(program) {
  const reports = new Command('reports')
    .description('Generate various AI metrics reports');

  // Active users report
  reports
    .command('active-users')
    .description('Generate comprehensive active users report')
    .option('--skip-prompt', 'Skip overwrite prompts', false)
    .option('--data-dir <dir>', 'Data directory', 'data')
    .option('--output-dir <dir>', 'Report output directory', 'output/reports')
    .option('--user-lookup <file>', 'User lookup table path', 'data/user-lookup-table.csv')
    .option('--org-data <file>', 'Organizational data path', 'data/org/direct-reports.json')
    .action(async (options) => {
      try {
        const service = new ReportingService(options);
        const result = await service.generateActiveUsersReport(options);
        
        if (result.cancelled) {
          console.log('📋 Report generation was cancelled by user');
          return;
        }
        
        console.log(`✅ Active users report generated successfully`);
        console.log(`📄 Report saved to: ${result.outputPath}`);
        console.log(`👥 Total users analyzed: ${result.stats.usersInLookup}`);
        console.log(`🟢 Weekly active users: ${result.stats.weeklyActiveInEither} (${result.stats.weeklyActivePercentage}%)`);
        
      } catch (error) {
        console.error('❌ Failed to generate active users report:', error.message);
        process.exit(1);
      }
    });

  // AI tooling adoption report
  reports
    .command('ai-tooling')
    .description('Generate AI tooling adoption analysis report')
    .option('--skip-prompt', 'Skip overwrite prompts', false)
    .option('--data-dir <dir>', 'Data directory', 'data')
    .option('--output-dir <dir>', 'Report output directory', 'output/reports')
    .action(async (options) => {
      try {
        const service = new ReportingService(options);
        const result = await service.generateAIToolingAdoptionReport(options);
        
        if (result.cancelled) {
          console.log('📋 Report generation was cancelled by user');
          return;
        }
        
        console.log(`✅ AI tooling adoption report generated successfully`);
        console.log(`📄 Report saved to: ${result.outputPath}`);
        console.log(`📊 Adoption analysis completed for ${result.stats.totalPeople} people`);
        
      } catch (error) {
        console.error('❌ Failed to generate AI tooling adoption report:', error.message);
        process.exit(1);
      }
    });

  // Recent activity analysis
  reports
    .command('recent-activity')
    .description('Generate recent activity analysis report')
    .option('--days <number>', 'Number of days to analyze', '7')
    .option('--skip-prompt', 'Skip overwrite prompts', false)
    .option('--output-dir <dir>', 'Report output directory', 'output/reports')
    .action(async (options) => {
      try {
        const service = new ReportingService(options);
        const result = await service.generateRecentActivityReport({
          ...options,
          days: parseInt(options.days)
        });
        
        if (result.cancelled) {
          console.log('📋 Report generation was cancelled by user');
          return;
        }
        
        console.log(`✅ Recent activity analysis report generated successfully`);
        console.log(`📄 Report saved to: ${result.outputPath}`);
        console.log(`📊 Analyzed activity for the past ${options.days} days`);
        
      } catch (error) {
        console.error('❌ Failed to generate recent activity report:', error.message);
        process.exit(1);
      }
    });

  // (github-activity removed in public minimal release)

  // One-shot comprehensive report
  reports
    .command('one-shot')
    .description('Generate comprehensive report with fresh data fetch')
    .option('--skip-prompt', 'Skip all prompts for automated runs', false)
    .action(async (options) => {
      try {
        console.log('🚀 Starting comprehensive one-shot report generation...');
        await runOneShotReport(options.skipPrompt);
        
      } catch (error) {
        console.error('❌ One-shot report generation failed:', error.message);
        process.exit(1);
      }
    });

  // All reports command
  reports
    .command('all')
    .description('Generate all available reports from existing data')
    .option('--skip-prompt', 'Skip all prompts', false)
    .option('--data-dir <dir>', 'Data directory', 'data')
    .option('--output-dir <dir>', 'Report output directory', 'output/reports')
    .action(async (options) => {
      try {
        console.log('📊 Generating all available reports...');
        
        const service = new ReportingService(options);
        const results = [];
        
        // Generate active users report
        console.log('\n👥 Generating active users report...');
        try {
          const result = await service.generateActiveUsersReport(options);
          if (!result.cancelled) {
            results.push({ type: 'active-users', path: result.outputPath });
            console.log('✅ Active users report completed');
          }
        } catch (error) {
          console.log(`⚠️  Skipped active users report: ${error.message}`);
        }
        
        // Generate AI tooling adoption report
        console.log('\n🔧 Generating AI tooling adoption report...');
        try {
          const result = await service.generateAIToolingAdoptionReport(options);
          if (!result.cancelled) {
            results.push({ type: 'ai-tooling', path: result.outputPath });
            console.log('✅ AI tooling adoption report completed');
          }
        } catch (error) {
          console.log(`⚠️  Skipped AI tooling report: ${error.message}`);
        }
        
        // Generate recent activity report
        console.log('\n📈 Generating recent activity report...');
        try {
          const result = await service.generateRecentActivityReport(options);
          if (!result.cancelled) {
            results.push({ type: 'recent-activity', path: result.outputPath });
            console.log('✅ Recent activity report completed');
          }
        } catch (error) {
          console.log(`⚠️  Skipped recent activity report: ${error.message}`);
        }
        
        // Summary
        console.log('\n🎉 Report generation completed!');
        console.log(`📊 Generated ${results.length} reports:`);
        results.forEach(result => {
          console.log(`   • ${result.type}: ${result.path}`);
        });
        
      } catch (error) {
        console.error('❌ Failed to generate reports:', error.message);
        process.exit(1);
      }
    });

  program.addCommand(reports);
}
