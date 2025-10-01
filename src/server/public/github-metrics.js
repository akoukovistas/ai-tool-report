(function(){
  const btn = document.getElementById('btnGithubMetrics');
  if(!btn) return;
  const log = document.getElementById('log');
  const statusEl = document.getElementById('status');
  function append(m){ if(!log) return; if(log.value) log.value+='\n'; log.value+='['+new Date().toISOString()+'] '+m; log.scrollTop=log.scrollHeight; }
  function poll(){ fetch('/api/github-metrics-status').then(r=>r.json()).then(j=>{
    if(statusEl) statusEl.textContent = j.running? 'Running' : (j.error? 'Error' : 'Idle');
    if(j.logs && log){ log.value = j.logs.map(l=>'['+l.ts+'] '+l.msg).join('\n'); if(j.error) append('ERROR: '+j.error); }
    if(j.running) setTimeout(poll,1500); else if(btn) btn.disabled=false;
  }).catch(e=>{ append('Poll error: '+e.message); setTimeout(poll,2500); }); }
  btn.addEventListener('click', ()=>{
    btn.disabled=true; append('Starting GitHub Copilot metrics fetch...');
    const params = new URLSearchParams();
    const orgEl = document.getElementById('orgInput');
    const sinceEl = document.getElementById('sinceInput');
    const untilEl = document.getElementById('untilInput');
    if(orgEl && orgEl.value) params.set('org', orgEl.value.trim());
    if(sinceEl && sinceEl.value) params.set('since', sinceEl.value.trim());
    if(untilEl && untilEl.value) params.set('until', untilEl.value.trim());
    fetch('/api/github-metrics-start?'+params.toString(),{ method:'POST' })
      .then(r=>r.json())
      .then(j=>{ if(!j.started){ append('Start failed: '+(j.error||'unknown')); if(btn) btn.disabled=false; return; } append('Metrics fetch started for org '+(j.org||'?')); setTimeout(poll,600); })
      .catch(e=>{ append('Start failed: '+e.message); if(btn) btn.disabled=false; });
  });
  // No auto-poll here; wait for a click
})();
