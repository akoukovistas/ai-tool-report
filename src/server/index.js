import 'dotenv/config';
import express from 'express';
import path from 'node:path';
import { readFileSync, readdirSync, statSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import cron from 'node-cron';
import winston from 'winston';
import { marked } from 'marked';
import { ListPage } from './ui/List.js';
import { CsvPage } from './ui/CsvPage.js';
import { MenuPage } from './ui/Menu.js';
import { FetchPage } from './ui/FetchPage.js';
import { DashboardPage } from './ui/DashboardPage.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Configure logging
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.printf(({ timestamp, level, message }) => {
      return `${timestamp} [${level.toUpperCase()}]: ${message}`;
    })
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'logs/dashboard.log' })
  ]
});

// Ensure logs directory exists
if (!existsSync('logs')) {
  mkdirSync('logs', { recursive: true });
}

const app = express();
const PORT = process.env.PORT || 3000;
app.use(express.static(path.join(__dirname,'public')));
app.use(express.json());

function collectCSVFiles(dir, baseDir, out) {
  const entries = readdirSync(dir);
  for (const entry of entries) {
    const full = path.join(dir, entry);
    const relDir = path.relative(baseDir, dir) || '.';
    const st = statSync(full);
    if (st.isDirectory()) {
      collectCSVFiles(full, baseDir, out);
    } else if (entry.toLowerCase().endsWith('.csv')) {
      out.push({
        directory: relDir.replace(/\\/g,'/'),
        name: entry,
        relPath: path.relative(baseDir, full).replace(/\\/g,'/'),
        fullPath: full,
        ctime: st.ctimeMs,
        mtime: st.mtimeMs
      });
    }
  }
}

function loadCSVIndex(csvRoot) {
  const abs = path.resolve(csvRoot);
  const list = [];
  collectCSVFiles(abs, abs, list);
  return list;
}

function loadSingleCSV(csvRoot, relativePath) {
  const absRoot = path.resolve(csvRoot);
  const full = path.join(absRoot, relativePath);
  const text = readFileSync(full, 'utf8').replace(/^\uFEFF/, '');
  return text;
}

