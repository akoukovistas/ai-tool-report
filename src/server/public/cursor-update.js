(function(){
  const log = document.getElementById('log');
  const statusEl = document.getElementById('status');
  function append(m){ if(!log) return; if(log.value) log.value+='\n'; log.value+='['+new Date().toISOString()+'] '+m; log.scrollTop=log.scrollHeight; }
  function poll(job, statusUrl, startBtn){
    fetch(statusUrl).then(r=>r.json()).then(j=>{
      const running = j.running;
      if(statusEl) statusEl.textContent = running? 'Running' : (j.error? 'Error' : 'Idle');
      if(j.logs && log){ log.value = j.logs.map(l=>'['+l.ts+'] '+l.msg).join('\n'); if(j.error) append('ERROR: '+j.error); }
      if(running) setTimeout(()=>poll(job,statusUrl,startBtn),1500); else if(startBtn) startBtn.disabled=false;
    }).catch(e=>{ append('Poll error: '+e.message); setTimeout(()=>poll(job,statusUrl,startBtn),2500); });
  }
  function hook(btnId, startUrl, statusUrl, label){
    const btn = document.getElementById(btnId);
    if(!btn) return;
    btn.addEventListener('click', ()=>{
      btn.disabled=true;
      append('Starting '+label+' ...');
      fetch(startUrl,{ method:'POST' }).then(r=>r.json()).then(j=>{
        if(j.skipped){ append(label+' skipped (fresh data)'); btn.disabled=false; return; }
        if(!j.started){ append(label+' start failed: '+(j.error||'unknown')); btn.disabled=false; return; }
        append(label+' started'+(j.force?' (force)':''));
        setTimeout(()=>poll(label,statusUrl,btn),600);
      }).catch(e=>{ append(label+' start error: '+e.message); btn.disabled=false; });
    });
    poll(label,statusUrl,btn);
  }
  hook('btnCursorDaily','/api/cursor-daily-start','/api/cursor-daily-status','Cursor Daily');
  hook('btnCursorMonthly','/api/cursor-monthly-start','/api/cursor-monthly-status','Cursor 30d');
})();
