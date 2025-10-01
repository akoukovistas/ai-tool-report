import React from 'react';
import { Header } from './Header.js';

export function FetchPage({ title, hasOrg, hasToken, hasCursor, missing = [], org }) {
  return React.createElement('html', null,
    React.createElement('head', null,
      React.createElement('meta', { charSet: 'utf-8' }),
      React.createElement('title', null, title||'Fetch Data'),
      React.createElement('style', null, `body{font-family:system-ui,Arial,sans-serif;margin:0;background:linear-gradient(#f8fafc,#f1f5f9);}main{max-width:820px;margin:1.75rem auto 2.5rem;padding:0 1.5rem;}h1{margin:.25rem 0 1rem;font-size:1.15rem;}a{color:#0b5ed7;text-decoration:none;}a:hover{text-decoration:underline;}button{cursor:pointer;}#actions{margin:1.1rem 0 1.35rem;display:flex;flex-wrap:wrap;gap:.75rem;}button.primary{background:#0b5ed7;color:#fff;border:none;border-radius:6px;padding:.65rem 1rem;font-size:.7rem;font-weight:600;display:inline-flex;align-items:center;gap:.4rem;box-shadow:0 1px 2px rgba(0,0,0,.05);}button.primary[disabled]{opacity:.55;cursor:default;}button.primary:hover:not([disabled]){background:#094baf;}textarea{width:100%;min-height:320px;font-family:ui-monospace,monospace;font-size:.7rem;line-height:1.3;border:1px solid #d0d7de;border-radius:6px;padding:.65rem;background:#fff;white-space:pre;overflow-wrap:normal;overflow-x:auto;box-shadow:0 1px 2px rgba(0,0,0,.04);}footer{margin-top:1.6rem;font-size:.62rem;color:#666;text-align:center;}#status{font-weight:600;}#meta{font-size:.65rem;color:#555;margin:.25rem 0 1rem;}header.site-header{display:flex;align-items:center;justify-content:space-between;padding:.75rem 1.25rem;background:#0b5ed7;color:#fff;}header.site-header .brand{font-weight:600;}nav.main-nav a{color:#fff;text-decoration:none;margin-left:1rem;font-size:.75rem;opacity:.85;}nav.main-nav a.active{opacity:1;font-weight:600;}nav.main-nav a:hover{opacity:1;text-decoration:underline;}code{background:#f1f5f9;padding:2px 6px;border-radius:4px;font-size:.65rem;}small.hint{display:block;font-size:.55rem;color:#666;margin-top:.25rem;}::selection{background:#0b5ed7;color:#fff;}`)
    ),
    React.createElement('body', null,
      React.createElement(Header, { active: 'fetch' }),
      React.createElement('main', null,
        React.createElement('h1', null, 'Fetch Fresh Data'),
        React.createElement('div', { id: 'meta' }, 'Org: ', React.createElement('code', null, org || 'N/A')),
        React.createElement('div', { id: 'actions' },
          (hasOrg && hasToken) && React.createElement('button', { id: 'btnGithubUpdate', className: 'primary' }, 'Update GitHub Data'),
          (hasOrg && hasToken) && React.createElement('button', { id: 'btnGithubMetrics', className: 'primary' }, 'Fetch Copilot Metrics'),
          hasCursor && React.createElement('button', { id: 'btnCursorDaily', className: 'primary' }, 'Fetch Cursor Today'),
          hasCursor && React.createElement('button', { id: 'btnCursorMonthly', className: 'primary' }, 'Fetch Cursor 30d'),
          (!(hasOrg && hasToken) || !hasCursor) && React.createElement('em', null, 'Missing env vars: ' + (missing.length ? missing.join(', ') : 'Unknown'))
        ),
        (hasOrg && hasToken) && React.createElement('div', { style: { marginBottom: '0.5rem', fontSize: '.72rem' } },
          React.createElement('label', null, 'Org: ', React.createElement('input', { id: 'orgInput', defaultValue: org || '', placeholder: 'org slug', style: { width: '10rem', marginRight: '0.5rem' } })),
          React.createElement('label', null, 'Since: ', React.createElement('input', { id: 'sinceInput', placeholder: 'YYYY-MM-DD or ISO', style: { width: '12rem', marginRight: '0.5rem' } })),
          React.createElement('label', null, 'Until: ', React.createElement('input', { id: 'untilInput', placeholder: 'YYYY-MM-DD or ISO', style: { width: '12rem' } })),
          React.createElement('div', { className: 'hint' }, React.createElement('small', { className: 'hint' }, 'Leave dates empty for last 100 days. Dates interpreted as UTC.'))
        ),
        React.createElement('div', null, 'Status: ', React.createElement('span', { id: 'status' }, 'Idle')),
        React.createElement('textarea', { id: 'log', readOnly: true, placeholder: 'No fetch started. Logs will appear here when controls are added.' }),
        React.createElement('footer', null, 'Page ', new Date().toISOString()),
  // Removed legacy aggregate fetch script
  React.createElement('script', { src: '/github-update.js' }),
  React.createElement('script', { src: '/github-metrics.js' }),
  React.createElement('script', { src: '/cursor-update.js' })
      )
    )
  );
}