app.get('/api/csv-list', (req,res)=>{
  const root = req.query.root || 'output';
  try {
    const list = loadCSVIndex(root);
    const grouped = {};
    for (const f of list) {
      grouped[f.directory] = grouped[f.directory] || [];
      grouped[f.directory].push({ name: f.name, relPath: f.relPath });
    }
    res.json({ root, groups: grouped });
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/csv', (req,res)=>{
  const root = req.query.root || 'output';
  const rel = req.query.path;
  if (!rel) return res.status(400).json({ error: 'path param required'});
  try {
    const text = loadSingleCSV(root, rel);
    res.type('text/csv').send(text);
  } catch(e) {
    res.status(404).json({ error: e.message });
  }
});


app.get('/', (req,res)=>{
  res.redirect('/dashboard');
});

app.get('/dashboard', async (req,res)=>{
  try {
    const metrics = await collectCurrentMetrics();
    const html = DashboardPage({ 
      title: 'AI Metrics Dashboard', 
      metrics,
      schedulerStatus: scheduledJob
    });
    res.send(html);
  } catch (error) {
    res.status(500).send('Error loading dashboard: ' + error.message);
  }
});

app.get('/menu', (req,res)=>{
  const html = renderToStaticMarkup(React.createElement(MenuPage, { title: 'AI Metrics' }));
  res.send('<!DOCTYPE html>'+html);
});

app.get('/files', (req,res)=>{
  const root = 'output';
  try {
    const files = loadCSVIndex(root).map(f=>({ name: f.name, relPath: f.relPath, ctime: f.ctime }));
    const html = renderToStaticMarkup(React.createElement(ListPage, { title: 'CSV Files', files }));
    res.send('<!DOCTYPE html>'+html);
  } catch (e) {
    res.status(500).send('Error: '+e.message);
  }
});

app.get('/fetch', (req,res)=>{
  const org = (process.env.GH_ORG || '').trim();
  const hasOrg = org.length>0;
  const hasToken = !!(process.env.GH_TOKEN || process.env.GITHUB_TOKEN);
  const hasCursor = !!(process.env.CURSOR_API_KEY || process.env.CURSOR_TOKEN);
  const missing = [];
  if(!hasOrg) missing.push('GH_ORG');
  if(!hasToken) missing.push('GH_TOKEN');
  if(!hasCursor) missing.push('CURSOR_API_KEY');
  const html = renderToStaticMarkup(React.createElement(FetchPage, { title: 'Fetch Fresh Data', hasOrg, hasToken, hasCursor, missing, org }));
  res.send('<!DOCTYPE html>'+html);
});

// Scheduled data collection and metrics storage
let scheduledJob = { running: false, started: null, finished: null, logs: [], error: null, nextRun: null };

function logScheduled(msg) {
  const ts = new Date().toISOString();
  scheduledJob.logs.push({ ts, msg });
  if (scheduledJob.logs.length > 100) scheduledJob.logs.shift();
  logger.info(`[SCHEDULER] ${msg}`);
}

async function runScheduledDataCollection() {
  scheduledJob.running = true;
  scheduledJob.started = new Date().toISOString();
  scheduledJob.finished = null;
  scheduledJob.logs = [];
  scheduledJob.error = null;

  try {
    logScheduled('Starting scheduled data collection cycle...');
    
    // Import and run the one-shot report (skip prompts for automated runs)
    const { runOneShotReport } = await import('../../scripts/one-shot-report.js');
    await runOneShotReport(true);
    
    logScheduled('One-shot report completed successfully');
    
    // Store metrics snapshot for Grafana
    await storeMetricsSnapshot();
    
    logScheduled('Metrics snapshot stored successfully');
    logScheduled('Scheduled data collection cycle completed');
    
  } catch (error) {
    scheduledJob.error = error.message;
    logScheduled(`ERROR: ${error.message}`);
    logger.error('Scheduled job failed:', error);
  } finally {
    scheduledJob.running = false;
    scheduledJob.finished = new Date().toISOString();
    
    // Calculate next run time (6 hours from now)
    const nextRun = new Date();
    nextRun.setHours(nextRun.getHours() + 6);
    scheduledJob.nextRun = nextRun.toISOString();
  }
}

async function storeMetricsSnapshot() {
  try {
    // Read latest reports and data to create metrics snapshot
    const timestamp = new Date().toISOString();
    const metricsData = await collectCurrentMetrics();
    
    // Ensure metrics directory exists
    const metricsDir = 'data/metrics';
    if (!existsSync(metricsDir)) {
      mkdirSync(metricsDir, { recursive: true });
    }
    
    // Store snapshot
    const snapshotPath = path.join(metricsDir, `snapshot_${timestamp.replace(/[:.]/g, '-')}.json`);
    writeFileSync(snapshotPath, JSON.stringify(metricsData, null, 2));
    
    logScheduled(`Metrics snapshot saved: ${snapshotPath}`);
    
    // Also update latest.json for easy access
    const latestPath = path.join(metricsDir, 'latest.json');
    writeFileSync(latestPath, JSON.stringify(metricsData, null, 2));
    
  } catch (error) {
    logScheduled(`Failed to store metrics snapshot: ${error.message}`);
    throw error;
  }
}

async function collectCurrentMetrics() {
  const metrics = {
    timestamp: new Date().toISOString(),
    github: {
      totalSeats: 0,
      activeUsers: 0,
      inactiveUsers: 0
    },
    cursor: {
      totalUsers: 0,
      activeUsers: 0,
      inactiveUsers: 0
    },
    reports: {
      activeUsersReport: null,
      aiToolingReport: null,
      recentActivityReport: null
    }
  };

  try {
    // Try to read latest GitHub seat data from multiple possible locations
    const githubDataDir = 'data/github';
    let latestSeatFile = null;
    let latestModTime = 0;
    
    if (existsSync(githubDataDir)) {
      // Check root directory for seat files
      const rootFiles = readdirSync(githubDataDir)
        .filter(f => f.startsWith('copilot-seat-assignments_') && f.endsWith('.json'));
      
      for (const file of rootFiles) {
        const fullPath = path.join(githubDataDir, file);
        const stat = statSync(fullPath);
        if (stat.mtimeMs > latestModTime) {
          latestModTime = stat.mtimeMs;
          latestSeatFile = fullPath;
        }
      }
      
      // Check nested date directories for more recent files
      const walkDir = (dir) => {
        try {
          const entries = readdirSync(dir);
          for (const entry of entries) {
            const fullPath = path.join(dir, entry);
            const stat = statSync(fullPath);
            
            if (stat.isDirectory()) {
              walkDir(fullPath); // Recursively check subdirectories
            } else if (entry.startsWith('copilot-seats_') && entry.endsWith('.json')) {
              if (stat.mtimeMs > latestModTime) {
                latestModTime = stat.mtimeMs;
                latestSeatFile = fullPath;
              }
            }
          }
        } catch (e) {
          // Ignore directory access errors
        }
      };
      
      walkDir(githubDataDir);
      
      if (latestSeatFile) {
        const seatData = JSON.parse(readFileSync(latestSeatFile, 'utf8'));
        metrics.github.totalSeats = seatData.seats ? seatData.seats.length : 0;
        
        // Count active users (last 7 days)
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - 7);
        
        if (seatData.seats) {
          metrics.github.activeUsers = seatData.seats.filter(seat => {
            if (!seat.last_activity_at) return false;
            return new Date(seat.last_activity_at) >= cutoffDate;
          }).length;
          metrics.github.inactiveUsers = metrics.github.totalSeats - metrics.github.activeUsers;
        }
        
        logScheduled(`Using GitHub seat file: ${latestSeatFile}`);
      }
    }

    // Try to read latest Cursor data
    const cursorDataDir = 'data/cursor';
    if (existsSync(cursorDataDir)) {
      // Read team members
      const membersFile = path.join(cursorDataDir, 'team-members.json');
      if (existsSync(membersFile)) {
        const membersData = JSON.parse(readFileSync(membersFile, 'utf8'));
        // Handle both array format and object with teamMembers property
        const teamMembers = Array.isArray(membersData) ? membersData : (membersData.teamMembers || []);
        metrics.cursor.totalUsers = teamMembers.length || 0;
        logScheduled(`Found ${metrics.cursor.totalUsers} Cursor team members`);
      }
      
      // Read latest weekly report for activity
      const weeklyFiles = readdirSync(cursorDataDir).filter(f => f.startsWith('weekly-report_') && f.endsWith('.json'));
      if (weeklyFiles.length > 0) {
        const latestWeekly = weeklyFiles.sort().pop();
        const weeklyData = JSON.parse(readFileSync(path.join(cursorDataDir, latestWeekly), 'utf8'));
        
        logScheduled(`Using Cursor weekly file: ${latestWeekly}`);
        
        if (weeklyData.data && Array.isArray(weeklyData.data)) {
          const activeEmails = new Set();
          // Weekly report data is a flat array of user activity records
          weeklyData.data.forEach(record => {
            if (record.isActive && record.email) {
              activeEmails.add(record.email);
            }
          });
          metrics.cursor.activeUsers = activeEmails.size;
          metrics.cursor.inactiveUsers = Math.max(0, metrics.cursor.totalUsers - metrics.cursor.activeUsers);
          
          logScheduled(`Cursor active users: ${metrics.cursor.activeUsers}, inactive: ${metrics.cursor.inactiveUsers}`);
        }
      }
    }

    // Check for latest reports
    const reportsDir = 'output/reports';
    if (existsSync(reportsDir)) {
      const reportMapping = {
        'active-users.md': 'activeUsersReport',
        'ai-tooling-adoption-report.md': 'aiToolingReport', 
        'recent-activity-analysis.md': 'recentActivityReport'
      };
      
      Object.entries(reportMapping).forEach(([filename, key]) => {
        const filepath = path.join(reportsDir, filename);
        if (existsSync(filepath)) {
          const stats = statSync(filepath);
          metrics.reports[key] = {
            lastModified: stats.mtime.toISOString(),
            size: stats.size
          };
          logScheduled(`Found report: ${filename} (${stats.size} bytes)`);
        }
      });
    }

  } catch (error) {
    logScheduled(`Error collecting metrics: ${error.message}`);
  }

  return metrics;
}

