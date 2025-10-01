import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

export const ensureDir = p => { if (!existsSync(p)) mkdirSync(p, { recursive: true }); };
export const readJSON = p => JSON.parse(readFileSync(p,'utf8'));
export const writeJSON = (p,data) => { ensureDir(path.dirname(p)); writeFileSync(p, JSON.stringify(data,null,2)); };
export function writeCSV(file, header, rows) { const lines=[header.join(',')]; for(const r of rows){ lines.push(header.map(h=>sanitize(String(r[h]??''))).join(',')); } ensureDir(path.dirname(file)); writeFileSync(file,'\uFEFF'+lines.join('\n'),'utf8'); }
export const sanitize = v => v.replace(/\r?\n/g,' ').replace(/,/g,' ');
