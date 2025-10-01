import path from 'node:path';
import { ensureDir, writeJSON } from '../common/fs.js';
import { CursorClient, loadKey } from './client.js';
import { chunkRange, iso } from './util.js';

function createCursorClient(baseUrl = 'https://api.cursor.com') {
  const key = loadKey();
  if (!key) throw new Error('Missing CURSOR_API_KEY');
  return new CursorClient(baseUrl, key);
}

export async function fetchDailyActivity({ date, baseUrl } = {}) {
  const client = createCursorClient(baseUrl);
  const d = date ? new Date(date) : new Date();
  const start = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const end = start;
  const body = { startDate: start.getTime(), endDate: end.getTime() };
  const res = await client.post('/teams/daily-usage-data', body);
  if (!res.ok) throw new Error(`daily activity failed ${res.status}`);
  const year = start.getFullYear();
  const month = String(start.getMonth() + 1).padStart(2, '0');
  const day = String(start.getDate()).padStart(2, '0');
  const dir = path.join('data/cursor', String(year), month, day);
  ensureDir(dir);
  const file = path.join(dir, `daily_activity_${iso(start)}.json`);
  writeJSON(file, res.json);
  console.log('Saved daily activity', file);
}

export async function fetchMonthlyActivity({ start, end, baseUrl, windowDays = 30 } = {}) {
  const client = createCursorClient(baseUrl);
  const today = new Date();
  const endD = end ? new Date(end) : today;
  const startD = start ? new Date(start) : new Date(endD.getTime() - (windowDays - 1) * 86400000);
  const chunks = chunkRange(startD, endD, 90);
  const year = endD.getFullYear();
  const month = String(endD.getMonth() + 1).padStart(2, '0');
  const outDir = path.join('data/cursor', String(year), month);
  ensureDir(outDir);
  const written = [];
  for (const [s, e] of chunks) {
    const body = { startDate: s.getTime(), endDate: e.getTime() };
    const res = await client.post('/teams/daily-usage-data', body);
    if (!res.ok) throw new Error(`monthly activity failed ${res.status}`);
    const file = path.join(outDir, `monthly_activity_${iso(s)}_${iso(e)}.json`);
    writeJSON(file, res.json);
    written.push(file);
    console.log('Saved', file);
  }
  writeJSON(path.join(outDir, 'monthly_manifest.json'), {
    range: { start: iso(startD), end: iso(endD) },
    chunks: written
  });
}

export async function fetchMembers({ baseUrl } = {}) {
  const client = createCursorClient(baseUrl);
  const res = await client.get('/teams/members');
  if (!res.ok) throw new Error(`members failed ${res.status}`);
  writeJSON('data/cursor/team-members.json', res.json);
  console.log('Saved members');
}

export async function fetchSpend({ baseUrl, maxPages = 20, pageSize = 100 } = {}) {
  const client = createCursorClient(baseUrl);
  const dir = 'data/cursor/spend';
  ensureDir(dir);
  for (let page = 1; page <= maxPages; page++) {
    const res = await client.post('/teams/spend', { page, pageSize });
    if (!res.ok) break;
    writeJSON(path.join(dir, `page-${page}.json`), res.json);
    console.log('Spend page', page);
    if (!res.json.teamMemberSpend || res.json.teamMemberSpend.length < pageSize) break;
  }
}

export async function fetchWeeklyActivity({ baseUrl } = {}) {
  const client = createCursorClient(baseUrl || process.env.CURSOR_API_BASE_URL);
  const today = new Date();
  const endDate = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const startDate = new Date(endDate.getTime() - 6 * 86400000);
  const body = { startDate: startDate.getTime(), endDate: endDate.getTime() };
  const res = await client.post('/teams/daily-usage-data', body);
  if (!res.ok) throw new Error(`weekly activity failed ${res.status}`);
  const dir = 'data/cursor';
  ensureDir(dir);
  const filename = `weekly-report_${iso(startDate)}_${iso(endDate)}.json`;
  const filepath = path.join(dir, filename);
  writeJSON(filepath, res.json);
  console.log('Saved weekly activity report:', filepath);
  return res.json;
}