// Set up cron job to run every 6 hours
// Format: minute hour day month dayOfWeek
// "0 */6 * * *" means at minute 0 of every 6th hour
cron.schedule('0 */6 * * *', () => {
  if (!scheduledJob.running) {
    logScheduled('Cron job triggered - starting scheduled data collection');
    runScheduledDataCollection();
  } else {
    logScheduled('Cron job triggered but previous job still running - skipping');
  }
}, {
  scheduled: true,
  timezone: "America/New_York" // Adjust timezone as needed
});

// Calculate initial next run time
const nextRun = new Date();
nextRun.setHours(nextRun.getHours() + 6);
scheduledJob.nextRun = nextRun.toISOString();

logger.info('Cron scheduler initialized - next run at: ' + scheduledJob.nextRun);

// Legacy aggregate fetch endpoints removed

// GitHub update job (fetch seats then convert to CSV)
let githubJob = { running:false, started:null, finished:null, logs:[], error:null };
function logGithub(msg){ const ts=new Date().toISOString(); githubJob.logs.push({ ts, msg }); if(githubJob.logs.length>400) githubJob.logs.shift(); console.log('[github-update]', msg); }

async function runGithubUpdate(org){
  githubJob.running=true; githubJob.started=new Date().toISOString(); githubJob.finished=null; githubJob.logs=[]; githubJob.error=null;
  try {
    if(!org) throw new Error('Missing org (set GH_ORG in .env)');
    logGithub('Starting GitHub data update for org '+org);
    // Staleness check (12h)
    const dataDir = 'data/github';
    const prefix = `copilot-seat-assignments_${org}_`;
    let latestPath=null; let latestM=0;
    try {
      const { readdirSync, statSync } = await import('node:fs');
      for (const f of readdirSync(dataDir)) {
        if (!f.startsWith(prefix) || !f.endsWith('.json')) continue;
        const full = path.join(dataDir,f);
        const mt = statSync(full).mtimeMs;
        if (mt>latestM){ latestM=mt; latestPath=full; }
      }
    } catch {/* ignore dir errors */}
    const now = Date.now();
    const twelveHoursMs = 12*60*60*1000;
    if (latestPath && (now - latestM) < twelveHoursMs) {
      const ageH = ((now-latestM)/3600000).toFixed(2);
      logGithub(`Existing data is fresh (age ${ageH}h < 12h); skipping GitHub API fetch.`);
    } else {
      const seatsMod = await import('../github/seats.js');
      const { count } = await seatsMod.fetchSeats({ org });
      logGithub(`Fetched ${count} Copilot seat assignments & wrote summary CSV (copilot-seat-assignments.csv)`);
    }
    logGithub('GitHub update complete');
  } catch(e){ githubJob.error=e.message; logGithub('ERROR: '+e.message); }
  finally { githubJob.running=false; githubJob.finished=new Date().toISOString(); }
}

