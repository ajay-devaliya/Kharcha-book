import { useEffect, useRef, useState } from 'react';
import { Seg, Sheet, useToast } from './ui.jsx';
import { useData } from '../data/store.jsx';
import { METHODS, catsFor, guessCategory } from '../lib/categories.js';
import { isDate, monthOf, todayStr } from '../lib/dates.js';
import { inr, parseAmount } from '../lib/format.js';

const blank = () => ({ type: 'expense', amount: '', category: 'food', date: todayStr(), method: 'upi', note: '' });

/** Add a new entry, or edit an existing one when `editing` is set. */
export default function AddSheet({ open, editing, onClose }) {
  const { addTx, updateTx, setMonth } = useData();
  const toast = useToast();
  const [f, setF] = useState(blank);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const touched = useRef(false);
  const amountRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    touched.current = !!editing;
    setErr('');
    setF(
      editing
        ? { type: editing.type, amount: String(editing.amount / 100), category: editing.category, date: editing.date, method: editing.method || 'upi', note: editing.note || '' }
        : blank(),
    );
  }, [open, editing]);

  const set = (patch) => setF((p) => ({ ...p, ...patch }));
  const setType = (type) => set({ type, category: catsFor(type)[0].id });
  const onNote = (note) => {
    const next = { note };
    if (!touched.current) {
      const g = guessCategory(note, f.type);
      if (g !== catsFor(f.type).slice(-1)[0].id) next.category = g;
    }
    set(next);
  };

  async function save(another) {
    const amount = parseAmount(f.amount);
    if (!amount) return setErr('Enter an amount above zero, like 250 or 249.50.');
    if (!isDate(f.date) || f.date > todayStr()) return setErr('Pick a date that is today or earlier.');
    setErr('');
    setBusy(true);
    const rec = { type: f.type, amount, category: f.category, date: f.date, method: f.method, note: f.note.trim().slice(0, 120), recurringId: editing ? editing.recurringId || null : null };
    const res = editing ? await updateTx(editing.id, rec) : await addTx(rec);
    setBusy(false);
    if (!res.ok) return setErr(res.error);
    setMonth(monthOf(f.date));
    toast(`${editing ? 'Saved' : 'Added'} ${inr(amount)} · ${f.type === 'income' ? 'income' : 'expense'}`);
    if (another) {
      set({ amount: '', note: '' });
      touched.current = false;
      setTimeout(() => amountRef.current && amountRef.current.focus(), 0);
    } else onClose();
  }

  const cats = catsFor(f.type);
  return (
    <Sheet open={open} onClose={onClose} title={editing ? 'Edit entry' : 'Add an entry'}>
      <form
        className="form"
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          save(false);
        }}
      >
        <Seg label="Entry type" value={f.type} onChange={setType} options={[{ value: 'expense', label: 'Expense' }, { value: 'income', label: 'Income' }]} />
        <div className="field">
          <label htmlFor="amount">Amount</label>
          <div className="amount">
            <span aria-hidden="true">₹</span>
            <input id="amount" ref={amountRef} inputMode="decimal" autoComplete="off" placeholder="0" value={f.amount} onChange={(e) => set({ amount: e.target.value })} data-autofocus />
          </div>
        </div>
        <div className="field">
          <span className="lbl" id="cat-lbl">Category</span>
          <div className="chips" role="radiogroup" aria-labelledby="cat-lbl">
            {cats.map((c) => (
              <label key={c.id} className={'chipsel' + (f.category === c.id ? ' on' : '')}>
                <input type="radio" name="cat" value={c.id} checked={f.category === c.id} onChange={() => { touched.current = true; set({ category: c.id }); }} />
                <i className="dot" style={{ background: `var(--c-${c.id})` }} />
                {c.name}
              </label>
            ))}
          </div>
        </div>
        <div className="two">
          <div className="field">
            <label htmlFor="date">Date</label>
            <input id="date" className="input" type="date" max={todayStr()} value={f.date} onChange={(e) => set({ date: e.target.value })} />
          </div>
          <div className="field">
            <label htmlFor="method">{f.type === 'income' ? 'Received by' : 'Paid with'}</label>
            <select id="method" className="input" value={f.method} onChange={(e) => set({ method: e.target.value })}>
              {METHODS.map((m) => (
                <option key={m.id} value={m.id}>{m.name}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="field">
          <label htmlFor="note">Note <span className="opt">(optional)</span></label>
          <input id="note" className="input" maxLength={120} autoComplete="off" placeholder={f.type === 'income' ? 'October salary, client invoice' : 'Swiggy dinner, auto fare, electricity bill'} value={f.note} onChange={(e) => onNote(e.target.value)} />
        </div>
        <div className="errtxt" role="alert">{err}</div>
        <div className="actions">
          <button className="btn" type="submit" disabled={busy}>{editing ? 'Save changes' : 'Save'}</button>
          {!editing && (
            <button className="btn ghost" type="button" disabled={busy} onClick={() => save(true)}>Save and add another</button>
          )}
        </div>
      </form>
    </Sheet>
  );
}
