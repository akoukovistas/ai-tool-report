import React from 'react';

export function Header({ active }) {
  const link = (href, label, key) => React.createElement('a', {
    href,
    className: active===key ? 'nav-link active' : 'nav-link'
  }, label);
  return React.createElement('header', { className: 'site-header' },
    React.createElement('div', { className: 'brand' }, 'AI Metrics'),
    React.createElement('nav', { className: 'main-nav' },
      link('/', 'Menu', 'menu'),
      link('/fetch', 'Fetch Data', 'fetch'),
      link('/files', 'View Data', 'files')
    )
  );
}