app.post('/api/github-update-start', (req,res)=>{
  const org = process.env.GH_ORG;
  const tokenPresent = !!(process.env.GH_TOKEN || process.env.GITHUB_TOKEN);
  if(!org || !tokenPresent) return res.status(400).json({ started:false, error:'Missing GH_ORG or GH_TOKEN in environment' });
  if(githubJob.running) return res.status(409).json({ started:false, running:true });
  runGithubUpdate(org); // fire and forget
  res.json({ started:true, org });
});

app.get('/api/github-update-status', (req,res)=>{
  res.json(githubJob);
});

// GitHub Copilot metrics job (org level)
let metricsJob = { running:false, started:null, finished:null, logs:[], error:null };
function logMetrics(msg){ const ts=new Date().toISOString(); metricsJob.logs.push({ ts, msg }); if(metricsJob.logs.length>400) metricsJob.logs.shift(); console.log('[github-metrics]', msg); }

async function runGithubMetrics({ org, since, until, perPage, page, singlePage }){
  metricsJob.running=true; metricsJob.started=new Date().toISOString(); metricsJob.finished=null; metricsJob.logs=[]; metricsJob.error=null;
  try {
    const { fetchOrgMetrics } = await import('../github/metrics.js');
    logMetrics(`Fetching Copilot metrics for org=${org} since=${since||'(none)'} until=${until||'(none)'} perPage=${perPage||100}`);
    const { jsonPath, count, pages } = await fetchOrgMetrics({ org, since, until, perPage, page, singlePage });
    logMetrics(`Fetched ${count} day(s) across ${pages} page(s); wrote ${jsonPath}`);
  } catch(e) {
    metricsJob.error = e.message;
    logMetrics('ERROR: '+e.message);
  } finally {
    metricsJob.running=false; metricsJob.finished=new Date().toISOString();
  }
}

