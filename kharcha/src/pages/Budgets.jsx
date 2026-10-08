import { useEffect, useMemo, useState } from 'react';
import { Chip, Dot, Meter, useToast } from '../components/ui.jsx';
import MonthNav from '../components/MonthNav.jsx';
import { useData } from '../data/store.jsx';
import { EXPENSE_CATS } from '../lib/categories.js';
import { longMonth } from '../lib/dates.js';
import { inr, parseAmount, pct } from '../lib/format.js';
import { monthStats } from '../lib/stats.js';

function status(spent, limit) {
  if (!limit) return null;
  if (spent > limit) return { tone: 'bad', icon: 'alert', text: `Over by ${inr(spent - limit)}`, meter: 'over' };
  if (spent / limit >= 0.8) return { tone: 'warn', icon: 'alert', text: `${inr(limit - spent)} left`, meter: 'warn' };
  return { tone: 'ok', icon: 'check', text: `${inr(limit - spent)} left`, meter: '' };
}

function Row({ id, label, hint, spent, limit, onSave }) {
  const [v, setV] = useState(limit ? String(limit / 100) : '');
  const [err, setErr] = useState('');
  useEffect(() => setV(limit ? String(limit / 100) : ''), [limit]);
  const st = status(spent, limit);

  async function commit() {
    const raw = v.trim();
    const p = raw === '' ? 0 : parseAmount(raw);
    if (raw !== '' && !p) return setErr('Enter an amount like 5000.');
    setErr('');
    if (p === limit) return;
    const r = await onSave(id, p);
    if (!r.ok) setErr(r.error);
  }
  return (
    <li className="brow">
      <div className="brow-top">
        <span className="cname">{id !== '_total' && <Dot id={id} />}<b>{label}</b></span>
        <label className="blimit">
          <span className="sr">Monthly limit for {label}</span>
          <span aria-hidden="true">₹</span>
          <input
            className="input"
            inputMode="decimal"
            autoComplete="off"
            placeholder="No limit"
            value={v}
            onChange={(e) => { setV(e.target.value); setErr(''); }}
            onBlur={commit}
            onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
          />
        </label>
      </div>
      {limit > 0 ? (
        <>
          <Meter value={spent} max={limit} tone={st.meter} />
          <div className="brow-foot">
            <span className="mono">{inr(spent)} of {inr(limit)} · {pct(spent, limit)}%</span>
            <Chip tone={st.tone} icon={st.icon}>{st.text}</Chip>
          </div>
        </>
      ) : (
        <div className="brow-foot"><span className="muted small">{hint}{spent ? ` · ${inr(spent)} spent` : ''}</span></div>
      )}
      <div className="errtxt" role="alert">{err}</div>
    </li>
  );
}

export default function Budgets() {
  const { txs, budgets, setBudget, month, ready } = useData();
  const toast = useToast();
  const st = useMemo(() => monthStats(txs, month), [txs, month]);
  const catSum = EXPENSE_CATS.reduce((a, c) => a + (budgets[c.id] || 0), 0);
  const total = budgets._total || 0;

  const save = async (id, p) => {
    const r = await setBudget(id, p);
    if (r.ok) toast(p ? 'Budget saved' : 'Budget removed');
    return r;
  };
  if (!ready) return <div className="page"><p className="muted">Loading…</p></div>;

  return (
    <div className="page">
      <header className="page-h">
        <h1>Budgets</h1>
        <div className="page-actions"><MonthNav /></div>
      </header>
      <p className="lede">Limits repeat every month. Progress below is for <b>{longMonth(month)}</b>. Leave a box empty for no limit.</p>

      {total > 0 && catSum > total && (
        <div className="note warn">
          <p>Your category limits add up to {inr(catSum)}, which is {inr(catSum - total)} more than your overall budget of {inr(total)}.</p>
        </div>
      )}

      <div className="grid">
        <section className="card span5">
          <div className="card-h"><h2>Overall</h2></div>
          <ul className="blist">
            <Row id="_total" label="Total spending" hint="Cap for everything you spend in a month" spent={st.expense} limit={total} onSave={save} />
          </ul>
        </section>
        <section className="card span7">
          <div className="card-h"><h2>By category</h2></div>
          <ul className="blist">
            {EXPENSE_CATS.map((c) => (
              <Row key={c.id} id={c.id} label={c.name} hint="No limit set" spent={st.byCat[c.id] || 0} limit={budgets[c.id] || 0} onSave={save} />
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}
