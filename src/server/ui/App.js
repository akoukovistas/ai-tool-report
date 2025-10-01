import React from 'react';

export function App({ title }) {
  const style = `:root { --bg:#0f1115; --panel:#1c2027; --text:#e6e9ef; --accent:#4dabf7; --border:#2a3038; font-family: system-ui,-apple-system,Segoe UI,Roboto,Ubuntu,sans-serif; }
  body { margin:0; background:var(--bg); color:var(--text); }
  header { padding:1rem 1.5rem; background:#12151a; position:sticky; top:0; z-index:10; box-shadow:0 2px 4px #0006; }
  h1 { margin:0; font-size:1.25rem; }
  main { padding:1rem 1.5rem 4rem; }
  nav a { color:var(--accent); text-decoration:none; margin-right:.75rem; font-size:.8rem; }
  nav a:hover { text-decoration:underline; }
  .table-wrapper { overflow:auto; border:1px solid var(--border); border-radius:6px; background:var(--panel); max-height:60vh; }
  table { border-collapse:collapse; width:100%; font-size:.72rem; }
  th, td { padding:.35rem .55rem; border-bottom:1px solid #242a33; white-space:nowrap; }
  thead th { position:sticky; top:0; background:#20252d; z-index:5; text-align:left; }
  tbody tr:nth-child(odd) { background:#1c2129; }
  tbody tr:hover { background:#28303a; }
  .controls { display:flex; gap:1rem; flex-wrap:wrap; align-items:center; margin:.75rem 0 1.25rem; }
  input, select { background:#14181d; color:var(--text); border:1px solid var(--border); padding:.45rem .6rem; border-radius:4px; }
  footer { position:fixed; bottom:0; left:0; right:0; background:#12151a; padding:.5rem 1rem; font-size:.7rem; opacity:.8; }
  .loading { opacity:.5; }`;
  return React.createElement('html', { lang:'en' },
    React.createElement('head', null,
      React.createElement('meta', { charSet:'utf-8' }),
      React.createElement('meta', { name:'viewport', content:'width=device-width,initial-scale=1' }),
      React.createElement('title', null, title),
      React.createElement('style', null, style)
    ),
    React.createElement('body', null,
      React.createElement('header', null,
        React.createElement('h1', null, title),
        React.createElement('div', { className:'controls' },
          React.createElement('span', { id:'status' })
        ),
        React.createElement('nav', { id:'nav' })
      ),
      React.createElement('main', { id:'app' }, React.createElement('p', null, 'Loading CSV list...')),
      React.createElement('footer', null, 'Server rendered React • ' + new Date().toISOString()),
    React.createElement('script', { type:'module', src:'/client.js' })
    )
  );
}

const clientScript = `(() => {
  const statusEl = document.getElementById('status');
  const appEl = document.getElementById('app');
  const navEl = document.getElementById('nav');
  const dirInput = document.getElementById('dirInput');
  const filterInput = document.getElementById('filterInput');
  const loadBtn = document.getElementById('loadBtn');
  let loadingList = false;


  function applyFilter() {
    const q = filterInput.value.trim().toLowerCase();
    let shown = 0, total = 0;
    document.querySelectorAll('.table-wrapper tbody tr').forEach(tr => {
      total++;
      const ok = !q || tr.textContent.toLowerCase().includes(q);
      tr.style.display = ok ? '' : 'none';
      if (ok) shown++;
    });
    statusEl.textContent = q ? (shown + '/' + total + ' rows match') : '';
  }

  filterInput.addEventListener('input', applyFilter);
  loadBtn.addEventListener('click', loadList);
  // Initial load
  loadList();
})();`;