app.post('/api/github-metrics-start', (req,res)=>{
  const org = (req.query.org || process.env.GH_ORG || '').trim();
  const tokenPresent = !!(process.env.GH_TOKEN || process.env.GITHUB_TOKEN);
  if(!org || !tokenPresent) return res.status(400).json({ started:false, error:'Missing org or GH_TOKEN in environment' });
  if(metricsJob.running) return res.status(409).json({ started:false, running:true });
  const since = req.query.since || (req.body && req.body.since);
  const until = req.query.until || (req.body && req.body.until);
  const perPage = req.query.per_page ? Number(req.query.per_page) : undefined;
  const page = req.query.page ? Number(req.query.page) : undefined;
  const singlePage = req.query.single === '1' || req.query.single === 'true';
  runGithubMetrics({ org, since, until, perPage, page, singlePage });
  res.json({ started:true, org, since: since||null, until: until||null });
});
app.get('/api/github-metrics-status', (req,res)=> res.json(metricsJob));

// Cursor jobs (daily activity & 30-day rolling activity)
let cursorDailyJob = { running:false, started:null, finished:null, logs:[], error:null };
let cursorMonthlyJob = { running:false, started:null, finished:null, logs:[], error:null };
function logCursorDaily(msg){ const ts=new Date().toISOString(); cursorDailyJob.logs.push({ ts, msg }); if(cursorDailyJob.logs.length>300) cursorDailyJob.logs.shift(); console.log('[cursor-daily]', msg); }
function logCursorMonthly(msg){ const ts=new Date().toISOString(); cursorMonthlyJob.logs.push({ ts, msg }); if(cursorMonthlyJob.logs.length>300) cursorMonthlyJob.logs.shift(); console.log('[cursor-monthly]', msg); }

async function runCursorDaily(){
  cursorDailyJob.running=true; cursorDailyJob.started=new Date().toISOString(); cursorDailyJob.finished=null; cursorDailyJob.logs=[]; cursorDailyJob.error=null;
  try {
    logCursorDaily('Starting Cursor daily activity fetch (today)');
  const fetchMod = await import('../cursor/fetch.js');
  await fetchMod.fetchDailyActivity({});
  logCursorDaily('Daily activity fetch complete');
  logCursorDaily('Generating Cursor CSVs...');
  const agg = await import('../cursor/aggregate.js');
  await agg.toCSVs();
  logCursorDaily('CSV generation complete');
  } catch(e){ cursorDailyJob.error=e.message; logCursorDaily('ERROR: '+e.message); }
  finally { cursorDailyJob.running=false; cursorDailyJob.finished=new Date().toISOString(); }
}

async function runCursorMonthly(){
  cursorMonthlyJob.running=true; cursorMonthlyJob.started=new Date().toISOString(); cursorMonthlyJob.finished=null; cursorMonthlyJob.logs=[]; cursorMonthlyJob.error=null;
  try {
    logCursorMonthly('Starting Cursor 30-day rolling activity fetch');
  const fetchMod = await import('../cursor/fetch.js');
  await fetchMod.fetchMonthlyActivity({ windowDays:30 });
  logCursorMonthly('30-day activity fetch complete');
  logCursorMonthly('Generating Cursor CSVs...');
  const agg = await import('../cursor/aggregate.js');
  await agg.toCSVs();
  logCursorMonthly('CSV generation complete');
  } catch(e){ cursorMonthlyJob.error=e.message; logCursorMonthly('ERROR: '+e.message); }
  finally { cursorMonthlyJob.running=false; cursorMonthlyJob.finished=new Date().toISOString(); }
}

