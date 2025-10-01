import React from 'react';
import { Header } from './Header.js';

export function ListPage({ title, files }) {
  const fmt = ms => {
    if(!ms) return '—';
    try { const d=new Date(ms); return d.toLocaleDateString(undefined,{ year:'numeric', month:'short', day:'2-digit'}); } catch { return '—'; }
  };
  return React.createElement('html', null,
    React.createElement('head', null,
      React.createElement('meta', { charSet: 'utf-8' }),
      React.createElement('title', null, title),
      React.createElement('style', null, `body{font-family:system-ui,Arial,sans-serif;margin:0;}main{max-width:1100px;margin:1.75rem auto;padding:0 1.5rem;}h1{font-size:1.3rem;margin:0 0 1rem;}ul.files{list-style:none;padding:0;margin:0;}ul.files li{margin:0.3rem 0;padding:0.35rem 0.5rem;border:1px solid #e1e7ec;border-radius:6px;background:#fff;display:flex;align-items:center;gap:.65rem;font-size:.75rem;}ul.files li a{flex:0 0 auto;font-weight:600;color:#0b5ed7;text-decoration:none;font-size:.75rem;}ul.files li a:hover{text-decoration:underline;}ul.files code{background:#f1f5f9;padding:2px 6px;border-radius:4px;font-size:.7rem;}footer{margin:2.25rem 0 2rem;font-size:.65rem;color:#666;text-align:center;}header.site-header{display:flex;align-items:center;justify-content:space-between;padding:.75rem 1.25rem;background:#0b5ed7;color:#fff;}header.site-header .brand{font-weight:600;}nav.main-nav a{color:#fff;text-decoration:none;margin-left:1rem;font-size:.75rem;opacity:.85;}nav.main-nav a.active{opacity:1;font-weight:600;}nav.main-nav a:hover{opacity:1;text-decoration:underline;}body{background:linear-gradient(#f8fafc,#f1f5f9);}::selection{background:#0b5ed7;color:#fff;}`)
    ),
    React.createElement('body', null,
      React.createElement(Header, { active: 'files' }),
      React.createElement('main', null,
        React.createElement('h1', null, 'CSV Files'),
        React.createElement('ul', { className: 'files' },
          files.map(f => React.createElement('li', { key: f.relPath },
            React.createElement('a', { href: `/view?path=${encodeURIComponent(f.relPath)}` }, f.name),
            React.createElement('code', null, f.relPath),
            React.createElement('span', { style:{ marginLeft:'auto', fontSize:'.6rem', opacity:.7 } }, fmt(f.ctime))
          ))
        ),
        React.createElement('footer', null, 'Generated at ', new Date().toISOString())
      )
    )
  );
}
