(function(){
  function $(id){ return document.getElementById(id); }
  var startBtn=$('startBtn'); var logEl=$('log'); var statusEl=$('status');
  function append(line){ if(!logEl) return; if(logEl.value) logEl.value+='\n'; logEl.value+=line; logEl.scrollTop=logEl.scrollHeight; }
  function poll(){ fetch('/api/fetch-status').then(r=>r.json()).then(j=>{ if(statusEl) statusEl.textContent = j.running? 'Running' : (j.error? 'Error' : 'Idle'); if(j.logs && logEl){ logEl.value = j.logs.map(l=>'['+l.ts+'] '+l.msg).join('\n'); if(j.error) append('ERROR: '+j.error); } if(j.running) setTimeout(poll,1500); else if(startBtn) startBtn.disabled=false; }).catch(e=>{ append('Poll error: '+e.message); setTimeout(poll,2500); }); }
  if(startBtn){
    startBtn.addEventListener('click', function(){ startBtn.disabled=true; append('Starting fetch...'); fetch('/api/fetch-start',{ method:'POST' }).then(r=>r.json()).then(j=>{ append('Fetch started for org '+(j.org||'?')); setTimeout(poll,500); }).catch(e=>{ append('Start failed: '+e.message); if(startBtn) startBtn.disabled=false; }); });
  }
  poll();
})();