app.post('/api/cursor-daily-start', (req,res)=>{
  const tokenPresent = !!(process.env.CURSOR_API_KEY || process.env.CURSOR_TOKEN);
  if(!tokenPresent) return res.status(400).json({ started:false, error:'Missing CURSOR_API_KEY in environment' });
  if(cursorDailyJob.running) return res.status(409).json({ started:false, running:true });
  const force = req.query.force === '1';
  cursorDailyJob.force = force;
  if(!force){
    // staleness: check latest daily file <12h old
    try {
      const { statSync, readdirSync, existsSync } = require('node:fs');
      const dir='data/cursor/daily-activity';
      if(existsSync(dir)){
        const files=readdirSync(dir).filter(f=>f.startsWith('activity_')&&f.endsWith('.json')).sort();
        if(files.length){
          const full=path.join(dir, files.at(-1));
          const mt=statSync(full).mtimeMs; const age=Date.now()-mt; const twelve=12*3600000;
            if(age < twelve){
              logCursorDaily(`Skipped: existing daily data age ${(age/3600000).toFixed(2)}h < 12h (use force=1 to override)`);
              cursorDailyJob.running=false; cursorDailyJob.started=new Date().toISOString(); cursorDailyJob.finished=new Date().toISOString();
              return res.json({ started:false, skipped:true, fresh:true });
            }
        }
      }
    } catch(e){ logCursorDaily('Staleness check error (daily): '+e.message); }
  }
  runCursorDaily();
  res.json({ started:true, force });
});
app.get('/api/cursor-daily-status', (req,res)=> res.json(cursorDailyJob));

app.post('/api/cursor-monthly-start', (req,res)=>{
  const tokenPresent = !!(process.env.CURSOR_API_KEY || process.env.CURSOR_TOKEN);
  if(!tokenPresent) return res.status(400).json({ started:false, error:'Missing CURSOR_API_KEY in environment' });
  if(cursorMonthlyJob.running) return res.status(409).json({ started:false, running:true });
  const force = req.query.force === '1';
  cursorMonthlyJob.force = force;
  if(!force){
    // staleness: latest monthly activity manifest <12h
    try {
      const { statSync, readdirSync, existsSync } = require('node:fs');
      const dir='data/cursor/monthly-activity';
      if(existsSync(dir)){
        const files=readdirSync(dir).filter(f=> (f.startsWith('monthly-activity_')||f.startsWith('monthly-report_')) && f.endsWith('.json')).sort();
        if(files.length){
          const full=path.join(dir, files.at(-1));
          const mt=statSync(full).mtimeMs; const age=Date.now()-mt; const twelve=12*3600000;
          if(age < twelve){
            logCursorMonthly(`Skipped: existing monthly window data age ${(age/3600000).toFixed(2)}h < 12h (use force=1 to override)`);
            cursorMonthlyJob.running=false; cursorMonthlyJob.started=new Date().toISOString(); cursorMonthlyJob.finished=new Date().toISOString();
            return res.json({ started:false, skipped:true, fresh:true });
          }
        }
      }
    } catch(e){ logCursorMonthly('Staleness check error (monthly): '+e.message); }
  }
  runCursorMonthly();
  res.json({ started:true, force });
});
app.get('/api/cursor-monthly-status', (req,res)=> res.json(cursorMonthlyJob));

// Scheduler endpoints
app.get('/api/scheduler/status', (req, res) => {
  res.json(scheduledJob);
});

app.post('/api/scheduler/trigger', async (req, res) => {
  if (scheduledJob.running) {
    return res.status(409).json({ started: false, error: 'Scheduler job already running' });
  }
  
  // Trigger manual run
  runScheduledDataCollection();
  res.json({ started: true, message: 'Manual data collection started' });
});