export async function fetchUsageEvents({
  baseUrl,
  startDate,
  endDate,
  email,
  userId,
  model,
  page = 1,
  pageSize = 100,
  maxPages = 10
} = {}) {
  const client = createCursorClient(baseUrl);
  const dir = 'data/cursor/usage-events';
  ensureDir(dir);
  const body = { page, pageSize };
  if (startDate) body.startDate = new Date(startDate).getTime();
  if (endDate) body.endDate = new Date(endDate).getTime();
  if (email) body.email = email;
  if (userId) body.userId = typeof userId === 'string' ? parseInt(userId, 10) : userId;
  if (model) body.model = model;
  const res = await client.post('/teams/filtered-usage-events', body);
  if (!res.ok) {
    throw new Error(`Usage events failed ${res.status}: ${res.json?.message || 'Unknown error'}`);
  }
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `usage-events_${timestamp}_page-${page}.json`;
  const filepath = path.join(dir, filename);
  writeJSON(filepath, res.json);
  console.log(`Saved usage events: ${filename}`);
  return res.json;
}

export async function fetchAllUsageEvents({
  baseUrl,
  startDate,
  endDate,
  email,
  userId,
  model,
  pageSize = 100,
  maxPages = 50
} = {}) {
  const client = createCursorClient(baseUrl);
  const dir = 'data/cursor/usage-events';
  ensureDir(dir);
  let allEvents = [];
  let totalCount = 0;
  let currentPage = 1;
  console.log('Fetching usage events...');
  if (startDate || endDate) console.log(`Date range: ${startDate || 'beginning'} to ${endDate || 'now'}`);
  if (email) console.log(`Filtering by email: ${email}`);
  if (userId) console.log(`Filtering by userId: ${userId}`);
  if (model) console.log(`Filtering by model: ${model}`);
  while (currentPage <= maxPages) {
    const body = { page: currentPage, pageSize: typeof pageSize === 'string' ? parseInt(pageSize, 10) : pageSize };
    if (startDate) body.startDate = new Date(startDate).getTime();
    if (endDate) body.endDate = new Date(endDate).getTime();
    if (email) body.email = email;
    if (userId) body.userId = typeof userId === 'string' ? parseInt(userId, 10) : userId;
    if (model) body.model = model;
    const res = await client.post('/teams/filtered-usage-events', body);
    if (!res.ok) {
      console.error(`Failed to fetch page ${currentPage}: ${res.status}`);
      break;
    }
    const data = res.json;
    totalCount = data.totalUsageEventsCount || 0;
    const events = data.usageEvents || [];
    if (events.length === 0) {
      console.log('No more events to fetch');
      break;
    }
    allEvents.push(...events);
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `usage-events_${timestamp}_page-${currentPage}.json`;
    writeJSON(path.join(dir, filename), data);
    console.log(`Page ${currentPage}: ${events.length} events`);
    const pagination = data.pagination;
    if (!pagination || !pagination.hasNextPage || currentPage >= pagination.numPages) {
      console.log('Reached last page');
      break;
    }
    currentPage++;
  }
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const consolidatedFile = path.join(dir, `all-usage-events_${timestamp}.json`);
  const consolidatedData = {
    totalEvents: allEvents.length,
    totalCount,
    fetchedPages: currentPage,
    filters: { startDate, endDate, email, userId, model },
    events: allEvents
  };
  writeJSON(consolidatedFile, consolidatedData);
  console.log(`\nFetch complete:`);
  console.log(`- Total events fetched: ${allEvents.length}`);
  console.log(`- Total events available: ${totalCount}`);
  console.log(`- Pages fetched: ${currentPage}`);
  console.log(`- Consolidated file: ${consolidatedFile}`);
  return consolidatedData;
}

export async function fetchAll({ continueOnError = false } = {}) {
  const steps = [
    ['members', fetchMembers],
    ['monthly', fetchMonthlyActivity],
    ['weekly', fetchWeeklyActivity],
    ['daily', fetchDailyActivity],
    ['spend', fetchSpend],
    ['usage-events', fetchAllUsageEvents]
  ];
  for (const [label, fn] of steps) {
    try {
      await fn({});
    } catch (e) {
      console.error(`[cursor] ${label} failed:`, e.message);
      if (!continueOnError) throw e;
    }
  }
}
