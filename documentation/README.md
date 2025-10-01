# AI Metrics Report Documentation

Comprehensive documentation for the AI Metrics Report tool - a professional-grade CLI for GitHub Copilot & Cursor usage analytics with clean service-based architecture.

## 📚 Documentation Index

### 🚀 Getting Started
- **[README.md](../README.md)** - Main project documentation with quick start guide
- **[One Shot Command Guide](one-shot-command.md)** - Comprehensive report generation (recommended starting point)

### 📖 User Guides  
- **[CLI Reference](CLI_REFERENCE.md)** - Complete command-line interface reference
- **[Configuration Guide](CONFIGURATION.md)** - Environment setup and configuration options

### 🔧 Developer Documentation
- **[Service Architecture](SERVICE_ARCHITECTURE.md)** - Service-based architecture design and patterns
- **[Dashboard Setup](DASHBOARD_SETUP.md)** - Live dashboard with automated data collection

## 🎯 Quick Navigation

### For Users
**First time?** Start with the [One Shot Command Guide](one-shot-command.md) to generate your first comprehensive report.

**Daily usage?** Check the [CLI Reference](CLI_REFERENCE.md) for all available commands and options.

**Need help?** The main [README](../README.md) has troubleshooting guides and common workflows.

### For Developers
**Understanding the code?** Read the [Service Architecture](SERVICE_ARCHITECTURE.md) documentation.

**Adding features?** Follow the established patterns documented in the architecture guide.

**Testing?** The service architecture enables comprehensive testing strategies.

## 🔄 Common Workflows

### ⚡ Quick Start
```bash
ai-metrics-report reports one-shot
```

### 📊 Regular Reporting
```bash
ai-metrics-report reports one-shot --skip-prompt
```

### 🔧 Troubleshooting
Ensure `.env` is configured and network access is available, then re-run:
```bash
ai-metrics-report reports one-shot --skip-prompt
```

## 📋 Documentation Standards

### Writing Guidelines
1. **Start with examples** - Show practical usage first
2. **Include troubleshooting** - Address common issues
3. **Use consistent formatting** - Follow established patterns  
4. **Add CLI examples** - Show actual commands users will run
5. **Cross-reference** - Link to related documentation

### Code Examples
- Use the unified CLI commands (`ai-metrics-report ...`)
- Show both CLI and programmatic usage where applicable
- Include expected outputs and results
- Provide troubleshooting commands

## 🏗️ Architecture Overview

The tool follows a **service-based architecture**:

```
src/
├── cli/                    # Unified Commander.js interface
├── cursor/services/        # Cursor business logic services  
├── github/services/        # GitHub business logic services
├── reporting/             # Cross-platform reporting services
└── common/                # Shared utilities and helpers
```

**Benefits:**
- ✅ **Clean separation** of CLI, business logic, and data
- ✅ **Testable** services isolated from user interface
- ✅ **Extensible** patterns for adding new functionality  
- ✅ **Maintainable** consistent structure across domains

## 📁 Project Structure

```
ai-metrics-report/
├── src/
│   ├── cli/                    # Unified CLI system
│   ├── cursor/services/        # Cursor data services
│   ├── github/services/        # GitHub data services  
│   ├── reporting/             # Cross-platform reporting
│   ├── common/                # Shared utilities
│   └── server/                # Web dashboard
├── scripts/                   # One-shot runner
├── documentation/             # This directory - comprehensive guides
├── data/                      # Generated data files (git-ignored)
├── output/                    # Reports and CSV exports
├── bin/                       # CLI entry point
└── package.json              # Dependencies and npm scripts
```

## 🚧 Development & Contributing

### Adding New Features
1. **Follow service patterns** - Use existing GitHub/Cursor services as templates
2. **Add CLI commands** - Create command definitions in `src/cli/commands/`
3. **Update documentation** - Add to relevant guides and CLI reference
4. **Include tests** - Services enable comprehensive testing strategies

### Documentation Standards
When adding new documentation:
1. **Start with practical examples** - Show users what they can do
2. **Include comprehensive troubleshooting** - Address common issues
3. **Cross-reference related docs** - Link to other relevant guides
4. **Follow established formatting** - Use consistent patterns and emoji
5. **Update this index** - Add new docs to the appropriate section

### Code Standards
- **Use the service layer** - Don't mix business logic with CLI concerns
- **Follow established patterns** - Each domain follows consistent structure
- **Handle errors gracefully** - Provide helpful error messages and recovery options
- **Document new APIs** - Update CLI reference for new commands

## 💡 Getting Help

### For Users
- Check the [main README](../README.md) for overview and setup
- Use `ai-metrics-report --help` for command-specific guidance
- Review [CLI Reference](CLI_REFERENCE.md) for complete command documentation

### For Developers  
- Read the [Service Architecture](SERVICE_ARCHITECTURE.md) guide
- Follow patterns established in existing services
- Ask questions or open issues for clarification

### Common Issues
- **"Missing API key"** → Check [setup instructions](../README.md#setup--configuration) 
- **"No data found"** → Run `ai-metrics-report status` to check data availability
- **"Permission denied"** → Use `ai-metrics-report github diagnose` to verify tokens