// Grafana-compatible metrics endpoints
app.get('/api/metrics', async (req, res) => {
  try {
    const metrics = await collectCurrentMetrics();
    res.json(metrics);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});


app.get('/api/metrics/history', (req, res) => {
  try {
    const metricsDir = 'data/metrics';
    if (!existsSync(metricsDir)) {
      return res.json([]);
    }
    
    const files = readdirSync(metricsDir)
      .filter(f => f.startsWith('snapshot_') && f.endsWith('.json'))
      .sort()
      .slice(-50); // Last 50 snapshots
    
    const history = files.map(filename => {
      const filepath = path.join(metricsDir, filename);
      const data = JSON.parse(readFileSync(filepath, 'utf8'));
      return data;
    });
    
    res.json(history);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});


// Task runner removed

app.get('/view', (req,res)=>{
  const root = 'output';
  const rel = req.query.path;
  if (!rel) return res.status(400).send('Missing path');
  try {
    // Security: ensure requested path is part of index
    const index = loadCSVIndex(root);
    const match = index.find(f=>f.relPath === rel);
    if (!match) return res.status(404).send('File not found');
    const text = loadSingleCSV(root, rel);
    const html = renderToStaticMarkup(React.createElement(CsvPage, { title: match.name, relPath: rel, csvText: text }));
    res.send('<!DOCTYPE html>'+html);
  } catch(e) {
    res.status(500).send('Error: '+e.message);
  }
});

app.get('/report/:filename', (req, res) => {
  const filename = req.params.filename;
  const reportPath = path.join('output', 'reports', filename);
  
  try {
    if (!existsSync(reportPath)) {
      return res.status(404).send('Report not found');
    }
    
    const markdownContent = readFileSync(reportPath, 'utf8');
    const htmlContent = marked(markdownContent);
    
    // Create a styled HTML page
    const styledHtml = `
<!DOCTYPE html>
<html>
<head>
  <title>${filename.replace('.md', '').replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}</title>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      max-width: 1200px;
      margin: 0 auto;
      padding: 20px;
      line-height: 1.6;
      color: #333;
      background: #f9f9f9;
    }
    .container {
      background: white;
      padding: 40px;
      border-radius: 8px;
      box-shadow: 0 2px 10px rgba(0,0,0,0.1);
    }
    h1, h2, h3, h4, h5, h6 {
      color: #2c3e50;
      margin-top: 30px;
      margin-bottom: 15px;
    }
    h1 { border-bottom: 3px solid #3498db; padding-bottom: 10px; }
    h2 { border-bottom: 2px solid #ecf0f1; padding-bottom: 8px; }
    code {
      background: #f8f9fa;
      padding: 2px 6px;
      border-radius: 3px;
      font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
    }
    pre {
      background: #f8f9fa;
      padding: 15px;
      border-radius: 5px;
      overflow-x: auto;
      border-left: 4px solid #3498db;
    }
    table {
      border-collapse: collapse;
      width: 100%;
      margin: 20px 0;
    }
    th, td {
      border: 1px solid #ddd;
      padding: 12px;
      text-align: left;
    }
    th {
      background-color: #f2f2f2;
      font-weight: bold;
    }
    tr:nth-child(even) {
      background-color: #f9f9f9;
    }
    ul, ol {
      margin: 15px 0;
      padding-left: 30px;
    }
    li {
      margin: 5px 0;
    }
    .back-link {
      display: inline-block;
      margin-bottom: 20px;
      padding: 10px 20px;
      background: #3498db;
      color: white;
      text-decoration: none;
      border-radius: 5px;
      font-size: 14px;
    }
    .back-link:hover {
      background: #2980b9;
    }
    .report-meta {
      background: #ecf0f1;
      padding: 15px;
      border-radius: 5px;
      margin-bottom: 30px;
      font-size: 14px;
      color: #7f8c8d;
    }
  </style>
</head>
<body>
  <div class="container">
    <a href="/dashboard" class="back-link">← Back to Dashboard</a>
    <div class="report-meta">
      Report: ${filename} | Generated: ${new Date().toLocaleString()}
    </div>
    ${htmlContent}
  </div>
</body>
</html>`;
    
    res.send(styledHtml);
  } catch (error) {
    res.status(500).send('Error rendering report: ' + error.message);
  }
});

app.get('/download', (req,res)=>{
  const root = 'output';
  const rel = req.query.path;
  if (!rel) return res.status(400).send('Missing path');
  try {
    const index = loadCSVIndex(root);
    const match = index.find(f=>f.relPath === rel);
    if (!match) return res.status(404).send('File not found');
    const text = loadSingleCSV(root, rel);
    res.setHeader('Content-Type','text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${match.name}"`);
    res.send(text);
  } catch(e) {
    res.status(500).send('Error: '+e.message);
  }
});

app.listen(PORT, ()=>{
  console.log(`Server listening on http://localhost:${PORT}`);
});
