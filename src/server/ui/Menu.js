import React from 'react';
import { Header } from './Header.js';

export function MenuPage({ title }) {
  return React.createElement('html', null,
    React.createElement('head', null,
      React.createElement('meta', { charSet: 'utf-8' }),
      React.createElement('title', null, title||'AI Metrics'),
      React.createElement('style', null, `body{font-family:system-ui,Arial,sans-serif;margin:0;}main{max-width:860px;margin:2rem auto;padding:0 1.5rem;}h1{margin:0 0 1rem;font-size:1.4rem;}ul.cards{list-style:none;padding:0;margin:1.25rem 0;display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:1rem;}ul.cards li{border:1px solid #e0e5ea;border-radius:8px;padding:1rem;background:#fff;box-shadow:0 1px 2px rgba(0,0,0,0.03);}a.cta{display:inline-block;margin-top:.65rem;padding:.55rem .85rem;border-radius:5px;background:#0b5ed7;color:#fff;text-decoration:none;font-size:.75rem;}a.cta.secondary{background:#555;}a.cta:hover{background:#094baf;}p.desc{color:#555;font-size:.75rem;margin:.4rem 0 0;line-height:1.3;}footer{margin:3rem 0 2rem;font-size:.65rem;color:#666;text-align:center;}header.site-header{display:flex;align-items:center;justify-content:space-between;padding:.75rem 1.25rem;background:#0b5ed7;color:#fff;}header.site-header .brand{font-weight:600;}nav.main-nav a{color:#fff;text-decoration:none;margin-left:1rem;font-size:.75rem;opacity:.85;}nav.main-nav a.active{opacity:1;font-weight:600;}nav.main-nav a:hover{opacity:1;text-decoration:underline;}body{background:linear-gradient(#f8fafc,#f1f5f9);}::selection{background:#0b5ed7;color:#fff;}`)
    ),
    React.createElement('body', null,
      React.createElement(Header, { active: 'menu' }),
      React.createElement('main', null,
        React.createElement('h1', null, 'AI Metrics'),
        React.createElement('ul', { className: 'cards' },
          React.createElement('li', null,
            React.createElement('h2', null, 'Fetch Data'),
            React.createElement('p', { className: 'desc' }, 'Run API calls to refresh raw GitHub & Cursor data (controls coming soon).'),
            React.createElement('a', { href: '/fetch', className: 'cta' }, 'Open Fetch')
          ),
          React.createElement('li', null,
            React.createElement('h2', null, 'View Data'),
            React.createElement('p', { className: 'desc' }, 'Browse generated CSV outputs grouped by directory.'),
            React.createElement('a', { href: '/files', className: 'cta secondary' }, 'Browse Files')
          )
        ),
        React.createElement('footer', null, 'Build ', new Date().toISOString())
      )
    )
  );
}
