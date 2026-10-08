import { useEffect, useMemo, useState } from 'react';
import { Chip, Dot, Empty, Icon, Seg, Sheet, useToast } from '../components/ui.jsx';
import { useData } from '../data/store.jsx';
import { METHODS, catName, catsFor } from '../lib/categories.js';
import { diffDays, fmtShort, isDate, todayStr } from '../lib/dates.js';
import { inr, parseAmount } from '../lib/format.js';
import { nextOccurrence } from '../lib/recurring.js';

const blank = () => ({ type: 'expense', amount: '', category: 'bills', note: '', method: 'upi', day: '1', startDate: todayStr(), endDate: '', active: true });

function RuleSheet({ open, editing, onClose }) {
  const { saveRecurring } = useData();
  const toast = useToast();
  const [f, setF] = useState(blank);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!open) return;
    setErr('');
    setF(editing ? { type: editing.type, amount: String(editing.amount / 100), category: editing.category, note: editing.note, method: editing.method || 'upi', day: String(editing.day), startDate: editing.startDate, endDate: editing.endDate || '', active: editing.active } : blank());
  }, [open, editing]);
  const set = (patch) => setF((p) => ({ ...p, ...patch }));

  async function submit(e) {
    e.preventDefault();
    const amount = parseAmount(f.amount);
    const day = Number(f.day);
    if (!f.note.trim()) return setErr('Give it a name, like Rent or Netflix.');
    if (!amount) return setErr('Enter an amount above zero.');
    if (!Number.isInteger(day) || day < 1 || day > 31) return setErr('Day of month must be between 1 and 31.');
    if (!isDate(f.startDate)) return setErr('Pick a start date.');
    if (f.endDate && (!isDate(f.endDate) || f.endDate < f.startDate)) return setErr('The end date must be on or after the start date.');
    setErr('');
    setBusy(true);
    // Changing the start date or day re-checks from the start. Otherwise keep the marker so deleted entries stay deleted.
    const keep = editing && editing.startDate === f.startDate && editing.day === day && (editing.active || !f.active);
    const r = await saveRecurring({ id: editing ? editing.id : undefined, type: f.type, amount, category: f.category, note: f.note.trim().slice(0, 120), method: f.method, day, startDate: f.startDate, endDate: f.endDate || null, active: f.active, generatedThrough: keep ? editing.generatedThrough || null : editing && !editing.active && f.active ? todayStr() : null });
    setBusy(false);
    if (!r.ok) return setErr(r.error);
    toast(r.value > 0 ? `Saved. ${r.value} past ${r.value === 1 ? 'entry was' : 'entries were'} added to your transactions.` : 'Saved');
    onClose();
  }

  return (
    <Sheet open={open} onClose={onClose} title={editing ? 'Edit recurring entry' : 'New recurring entry'}>
      <form className="form" noValidate onSubmit={submit}>
        <Seg label="Entry type" value={f.type} onChange={(type) => set({ type, category: catsFor(type)[0].id })} options={[{ value: 'expense', label: 'Expense' }, { value: 'income', label: 'Income' }]} />
        <div className="two">
          <div className="field">
            <label htmlFor="r-note">Name</label>
            <input id="r-note" className="input" maxLength={120} placeholder="Rent, Netflix, Salary" value={f.note} onChange={(e) => set({ note: e.target.value })} data-autofocus />
          </div>
          <div className="field">
            <label htmlFor="r-amt">Amount (₹)</label>
            <input id="r-amt" className="input" inputMode="decimal" autoComplete="off" placeholder="0" value={f.amount} onChange={(e) => set({ amount: e.target.value })} />
          </div>
        </div>
        <div className="two">
          <div className="field">
            <label htmlFor="r-cat">Category</label>
            <select id="r-cat" className="input" value={f.category} onChange={(e) => set({ category: e.target.value })}>
              {catsFor(f.type).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div className="field">
            <label htmlFor="r-method">{f.type === 'income' ? 'Received by' : 'Paid with'}</label>
            <select id="r-method" className="input" value={f.method} onChange={(e) => set({ method: e.target.value })}>
              {METHODS.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
          </div>
        </div>
        <div className="field narrow">
          <label htmlFor="r-day">Day of the month</label>
          <input id="r-day" className="input" type="number" min="1" max="31" value={f.day} onChange={(e) => set({ day: e.target.value })} />
          <span className="muted small">Day 31 uses the last day of shorter months.</span>
        </div>
        <div className="two">
          <div className="field">
            <label htmlFor="r-start">Starts</label>
            <input id="r-start" className="input" type="date" value={f.startDate} onChange={(e) => set({ startDate: e.target.value })} />
          </div>
          <div className="field">
            <label htmlFor="r-end">Ends <span className="opt">(optional)</span></label>
            <input id="r-end" className="input" type="date" value={f.endDate} onChange={(e) => set({ endDate: e.target.value })} />
          </div>
        </div>
        <p className="muted small">Entries are added on their due date, and any past dates since the start date are filled in right away.</p>
        <label className="check"><input type="checkbox" checked={f.active} onChange={(e) => set({ active: e.target.checked })} /> Active</label>
        <div className="errtxt" role="alert">{err}</div>
        <div className="actions">
          <button className="btn" type="submit" disabled={busy}>Save</button>
          <button className="btn ghost" type="button" onClick={onClose}>Cancel</button>
        </div>
      </form>
    </Sheet>
  );
}

function RuleRow({ r, onEdit }) {
  const { saveRecurring, deleteRecurring } = useData();
  const toast = useToast();
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    if (!armed) return undefined;
    const id = setTimeout(() => setArmed(false), 3500);
    return () => clearTimeout(id);
  }, [armed]);
  const today = todayStr();
  const ended = r.endDate && r.endDate < today;
  const next = nextOccurrence(r, today);

  return (
    <li className="rule">
      <div className="rule-main">
        <div className="tx-note">{r.note || catName(r.category)}</div>
        <div className="tx-meta">
          <Dot id={r.category} size={8} />
          {catName(r.category)} · day {r.day} of every month
          {next && <> · next {fmtShort(next)} (in {diffDays(today, next)} {diffDays(today, next) === 1 ? 'day' : 'days'})</>}
        </div>
      </div>
      <span className={'tx-amt ' + r.type}>{r.type === 'income' ? '+' : ''}{inr(r.amount)}</span>
      {ended ? <Chip tone="info">Ended</Chip> : r.active ? <Chip tone="ok" icon="check">Active</Chip> : <Chip tone="warn" icon="pause">Paused</Chip>}
      <div className="tx-acts">
        <button type="button" className="icon-btn sm" onClick={() => onEdit(r)} aria-label={`Edit ${r.note}`}><Icon name="edit" size={15} /></button>
        {!ended && (
          <button type="button" className="icon-btn sm" aria-label={r.active ? `Pause ${r.note}` : `Resume ${r.note}`} onClick={async () => { const x = await saveRecurring({ ...r, active: !r.active, generatedThrough: r.active ? r.generatedThrough : todayStr() }); toast(x.ok ? (r.active ? 'Paused' : 'Resumed') : x.error, x.ok ? 'ok' : 'bad'); }}>
            <Icon name={r.active ? 'pause' : 'play'} size={15} />
          </button>
        )}
        {armed ? (
          <button type="button" className="btn-danger sm" onClick={async () => { const x = await deleteRecurring(r.id); toast(x.ok ? 'Recurring entry deleted. Entries it already created are kept.' : x.error, x.ok ? 'ok' : 'bad'); }}>Confirm delete</button>
        ) : (
          <button type="button" className="icon-btn sm" aria-label={`Delete ${r.note}`} onClick={() => setArmed(true)}><Icon name="trash" size={15} /></button>
        )}
      </div>
    </li>
  );
}

