// Client-side CSV explorer
(function(){
  const statusEl = document.getElementById('status');
  const appEl = document.getElementById('app');
  const navEl = document.getElementById('nav');
  const ROOT = 'output';
  let loadingList = false;

  function safeAnchor(str){
    let out='';
    for(let i=0;i<str.length;i++){ const c=str[i]; if(/^[a-zA-Z0-9_-]$/.test(c)) out+=c; else out+='_'; }
    return out || 'root';
  }

  async function fetchJSON(url){ const r = await fetch(url); if(!r.ok) throw new Error(await r.text()); return r.json(); }

  async function loadList(){
    if(loadingList) return; loadingList=true;
  const rootVal = ROOT;
    statusEl.textContent='Loading list...';
    try {
      const resp = await fetchJSON('/api/csv-list?root='+encodeURIComponent(rootVal));
      const groups = resp.groups||{}; const navLinks=[]; const sections=[];
      Object.keys(groups).sort().forEach(dir=>{
        const anchor='dir-'+(dir==='.'?'root':safeAnchor(dir));
        navLinks.push('<a href="#'+anchor+'">'+(dir==='.'?'(root)':dir)+'</a>');
        const fileSections = groups[dir].map(f=>{
          const secId='sec-'+safeAnchor(f.relPath);
          return '<section id="'+secId+'"><h3>'+f.name+'</h3><div class="table-wrapper" data-relpath="'+f.relPath+'"><p class="placeholder">(Click to load)</p></div></section>';
        }).join('');
        sections.push('<div class="dir-group" id="'+anchor+'"><h2>'+(dir==='.'?'Root':dir)+'</h2>'+fileSections+'</div>');
      });
      navEl.innerHTML = navLinks.join(' | ');
      appEl.innerHTML = sections.join('') || '<p>No CSV files found under '+rootVal+'.</p>';
      appEl.querySelectorAll('.table-wrapper').forEach(div=>div.addEventListener('click', ()=>loadFile(div.getAttribute('data-relpath'), div)));
      statusEl.textContent='List loaded. Click a table area to load its CSV.';
    } catch(e){ statusEl.textContent='Error: '+e.message; appEl.innerHTML='<p style="color:#f66">'+e.message+'</p>'; }
    finally { loadingList=false; }
  }

  async function loadFile(relPath, container){
    if(!relPath || container.dataset.loaded) return;
    container.classList.add('loading');
  const rootVal = ROOT;
    try {
      const res = await fetch('/api/csv?root='+encodeURIComponent(rootVal)+'&path='+encodeURIComponent(relPath));
      if(!res.ok) throw new Error(await res.text());
      const text = await res.text();
      const cleaned = text.split('\r').join('');
      const lines = cleaned.trim().split('\n').filter(l=>l);
      const header = lines.length?lines[0].split(','):[];
      const rows = lines.slice(1).map(line=>{ const cols=line.split(','); const obj={}; header.forEach((h,i)=>obj[h]=cols[i]||''); return obj; });
      const ths = header.map(h=>'<th>'+h+'</th>').join('');
      const trs = rows.map(r=>'<tr>'+header.map(h=>'<td>'+(r[h]||'')+'</td>').join('')+'</tr>').join('');
      container.innerHTML='<table><thead><tr>'+ths+'</tr></thead><tbody>'+trs+'</tbody></table>';
  container.dataset.loaded='1';
    } catch(e){ container.innerHTML='<p style="color:#f66">Error: '+e.message+'</p>'; }
    finally { container.classList.remove('loading'); }
  }

  loadList();
})();
