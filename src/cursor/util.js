import { existsSync, readdirSync } from 'node:fs';
import path from 'node:path';

export const iso = d => d.toISOString().slice(0,10);
export function chunkRange(start,end,max=90){ const out=[]; let s=new Date(start); while(s<=end){ const e=new Date(Math.min(end.getTime(), s.getTime()+(max-1)*86400000)); out.push([new Date(s),e]); s=new Date(e.getTime()+86400000);} return out; }

// Legacy (30-day rolling window formerly 'daily-usage') now treated as monthly activity
export function discoverLatestMonthlyActivity(){
	const dirs=['data/cursor/monthly-activity','data/cursor/daily-usage'];
	
	// First check legacy flat structure
	for(const dir of dirs){ 
		if(!existsSync(dir)) continue; 
		const files=readdirSync(dir).filter(f=>f.startsWith('monthly-activity_')||f.startsWith('monthly-report_')).filter(f=>f.endsWith('.json')); 
		if(files.length){ files.sort(); return path.join(dir, files.at(-1)); } 
	}
	
	// Check new date-structured format: data/cursor/YYYY/MM/
	const baseDir = 'data/cursor';
	if(!existsSync(baseDir)) return null;
	
	const allFiles = [];
	const years = readdirSync(baseDir).filter(f => /^\d{4}$/.test(f));
	
	for(const year of years) {
		const yearDir = path.join(baseDir, year);
		if(!existsSync(yearDir)) continue;
		
		const months = readdirSync(yearDir).filter(f => /^\d{2}$/.test(f));
		for(const month of months) {
			const monthDir = path.join(yearDir, month);
			if(!existsSync(monthDir)) continue;
			
			const files = readdirSync(monthDir)
				.filter(f => f.startsWith('monthly_activity_') && f.endsWith('.json'))
				.map(f => path.join(monthDir, f));
			allFiles.push(...files);
		}
	}
	
	if(allFiles.length) {
		allFiles.sort();
		return allFiles.at(-1);
	}
	
	return null;
}

export function discoverLatestDailyActivity(){
	// First check legacy flat structure
	const dir='data/cursor/daily-activity'; 
	if(existsSync(dir)) {
		const files=readdirSync(dir).filter(f=>f.startsWith('activity_')&&f.endsWith('.json')); 
		if(files.length) { files.sort(); return path.join(dir, files.at(-1)); }
	}
	
	// Check new date-structured format: data/cursor/YYYY/MM/DD/
	const baseDir = 'data/cursor';
	if(!existsSync(baseDir)) return null;
	
	const allFiles = [];
	const years = readdirSync(baseDir).filter(f => /^\d{4}$/.test(f));
	
	for(const year of years) {
		const yearDir = path.join(baseDir, year);
		if(!existsSync(yearDir)) continue;
		
		const months = readdirSync(yearDir).filter(f => /^\d{2}$/.test(f));
		for(const month of months) {
			const monthDir = path.join(yearDir, month);
			if(!existsSync(monthDir)) continue;
			
			const days = readdirSync(monthDir).filter(f => /^\d{2}$/.test(f));
			for(const day of days) {
				const dayDir = path.join(monthDir, day);
				if(!existsSync(dayDir)) continue;
				
				const files = readdirSync(dayDir)
					.filter(f => f.startsWith('daily_activity_') && f.endsWith('.json'))
					.map(f => path.join(dayDir, f));
				allFiles.push(...files);
			}
		}
	}
	
	if(allFiles.length) {
		allFiles.sort();
		return allFiles.at(-1);
	}
	
	return null;
}

export function parseDate(v){ if(typeof v==='number') return new Date(v); if(typeof v==='string'){ if(/^\d+$/.test(v)) return new Date(Number(v)); return new Date(v+'T00:00:00Z'); } return null; }
export const NUMERIC_FIELDS=['totalLinesAdded','totalLinesDeleted','acceptedLinesAdded','acceptedLinesDeleted','totalApplies','totalAccepts','totalRejects','totalTabsShown','totalTabsAccepted','composerRequests','chatRequests','agentRequests','cmdkUsages','subscriptionIncludedReqs','apiKeyReqs','usageBasedReqs','bugbotUsages'];
