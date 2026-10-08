import { useEffect, useMemo, useState } from 'react';
import { Empty, Icon, Seg, useToast } from '../components/ui.jsx';
import MonthNav from '../components/MonthNav.jsx';
import TxRow from '../components/TxRow.jsx';
import { useData } from '../data/store.jsx';
import { EXPENSE_CATS, INCOME_CATS, METHODS, CAT, METHOD, catName } from '../lib/categories.js';
import { fmtLong, longMonth, monthOf } from '../lib/dates.js';
import { inr } from '../lib/format.js';

const START = { scope: 'month', type: 'all', cat: 'all', method: 'all', q: '', sort: 'newest' };

export default function Transactions({ onEdit, route }) {
  const { ready, txs, month, deleteTx } = useData();
  const toast = useToast();
  const [f, setF] = useState(START);
  const [limit, setLimit] = useState(100);
  const set = (patch) => {
    setF((p) => ({ ...p, ...patch }));
    setLimit(100);
  };

  // Arriving from a category on the Overview page pre-fills the filters.
  const qc = route.query.cat;
  const qt = route.query.type;
  useEffect(() => {
    if (qc || qt) {
      setF((p) => ({ ...p, scope: 'month', cat: CAT[qc] ? qc : 'all', type: qt === 'income' || qt === 'expense' ? qt : 'all' }));
      setLimit(100);
    }
  }, [qc, qt]);

  const rows = useMemo(() => {
    const q = f.q.trim().toLowerCase();
    const out = txs.filter((t) => {
      if (f.scope === 'month' && monthOf(t.date) !== month) return false;
      if (f.type !== 'all' && t.type !== f.type) return false;
      if (f.cat !== 'all' && t.category !== f.cat) return false;
      if (f.method !== 'all' && t.method !== f.method) return false;
      if (q && !`${t.note} ${catName(t.category)} ${METHOD[t.method] || ''} ${t.amount / 100}`.toLowerCase().includes(q)) return false;
      return true;
    });
    const by = {
      newest: (a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0),
      oldest: (a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0),
      highest: (a, b) => b.amount - a.amount,
      lowest: (a, b) => a.amount - b.amount,
    }[f.sort];
    return out.sort(by);
  }, [txs, f, month]);

  const income = rows.filter((t) => t.type === 'income').reduce((a, t) => a + t.amount, 0);
  const expense = rows.filter((t) => t.type === 'expense').reduce((a, t) => a + t.amount, 0);
  const shown = rows.slice(0, limit);
  const grouped = f.sort === 'newest' || f.sort === 'oldest';
  const groups = useMemo(() => {
    if (!grouped) return [];
    const g = [];
    for (const t of shown) {
      const last = g[g.length - 1];
      if (last && last.date === t.date) last.items.push(t);
      else g.push({ date: t.date, items: [t] });
    }
    return g;
  }, [shown, grouped]);

  const del = async (t) => {
    const r = await deleteTx(t.id);
    toast(r.ok ? 'Entry deleted' : r.error, r.ok ? 'ok' : 'bad');
  };
  const filtering = f.type !== 'all' || f.cat !== 'all' || f.method !== 'all' || f.q !== '';

  return (
    <div className="page">
      <header className="page-h">
        <h1>Transactions</h1>
        <div className="page-actions">{f.scope === 'month' && <MonthNav />}</div>
      </header>

      <section className="card">
        <div className="filters">
          <Seg label="Period" value={f.scope} onChange={(v) => set({ scope: v })} options={[{ value: 'month', label: 'This month' }, { value: 'all', label: 'All time' }]} />
          <Seg label="Type" value={f.type} onChange={(v) => set({ type: v, cat: 'all' })} options={[{ value: 'all', label: 'All' }, { value: 'expense', label: 'Expenses' }, { value: 'income', label: 'Income' }]} />
          <div className="searchbox">
            <Icon name="search" size={16} />
            <input className="input" type="search" placeholder="Search note, category or amount" aria-label="Search entries" value={f.q} onChange={(e) => set({ q: e.target.value })} />
          </div>
          <select className="input" aria-label="Category" value={f.cat} onChange={(e) => set({ cat: e.target.value })}>
            <option value="all">All categories</option>
            {f.type !== 'income' && <optgroup label="Expenses">{EXPENSE_CATS.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</optgroup>}
            {f.type !== 'expense' && <optgroup label="Income">{INCOME_CATS.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</optgroup>}
          </select>
          <select className="input" aria-label="Payment method" value={f.method} onChange={(e) => set({ method: e.target.value })}>
            <option value="all">Any method</option>
            {METHODS.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
          <select className="input" aria-label="Sort" value={f.sort} onChange={(e) => set({ sort: e.target.value })}>
            <option value="newest">Newest first</option>
            <option value="oldest">Oldest first</option>
            <option value="highest">Highest amount</option>
            <option value="lowest">Lowest amount</option>
          </select>
        </div>
        <p className="lsum">
          {rows.length} {rows.length === 1 ? 'entry' : 'entries'} · spent {inr(expense)}
          {income > 0 && <> · income <span className="incomeTxt">{inr(income)}</span></>}
          {f.scope === 'month' ? ` in ${longMonth(month)}` : ' all time'}
          {filtering && <> · <button type="button" className="link" onClick={() => set({ type: 'all', cat: 'all', method: 'all', q: '' })}>Clear filters</button></>}
        </p>

        {!ready ? (
          <p className="none">Loading your entries…</p>
        ) : rows.length === 0 ? (
          <Empty title={filtering ? 'No entries match' : f.scope === 'month' ? `Nothing logged in ${longMonth(month)}` : 'No entries yet'}>
            {filtering ? 'Try a different search or clear the filters.' : 'Use Add entry to log your first one.'}
          </Empty>
        ) : grouped ? (
          groups.map((g) => {
            const dayTotal = g.items.reduce((a, t) => a + (t.type === 'income' ? 0 : t.amount), 0);
            return (
              <div className="day" key={g.date}>
                <div className="day-h"><span>{fmtLong(g.date)}</span>{dayTotal > 0 && <span className="mono">{inr(dayTotal)} spent</span>}</div>
                <ul className="rows">{g.items.map((t) => <TxRow key={t.id} t={t} showDate={false} onEdit={onEdit} onDelete={del} />)}</ul>
              </div>
            );
          })
        ) : (
          <ul className="rows">{shown.map((t) => <TxRow key={t.id} t={t} onEdit={onEdit} onDelete={del} />)}</ul>
        )}
        {rows.length > limit && (
          <button type="button" className="btn ghost sm center" onClick={() => setLimit(limit + 100)}>Show more ({rows.length - limit} left)</button>
        )}
      </section>
    </div>
  );
}
