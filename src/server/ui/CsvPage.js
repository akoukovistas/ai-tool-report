import React from 'react';
import { Header } from './Header.js';

function parseCSV(text){
  const lines = text.trim().split(/\r?\n/);
  return lines.map(l=>l.split(','));
}

export function CsvPage({ title, relPath, csvText }) {
  const rows = parseCSV(csvText);
  const headers = rows.length ? rows[0] : [];
  const dataRows = rows.slice(1);
  function toInlineJSON(obj){
    return JSON.stringify(obj).split('<').join('\\u003C');
  }
  const columnsJSON = toInlineJSON(headers);
  const dataJSON = toInlineJSON(dataRows);
  return React.createElement('html', null,
    React.createElement('head', null,
      React.createElement('meta', { charSet: 'utf-8' }),
      React.createElement('title', null, title),
      React.createElement('link', { rel: 'stylesheet', href: 'https://unpkg.com/gridjs/dist/theme/mermaid.min.css' }),
      React.createElement('style', null, `body{font-family:system-ui,Arial,sans-serif;margin:0;background:linear-gradient(#f8fafc,#f1f5f9);}main{max-width:1300px;margin:1.4rem auto 2.25rem;padding:0 1.25rem;}h1{font-size:1.05rem;margin:0 0 .65rem;}a{color:#0b5ed7;text-decoration:none;}a:hover{text-decoration:underline;}button.download,a.download{background:#0b5ed7;color:#fff;border:none;padding:6px 11px;border-radius:4px;cursor:pointer;font-size:0.65rem;display:inline-block;font-weight:600;letter-spacing:.3px;}button.download:hover,a.download:hover{background:#094baf;}span.actions{display:inline-flex;gap:.75rem;align-items:center;margin-left:.75rem;}#grid-wrapper{margin-top:.85rem;}#grid-wrapper .gridjs-container{font-size:0.7rem;} .meta{font-size:0.6rem;color:#555;margin-top:.6rem;}header.site-header{display:flex;align-items:center;justify-content:space-between;padding:.75rem 1.25rem;background:#0b5ed7;color:#fff;}header.site-header .brand{font-weight:600;}nav.main-nav a{color:#fff;text-decoration:none;margin-left:1rem;font-size:.75rem;opacity:.85;}nav.main-nav a.active{opacity:1;font-weight:600;}nav.main-nav a:hover{opacity:1;text-decoration:underline;}code{background:#f1f5f9;padding:2px 6px;border-radius:4px;font-size:.6rem;}::selection{background:#0b5ed7;color:#fff;}`),
      React.createElement('script', { src: 'https://unpkg.com/gridjs/dist/gridjs.umd.js' })
    ),
    React.createElement('body', null,
      React.createElement(Header, { active: 'files' }),
      React.createElement('main', null,
        React.createElement('h1', null, title),
        React.createElement('p', null,
          React.createElement('code', null, relPath),
          React.createElement('span', { className: 'actions' },
            React.createElement('a', { href: `/download?path=${encodeURIComponent(relPath)}`, className: 'download', download: title }, 'Download CSV')
          )
        ),
        React.createElement('div', { id: 'grid-fallback' },
          React.createElement('p', null, 'Loading interactive table...')
        ),
        React.createElement('div', { id: 'grid-wrapper' }),
        React.createElement('div', { className: 'meta' }, `${dataRows.length} rows`),
  React.createElement('script', { dangerouslySetInnerHTML: { __html: `(()=>{if(!window.gridjs){return;}const C=${columnsJSON};const D=${dataJSON};const wrap=document.getElementById('grid-wrapper');const fb=document.getElementById('grid-fallback');if(fb) fb.remove();function render(limit){ if(!wrap) return; wrap.innerHTML=''; const opts={ columns:C, data:D, search:true, sort:true, resizable:true, style:{ table:{'white-space':'nowrap'} } }; if(limit==='all'){ opts.pagination=false; } else { opts.pagination={ limit: parseInt(limit,10)||25 }; } new gridjs.Grid(opts).render(wrap); const inject=()=>{ const searchBox=wrap.querySelector('.gridjs-head .gridjs-search'); if(!searchBox){ requestAnimationFrame(inject); return; } if(searchBox.querySelector('#pageSizeSelect')){ const sel=searchBox.querySelector('#pageSizeSelect'); sel.value=limit==='all'?'all':String(limit); return; } const label=document.createElement('label'); label.style.fontSize='0.65rem'; label.style.marginLeft='8px'; label.style.display='flex'; label.style.alignItems='center'; label.style.gap='4px'; label.textContent='Rows:'; const sel=document.createElement('select'); sel.id='pageSizeSelect'; sel.style.padding='2px 4px'; sel.style.fontSize='0.65rem'; ['25','50','100','250','all'].forEach(v=>{ const o=document.createElement('option'); o.value=v; o.textContent= v==='all' ? 'All' : v; sel.appendChild(o); }); sel.value= limit==='all' ? 'all' : String(limit); sel.addEventListener('change', ()=> render(sel.value)); label.appendChild(sel); searchBox.appendChild(label); }; inject(); } render(25);})();` } })
      )
    )
  );
}
