#!/usr/bin/env node

/**
 * AI Metrics Report Tool - Main CLI Entry Point
 * 
 * This is a wrapper that delegates to the new unified CLI system
 * while maintaining backward compatibility with the old interface
 */

import 'dotenv/config';

// Import the new unified CLI
import '../src/cli/index.js';
