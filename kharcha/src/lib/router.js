import { useEffect, useState } from 'react';

export const PAGES = ['overview', 'transactions', 'budgets', 'recurring', 'data'];

function parse() {
  const h = window.location.hash.replace(/^#\/?/, '');
  const [p, q = ''] = h.split('?');
  return { page: PAGES.includes(p) ? p : 'overview', query: Object.fromEntries(new URLSearchParams(q)) };
}

/** Tiny hash router: #/transactions?cat=food */
export function useRoute() {
  const [route, setRoute] = useState(parse);
  useEffect(() => {
    const f = () => setRoute(parse());
    window.addEventListener('hashchange', f);
    return () => window.removeEventListener('hashchange', f);
  }, []);
  return route;
}

export const href = (page, q) => '#/' + page + (q && Object.keys(q).length ? '?' + new URLSearchParams(q) : '');
