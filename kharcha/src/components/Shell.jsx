import { useEffect, useState } from 'react';
import { Icon } from './ui.jsx';
import AddSheet from './AddSheet.jsx';
import Overview from '../pages/Overview.jsx';
import Transactions from '../pages/Transactions.jsx';
import Budgets from '../pages/Budgets.jsx';
import Recurring from '../pages/Recurring.jsx';
import DataPage from '../pages/DataPage.jsx';
import { useData } from '../data/store.jsx';
import { href, useRoute } from '../lib/router.js';

const NAV = [
  ['overview', 'Overview', 'home'],
  ['transactions', 'Transactions', 'list'],
  ['budgets', 'Budgets', 'target'],
  ['recurring', 'Recurring', 'repeat'],
  ['data', 'Data', 'database'],
];

export default function Shell() {
  const route = useRoute();
  const { mode, error, reload, session } = useData();
  const [sheet, setSheet] = useState({ open: false, editing: null });
  const open = (editing = null) => setSheet({ open: true, editing: editing && editing.id ? editing : null });

  useEffect(() => {
    const onKey = (e) => {
      if (e.key !== 'n' || e.metaKey || e.ctrlKey || e.altKey) return;
      if (/input|textarea|select/i.test((document.activeElement && document.activeElement.tagName) || '')) return;
      if (document.querySelector('.scrim')) return;
      e.preventDefault();
      setSheet({ open: true, editing: null });
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => window.scrollTo(0, 0), [route.page]);

  const page = {
    overview: <Overview onAdd={open} onEdit={open} />,
    transactions: <Transactions onEdit={open} route={route} />,
    budgets: <Budgets />,
    recurring: <Recurring />,
    data: <DataPage />,
  }[route.page];

  return (
    <div className="app">
      <aside className="side">
        <div className="brand"><span className="logo" aria-hidden="true">K</span> Kharcha Book</div>
        <button type="button" className="btn add" onClick={() => open()}><Icon name="plus" size={16} /> Add entry <kbd>N</kbd></button>
        <nav aria-label="Main">
          {NAV.map(([id, label, icon]) => (
            <a key={id} href={href(id)} aria-current={route.page === id ? 'page' : undefined}>
              <Icon name={icon} size={18} /> {label}
            </a>
          ))}
        </nav>
        <div className="side-foot">
          {mode === 'cloud' ? <span title={session.user.email}>{session.user.email}</span> : <span>Saved in this browser only</span>}
        </div>
      </aside>

      <main className="main" id="main">
        {mode === 'local' && <div className="note"><p><b>Local mode.</b> Entries stay in this browser. Connect Supabase (see the README) to sign in and use the app from any device.</p></div>}
        {error && (
          <div className="note warn">
            <p>{error}</p>
            <button type="button" className="btn sm" onClick={reload}>Try again</button>
          </div>
        )}
        {page}
      </main>

      <nav className="bnav" aria-label="Main">
        {NAV.map(([id, label, icon]) => (
          <a key={id} href={href(id)} aria-current={route.page === id ? 'page' : undefined}>
            <Icon name={icon} size={20} />
            <span>{label}</span>
          </a>
        ))}
      </nav>
      <button type="button" className="fab" onClick={() => open()} aria-label="Add entry"><Icon name="plus" size={24} /></button>

      <AddSheet open={sheet.open} editing={sheet.editing} onClose={() => setSheet({ open: false, editing: null })} />
    </div>
  );
}
