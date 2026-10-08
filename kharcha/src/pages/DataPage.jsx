import { useMemo, useRef, useState } from 'react';
import { Icon, Seg, useToast } from '../components/ui.jsx';
import { useData } from '../data/store.jsx';
import { supabase } from '../data/supabaseStore.js';
import { CAT, EXPENSE_CATS, INCOME_CATS, METHOD, catName } from '../lib/categories.js';
import { csvCell, parseCSV } from '../lib/csv.js';
import { download } from '../lib/download.js';
import { makeBackup, parseBackup } from '../lib/backup.js';
import { buildImportRows, detectColumns, guessPositive, txKey } from '../lib/importer.js';
import { fmtShort, todayStr } from '../lib/dates.js';
import { inr } from '../lib/format.js';
import { getTheme, setTheme } from '../lib/theme.js';

const MAX_FILE = 5 * 1024 * 1024;

function readFile(file) {
  return new Promise((resolve, reject) => {
    if (file.size > MAX_FILE) return reject(new Error('That file is larger than 5 MB.'));
    const fr = new FileReader();
    fr.onload = () => resolve(String(fr.result));
    fr.onerror = () => reject(new Error('Could not read that file.'));
    fr.readAsText(file);
  });
}

/* ---------- bank statement import ---------- */
const FIELDS = [
  ['date', 'Date'],
  ['desc', 'Description'],
  ['amount', 'Amount (one column)'],
  ['debit', 'Debit / withdrawal'],
  ['credit', 'Credit / deposit'],
  ['drcr', 'Dr/Cr flag'],
];