export default function Recurring() {
  const { recurring, ready } = useData();
  const [sheet, setSheet] = useState({ open: false, editing: null });
  const today = todayStr();
  const live = useMemo(() => recurring.filter((r) => r.active && !(r.endDate && r.endDate < today)), [recurring, today]);
  const out = live.filter((r) => r.type === 'expense').reduce((a, r) => a + r.amount, 0);
  const inc = live.filter((r) => r.type === 'income').reduce((a, r) => a + r.amount, 0);
  const sorted = useMemo(() => [...recurring].sort((a, b) => a.day - b.day), [recurring]);

  if (!ready) return <div className="page"><p className="muted">Loading…</p></div>;
  return (
    <div className="page">
      <header className="page-h">
        <h1>Recurring</h1>
        <div className="page-actions"><button type="button" className="btn" onClick={() => setSheet({ open: true, editing: null })}><Icon name="plus" size={16} /> New recurring entry</button></div>
      </header>
      <p className="lede">Rent, salary, subscriptions and EMIs. They are added to your transactions on the due date, the next time you open the app.</p>

      {recurring.length > 0 && (
        <section className="kpis two-up">
          <div className="kpi"><div className="k">Fixed monthly spending</div><div className="v">{inr(out)}</div><div className="s">{live.filter((r) => r.type === 'expense').length} active</div></div>
          <div className="kpi"><div className="k">Expected monthly income</div><div className="v income">{inr(inc)}</div><div className="s">{live.filter((r) => r.type === 'income').length} active</div></div>
        </section>
      )}

      <section className="card">
        {sorted.length === 0 ? (
          <Empty title="No recurring entries yet" action={<button className="btn" type="button" onClick={() => setSheet({ open: true, editing: null })}>Add your first</button>}>
            Set up your salary and rent once and they appear in your transactions every month without any typing.
          </Empty>
        ) : (
          <ul className="rows">{sorted.map((r) => <RuleRow key={r.id} r={r} onEdit={(x) => setSheet({ open: true, editing: x })} />)}</ul>
        )}
      </section>
      <RuleSheet open={sheet.open} editing={sheet.editing} onClose={() => setSheet({ open: false, editing: null })} />
    </div>
  );
}
