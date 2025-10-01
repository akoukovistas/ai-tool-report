import fs from 'node:fs';
import path from 'node:path';
import { ensureDir } from '../common/fs.js';

// Input CSV path (latest Cursor analytics export). Adjust if needed.
const DEFAULT_CSV = 'data/cursor/cursor_analytics_13227481_2025-08-21T11_52_04.769Z.csv';

function parseCSVLine(line){
  // naive split; safe for this dataset (no quoted commas present in fields we use)
  return line.split(',');
}

function loadCSV(file){
  const text = fs.readFileSync(file, 'utf8');
  const lines = text.trim().split(/\r?\n/);
  const header = parseCSVLine(lines.shift());
  return { header, lines };
}

function computeAcceptedPctByUser(csvPath){
  const { header, lines } = loadCSV(csvPath);
  const EMAIL = header.indexOf('Email');
  const SUG_ADD = header.indexOf('Chat Suggested Lines Added');
  const SUG_DEL = header.indexOf('Chat Suggested Lines Deleted');
  const ACC_ADD = header.indexOf('Chat Accepted Lines Added');
  const ACC_DEL = header.indexOf('Chat Accepted Lines Deleted');
  if([EMAIL,SUG_ADD,SUG_DEL,ACC_ADD,ACC_DEL].some(i=>i===-1)){
    throw new Error('Expected Cursor analytics columns not found');
  }
  const by = new Map();
  for(const line of lines){
    if(!line) continue;
    const cols = parseCSVLine(line);
    const email = cols[EMAIL];
    if(!email) continue;
    const sug = (+cols[SUG_ADD]||0) + (+cols[SUG_DEL]||0);
    const acc = (+cols[ACC_ADD]||0) + (+cols[ACC_DEL]||0);
    const rec = by.get(email) || { email, suggested:0, accepted:0 };
    rec.suggested += sug;
    rec.accepted += acc;
    by.set(email, rec);
  }
  const rows = [...by.values()].filter(r=>r.suggested>0).sort((a,b)=>a.email.localeCompare(b.email));
  return rows.map(r=>({
    email: r.email,
    accepted: r.accepted,
    suggested: r.suggested,
    pct: r.suggested ? +(r.accepted*100/r.suggested).toFixed(1) : 0
  }));
}

function toMarkdown(rows, source){
  const lines = [];
  lines.push('# Accepted Lines of Code by User');
  lines.push('');
  lines.push(`Source: ${source}`);
  lines.push('');
  lines.push('| User (email) | Accepted | Suggested | % Accepted |');
  lines.push('|---|---:|---:|---:|');
  for(const r of rows){
    lines.push(`| ${r.email} | ${r.accepted} | ${r.suggested} | ${r.pct}% |`);
  }
  lines.push('');
  return lines.join('\n');
}

async function main(){
  const csvPath = process.env.CURSOR_ANALYTICS_CSV || DEFAULT_CSV;
  if(!fs.existsSync(csvPath)){
    console.error('Input CSV not found:', csvPath);
    process.exit(1);
  }
  const rows = computeAcceptedPctByUser(csvPath);
  ensureDir('output');
  const md = toMarkdown(rows, path.basename(csvPath));
  const outPath = '10-data-analysis.md';
  fs.writeFileSync(outPath, md, 'utf8');
  console.log('Wrote', outPath, 'with', rows.length, 'rows');
}

main().catch(err=>{ console.error(err); process.exit(1); });
