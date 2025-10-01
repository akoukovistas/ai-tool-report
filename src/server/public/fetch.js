(function(){
  try {
    var taskList=[
      { group:'GitHub', items:[
        { id:'github:fetch-seats', label:'Fetch Seats', needsOrg:true },
        { id:'github:enrich', label:'Enrich (names)' },
        { id:'github:diagnose-seats', label:'Diagnose Seats', needsOrg:true },
        { id:'github:seats-csv', label:'Seats CSV', needsOrg:true }
      ]},
      { group:'Cursor', items:[
        { id:'cursor:fetch-all', label:'Fetch All' },
        { id:'cursor:fetch-daily-activity', label:'Daily Activity' },
        { id:'cursor:fetch-monthly-activity', label:'Monthly Activity' },
        { id:'cursor:fetch-members', label:'Members' },
        { id:'cursor:fetch-spend', label:'Spend' },
        { id:'cursor:fetch-events', label:'Events' },
        { id:'cursor:aggregate-window', label:'Aggregate Window' },
        { id:'cursor:aggregate-monthly', label:'Aggregate Monthly' },
        { id:'cursor:csv', label:'Generate CSVs' }
      ]}
    ];
    var tasksDiv=document.getElementById('tasks');
    if(!tasksDiv) return;
    for(var gi=0; gi<taskList.length; gi++){
      var group=taskList[gi];
      var h=document.createElement('h3'); h.appendChild(document.createTextNode(group.group)); tasksDiv.appendChild(h);
      var wrap=document.createElement('div'); wrap.className='btn-grid';
      for(var ii=0; ii<group.items.length; ii++){
        (function(item){
          var b=document.createElement('button'); b.appendChild(document.createTextNode(item.label)); b.setAttribute('data-task', item.id);
          if(item.needsOrg) b.setAttribute('data-needs-org','1');
          b.addEventListener('click', function(){ runTask(item); });
          wrap.appendChild(b);
        })(group.items[ii]);
      }
      tasksDiv.appendChild(wrap);
    }
    var logEl=document.getElementById('log');
    var activeList=document.getElementById('active');
    function appendLog(line){ if(!logEl) return; if(logEl.value) logEl.value+='\n'; logEl.value+=line; logEl.scrollTop=logEl.scrollHeight; }
    function runTask(item){ var org=document.getElementById('org').value.replace(/\s+/g,'').trim(); if(item.needsOrg && !org){ alert('Org required'); return; }
      var body={ task:item.id, params:{ org: org } };
      fetch('/api/task/run', { method:'POST', headers:{ 'Content-Type':'application/json' }, body: JSON.stringify(body) })
        .then(function(r){ return r.json(); })
        .then(function(j){ if(j.id){ var li=document.createElement('li'); li.id='job-'+j.id; li.appendChild(document.createTextNode(item.label+' ('+j.id+') ...')); activeList.appendChild(li); pollJob(j.id, li, item.label); appendLog('Started '+item.id+' -> '+j.id); } else { appendLog('Failed to start '+item.id+': '+(j.error||'unknown')); } })
        .catch(function(err){ appendLog('Network error starting task: '+err.message); });
    }
    function pollJob(id, li, label){ fetch('/api/task/status?id='+encodeURIComponent(id))
        .then(function(r){ return r.json(); })
        .then(function(j){ if(j.error && !j.running){ li.textContent=label+' ('+id+') ERROR'; if(j.logs) for(var i=0;i<j.logs.length;i++) appendLog('['+j.logs[i].ts+'] '+j.logs[i].msg); appendLog('ERROR '+label+': '+j.error); return; }
          if(!j.running){ li.textContent=label+' ('+id+') done'; if(j.logs) for(var k=0;k<j.logs.length;k++) appendLog('['+j.logs[k].ts+'] '+j.logs[k].msg); return; }
          li.textContent=label+' ('+id+') running'; if(j.logs && j.logs.length){ li.title=j.logs[j.logs.length-1].msg; }
          setTimeout(function(){ pollJob(id, li, label); }, 1600); })
        .catch(function(){ setTimeout(function(){ pollJob(id, li, label); }, 2500); }); }
  } catch (e) { console.error('fetch.js init error', e); }
})();
