import { guessCategory } from './categories.js';
import { isDate, pad } from './dates.js';

const HEAD = {
  date: /^(txn\.?\s*date|transaction\s*date|value\s*date|posting\s*date|posted|date)/i,
  debit: /(debit|withdrawal|withdrawl|paid\s*out|amount\s*out|\bdr\b\.?$)/i,
  credit: /(credit|deposit|paid\s*in|amount\s*in|\bcr\b\.?$)/i,
  drcr: /^(dr\s*\/\s*cr|cr\s*\/\s*dr|txn\s*type|transaction\s*type|type)$/i,
  amount: /^(amount|amt|transaction\s*amount|value)$/i,
  desc: /(narration|description|particulars|details|remarks|payee|merchant|note|memo)/i,
};
// drcr is checked before debit and credit so a "Dr/Cr" header is not read as a credit column.
const KEYS = ['date', 'drcr', 'debit', 'credit', 'amount', 'desc'];

/** Guess which column is which from the header row. -1 means not found. */
export function detectColumns(header) {
  const map = { date: -1, desc: -1, debit: -1, credit: -1, amount: -1, drcr: -1 };
  header.forEach((h, i) => {
    const t = String(h).trim();
    for (const k of KEYS) {
      if (map[k] === -1 && HEAD[k].test(t)) {
        map[k] = i;
        break;
      }
    }
  });
  return map;
}

const MONTHS = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 };

/** Accepts 2026-10-07, 07/10/2026, 07-10-26, 7 Oct 2026, 07-Oct-2026. Day comes before month for numeric dates. */
export function parseDate(s) {
  const t = String(s ?? '').trim();
  let y, m, d, mm;
  if ((mm = t.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/))) [y, m, d] = [+mm[1], +mm[2], +mm[3]];
  else if ((mm = t.match(/^(\d{1,2})[/\-. ](\d{1,2})[/\-. ](\d{2,4})/))) [d, m, y] = [+mm[1], +mm[2], +mm[3]];
  else if ((mm = t.match(/^(\d{1,2})[/\-. ]([A-Za-z]{3})[A-Za-z]*[/\-.,\s]+(\d{2,4})/))) [d, m, y] = [+mm[1], MONTHS[mm[2].toLowerCase()], +mm[3]];
  else return null;
  if (!m) return null;
  if (y < 100) y += 2000;
  const out = `${y}-${pad(m)}-${pad(d)}`;
  return isDate(out) ? out : null;
}

/** Signed paise, or null. Understands commas, rupee signs, (brackets) and Dr/Cr suffixes. */
export function parseMoney(s) {
  if (s == null) return null;
  let t = String(s).trim();
  if (!t) return null;
  let neg = false;
  if (/^\(.*\)$/.test(t)) {
    neg = true;
    t = t.slice(1, -1);
  }
  if (/dr\.?$/i.test(t)) {
    neg = true;
    t = t.replace(/dr\.?$/i, '');
  } else if (/cr\.?$/i.test(t)) t = t.replace(/cr\.?$/i, '');
  t = t.replace(/(₹|rs\.?|inr)/gi, '').replace(/[,\s]/g, '');
  if (t.startsWith('-')) {
    neg = true;
    t = t.slice(1);
  } else if (t.startsWith('+')) t = t.slice(1);
  if (!/^\d+(\.\d+)?$/.test(t)) return null;
  const p = Math.round(parseFloat(t) * 100);
  return neg ? -p : p;
}

/** Whether positive numbers in a single amount column mean 'expense' or 'income'. */
export function guessPositive(rows, map) {
  if (map.amount < 0) return 'expense';
  let neg = 0;
  let all = 0;
  for (const r of rows) {
    const v = parseMoney(r[map.amount]);
    if (!v) continue;
    all++;
    if (v < 0) neg++;
  }
  return all && neg / all >= 0.3 ? 'income' : 'expense';
}

export const txKey = (t) => `${t.date}|${t.amount}|${t.type}|${String(t.note || '').trim().toLowerCase()}`;

/**
 * Turn data rows into transactions. `positive` says what a positive number means in a single amount column.
 * Returns { rows, skipped } where skipped counts rows with no usable date or amount.
 */
export function buildImportRows(dataRows, map, positive = 'expense') {
  const rows = [];
  let skipped = 0;
  const cell = (r, i) => (i >= 0 ? String(r[i] ?? '') : '');
  dataRows.forEach((r, idx) => {
    const date = parseDate(cell(r, map.date));
    if (!date) {
      skipped++;
      return;
    }
    const note = cell(r, map.desc).trim().replace(/\s+/g, ' ').slice(0, 120);
    let amount = 0;
    let type = 'expense';
    if (map.debit >= 0 || map.credit >= 0) {
      const d = parseMoney(cell(r, map.debit));
      const c = parseMoney(cell(r, map.credit));
      if (d && Math.abs(d) > 0) {
        amount = Math.abs(d);
        type = 'expense';
      } else if (c && Math.abs(c) > 0) {
        amount = Math.abs(c);
        type = 'income';
      }
    } else if (map.amount >= 0) {
      const a = parseMoney(cell(r, map.amount));
      if (a) {
        amount = Math.abs(a);
        const flag = map.drcr >= 0 ? cell(r, map.drcr).trim().toLowerCase() : '';
        if (/^(dr|debit|d\b|withdraw)/.test(flag)) type = 'expense';
        else if (/^(cr|credit|c\b|deposit)/.test(flag)) type = 'income';
        else if (positive === 'expense') type = a > 0 ? 'expense' : 'income';
        else type = a > 0 ? 'income' : 'expense';
      }
    }
    if (!amount || amount > 1e10) {
      skipped++;
      return;
    }
    rows.push({ line: idx, date, note, amount, type, category: guessCategory(note, type), method: 'bank' });
  });
  return { rows, skipped };
}
