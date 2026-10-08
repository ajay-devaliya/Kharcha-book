import { CAT, METHOD, fallbackCat } from './categories.js';
import { isDate } from './dates.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isUuid = (s) => typeof s === 'string' && UUID.test(s);

export function makeBackup({ txs, budgets, recurring }) {
  return JSON.stringify(
    { app: 'kharcha-book', version: 1, exportedAt: new Date().toISOString(), transactions: txs, budgets, recurring },
    null,
    2,
  );
}

const money = (n) => Number.isInteger(n) && n > 0 && n <= 1e10;

/** Read and check a backup file. Throws an Error with a plain message when something is wrong. */
export function parseBackup(text) {
  let o;
  try {
    o = JSON.parse(text);
  } catch {
    throw new Error('This file is not valid JSON.');
  }
  if (!o || o.app !== 'kharcha-book' || !Array.isArray(o.transactions)) throw new Error('This is not a Kharcha Book backup file.');

  // Recurring rules first. Every rule gets a real UUID, and entries that pointed at the old id are re-pointed,
  // otherwise the app would think those entries were never created and add them a second time.
  const recurring = [];
  const idMap = new Map();
  for (const r of Array.isArray(o.recurring) ? o.recurring : []) {
    if (!r || !['expense', 'income'].includes(r.type) || !money(r.amount) || !isDate(r.startDate)) continue;
    const day = Number(r.day);
    if (!Number.isInteger(day) || day < 1 || day > 31) continue;
    const id = isUuid(r.id) ? r.id : globalThis.crypto.randomUUID();
    if (r.id) idMap.set(r.id, id);
    recurring.push({
      id,
      type: r.type,
      amount: r.amount,
      category: CAT[r.category] ? r.category : fallbackCat(r.type),
      note: String(r.note || '').slice(0, 120),
      method: METHOD[r.method] ? r.method : '',
      day,
      startDate: r.startDate,
      endDate: isDate(r.endDate) ? r.endDate : null,
      active: r.active !== false,
      generatedThrough: isDate(r.generatedThrough) ? r.generatedThrough : null,
    });
  }

  const transactions = [];
  for (const t of o.transactions) {
    if (!t || !['expense', 'income'].includes(t.type) || !money(t.amount) || !isDate(t.date)) continue;
    transactions.push({
      id: isUuid(t.id) ? t.id : undefined,
      type: t.type,
      amount: t.amount,
      category: CAT[t.category] ? t.category : fallbackCat(t.type),
      date: t.date,
      note: String(t.note || '').slice(0, 120),
      method: METHOD[t.method] ? t.method : '',
      recurringId: idMap.get(t.recurringId) || null,
    });
  }

  const budgets = {};
  if (o.budgets && typeof o.budgets === 'object') {
    for (const [k, v] of Object.entries(o.budgets)) if ((k === '_total' || CAT[k]) && money(v)) budgets[k] = v;
  }
  return { transactions, budgets, recurring };
}