function ImportWizard() {
  const { txs, addTxs } = useData();
  const toast = useToast();
  const [file, setFile] = useState(null);
  const [map, setMap] = useState(null);
  const [positive, setPositive] = useState('expense');
  const [off, setOff] = useState({});
  const [cats, setCats] = useState({});
  const [busy, setBusy] = useState(false);
  const input = useRef(null);

  const existing = useMemo(() => new Set(txs.map(txKey)), [txs]);
  const built = useMemo(() => (file && map ? buildImportRows(file.rows.slice(1), map, positive) : null), [file, map, positive]);
  const rows = useMemo(() => (built ? built.rows.map((r) => ({ ...r, dup: existing.has(txKey(r)) })) : []), [built, existing]);
  const on = (r) => (off[r.line] === undefined ? !r.dup : !off[r.line]);
  const chosen = rows.filter(on);

  async function pick(e) {
    const f = e.target.files && e.target.files[0];
    e.target.value = '';
    if (!f) return;
    try {
      const rws = parseCSV(await readFile(f));
      if (rws.length < 2) throw new Error('That file has no data rows.');
      const m = detectColumns(rws[0]);
      setFile({ name: f.name, rows: rws });
      setMap(m);
      setPositive(guessPositive(rws.slice(1), m));
      setOff({});
      setCats({});
    } catch (ex) {
      toast(ex.message, 'bad');
    }
  }
  const reset = () => {
    setFile(null);
    setMap(null);
    setOff({});
    setCats({});
  };

  async function run() {
    setBusy(true);
    const list = chosen.map((r) => ({ type: r.type, amount: r.amount, category: cats[r.line] || r.category, date: r.date, note: r.note, method: 'bank', recurringId: null }));
    const res = await addTxs(list);
    setBusy(false);
    if (!res.ok) return toast(res.error, 'bad');
    toast(`Imported ${res.value} ${res.value === 1 ? 'entry' : 'entries'}`);
    reset();
  }

  const header = file ? file.rows[0] : [];
  const needsFix = map && (map.date < 0 || (map.amount < 0 && map.debit < 0 && map.credit < 0));
  const single = map && map.amount >= 0 && map.debit < 0 && map.credit < 0;
  const dups = rows.filter((r) => r.dup).length;

  return (
    <div>
      <input ref={input} type="file" accept=".csv,.txt,text/csv" hidden onChange={pick} />
      {!file ? (
        <>
          <p className="muted">Download your statement as CSV from net banking or your UPI app, then choose it here. You review everything before anything is saved.</p>
          <button type="button" className="btn ghost" onClick={() => input.current.click()}><Icon name="upload" size={16} /> Choose a CSV file</button>
        </>
      ) : (
        <div className="import">
          <div className="import-h">
            <b>{file.name}</b>
            <button type="button" className="link" onClick={reset}>Choose a different file</button>
          </div>

          <details open={needsFix}>
            <summary>Check the columns {needsFix && <span className="badtxt">(needs your input)</span>}</summary>
            <div className="mapgrid">
              {FIELDS.map(([k, label]) => (
                <div className="field" key={k}>
                  <label htmlFor={'map-' + k}>{label}</label>
                  <select id={'map-' + k} className="input" value={map[k]} onChange={(e) => setMap({ ...map, [k]: Number(e.target.value) })}>
                    <option value={-1}>None</option>
                    {header.map((h, i) => <option key={i} value={i}>{h || `Column ${i + 1}`}</option>)}
                  </select>
                </div>
              ))}
            </div>
            {single && map.drcr < 0 && (
              <div className="field narrow">
                <span className="lbl">Positive amounts are</span>
                <Seg label="Positive amounts are" value={positive} onChange={setPositive} options={[{ value: 'expense', label: 'Money spent' }, { value: 'income', label: 'Money received' }]} />
              </div>
            )}
          </details>

          {needsFix ? (
            <p className="note warn">Pick a Date column and either an Amount column or Debit and Credit columns to see a preview.</p>
          ) : (
            <>
              <p className="lsum">
                {rows.length} usable {rows.length === 1 ? 'row' : 'rows'}
                {built.skipped > 0 && <> · {built.skipped} skipped (no date or amount)</>}
                {dups > 0 && <> · {dups} look like entries you already have and are unticked</>}
              </p>
              <div className="tablewrap">
                <table className="imptable">
                  <thead>
                    <tr><th><span className="sr">Include</span></th><th>Date</th><th>Description</th><th>Category</th><th className="r">Amount</th></tr>
                  </thead>
                  <tbody>
                    {rows.slice(0, 200).map((r) => (
                      <tr key={r.line} className={on(r) ? '' : 'off'}>
                        <td><input type="checkbox" aria-label={`Include ${r.note || 'row'} on ${fmtShort(r.date)}`} checked={on(r)} onChange={(e) => setOff({ ...off, [r.line]: !e.target.checked })} /></td>
                        <td className="mono nowrap">{fmtShort(r.date)}</td>
                        <td>{r.note || <span className="muted">No description</span>}{r.dup && <span className="tag">Already added</span>}</td>
                        <td>
                          <select className="input sm" aria-label="Category" value={cats[r.line] || r.category} onChange={(e) => setCats({ ...cats, [r.line]: e.target.value })}>
                            {(r.type === 'income' ? INCOME_CATS : EXPENSE_CATS).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                          </select>
                        </td>
                        <td className={'r mono nowrap tx-amt ' + r.type}>{r.type === 'income' ? '+' : ''}{inr(r.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {rows.length > 200 && <p className="muted small">Showing the first 200 of {rows.length}. Every ticked row is imported.</p>}
              <div className="actions">
                <button type="button" className="btn" disabled={busy || chosen.length === 0} onClick={run}>Import {chosen.length} {chosen.length === 1 ? 'entry' : 'entries'}</button>
                <button type="button" className="btn ghost" onClick={reset}>Cancel</button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

/* ---------- page ---------- */
export default function DataPage() {
  const { txs, budgets, recurring, restore, clearAll, mode, session } = useData();
  const toast = useToast();
  const [theme, setT] = useState(getTheme());
  const [pending, setPending] = useState(null);
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const restoreInput = useRef(null);

  function exportCsv() {
    if (!txs.length) return toast('There is nothing to export yet.', 'bad');
    const lines = ['Date,Type,Category,Note,Paid with,Amount (INR)'];
    [...txs]
      .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))
      .forEach((t) => lines.push([t.date, t.type, csvCell(catName(t.category)), csvCell(t.note), csvCell(METHOD[t.method] || ''), (t.amount / 100).toFixed(2)].join(',')));
    download(`kharcha-${todayStr()}.csv`, '﻿' + lines.join('\r\n'), 'text/csv');
  }
  const exportJson = () => download(`kharcha-backup-${todayStr()}.json`, makeBackup({ txs, budgets, recurring }), 'application/json');

  async function chooseBackup(e) {
    const f = e.target.files && e.target.files[0];
    e.target.value = '';
    if (!f) return;
    try {
      const data = parseBackup(await readFile(f));
      setPending({ name: f.name, data });
    } catch (ex) {
      toast(ex.message, 'bad');
    }
  }
  async function doRestore() {
    setBusy(true);
    const r = await restore(pending.data);
    setBusy(false);
    setPending(null);
    toast(r.ok ? 'Backup restored' : r.error, r.ok ? 'ok' : 'bad');
  }
  async function doClear() {
    setBusy(true);
    const r = await clearAll();
    setBusy(false);
    setConfirm('');
    toast(r.ok ? 'All your data was deleted' : r.error, r.ok ? 'ok' : 'bad');
  }

  return (
    <div className="page">
      <header className="page-h"><h1>Data &amp; account</h1></header>

      <div className="stack">
        <section className="card">
          <div className="card-h"><h2>Import a bank or UPI statement</h2></div>
          <ImportWizard />
        </section>

        <section className="card">
          <div className="card-h"><h2>Export and backup</h2></div>
          <p className="muted">{txs.length} {txs.length === 1 ? 'entry' : 'entries'}, {Object.keys(budgets).length} budgets, {recurring.length} recurring.</p>
          <div className="actions inline">
            <button type="button" className="btn ghost" onClick={exportCsv}><Icon name="download" size={16} /> Export entries (CSV)</button>
            <button type="button" className="btn ghost" onClick={exportJson}><Icon name="download" size={16} /> Full backup (JSON)</button>
            <button type="button" className="btn ghost" onClick={() => restoreInput.current.click()}><Icon name="upload" size={16} /> Restore from backup</button>
            <input ref={restoreInput} type="file" accept=".json,application/json" hidden onChange={chooseBackup} />
          </div>
          {pending && (
            <div className="note warn">
              <p>
                <b>{pending.name}</b> has {pending.data.transactions.length} entries, {Object.keys(pending.data.budgets).length} budgets and {pending.data.recurring.length} recurring entries.
                Restoring <b>replaces everything</b> you have now.
              </p>
              <div className="actions inline">
                <button type="button" className="btn-danger" disabled={busy} onClick={doRestore}>Replace my data</button>
                <button type="button" className="btn ghost sm" onClick={() => setPending(null)}>Cancel</button>
              </div>
            </div>
          )}
        </section>

        <section className="card">
          <div className="card-h"><h2>Appearance</h2></div>
          <Seg label="Theme" value={theme} onChange={(t) => { setTheme(t); setT(t); }} options={[{ value: 'system', label: 'Match device' }, { value: 'light', label: 'Light' }, { value: 'dark', label: 'Dark' }]} />
        </section>

        <section className="card">
          <div className="card-h"><h2>Account</h2></div>
          {mode === 'cloud' ? (
            <>
              <p className="muted">Signed in as <b>{session.user.email}</b>. Your entries are stored in the app's database and only your login can read them.</p>
              <button type="button" className="btn ghost" onClick={() => supabase.auth.signOut()}><Icon name="out" size={16} /> Sign out</button>
            </>
          ) : (
            <p className="muted">Local mode: your entries are saved in this browser only, with no login. To sync across devices, connect a Supabase project as described in the README.</p>
          )}
        </section>

        <section className="card danger">
          <div className="card-h"><h2>Delete everything</h2></div>
          <p className="muted">Removes every entry, budget and recurring rule{mode === 'cloud' ? ' from the database' : ' from this browser'}. This cannot be undone. Export a backup first if you might want it back.</p>
          <div className="field narrow">
            <label htmlFor="del">Type DELETE to confirm</label>
            <input id="del" className="input" autoComplete="off" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
          </div>
          <button type="button" className="btn-danger" disabled={confirm !== 'DELETE' || busy} onClick={doClear}>Delete all my data</button>
        </section>
      </div>
    </div>
  );
}
