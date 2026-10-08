import test from 'node:test';
import assert from 'node:assert/strict';
import { parseCSV, csvCell } from '../src/lib/csv.js';
import { parseDate, parseMoney, detectColumns, buildImportRows, guessPositive } from '../src/lib/importer.js';
import { dueOccurrences, nextOccurrence, dateInMonth } from '../src/lib/recurring.js';
import { parseAmount, inr, short } from '../src/lib/format.js';
import { monthStats, lastMonths, insights } from '../src/lib/stats.js';
import { parseBackup, makeBackup } from '../src/lib/backup.js';
import { guessCategory } from '../src/lib/categories.js';
import { addMonth, daysIn } from '../src/lib/dates.js';
import { makeSample } from '../src/lib/sample.js';

test('parseAmount accepts rupees and paise, rejects junk', () => {
  assert.equal(parseAmount('250'), 25000);
  assert.equal(parseAmount('₹1,250.50'), 125050);
  assert.equal(parseAmount('0'), 0);
  assert.equal(parseAmount('-5'), 0);
  assert.equal(parseAmount('12.345'), 0);
  assert.equal(parseAmount('abc'), 0);
});

test('inr and short format Indian grouping', () => {
  assert.equal(inr(12345600), '₹1,23,456');
  assert.equal(inr(25050), '₹250.50');
  assert.equal(short(12500000), '₹1.3L');
  assert.equal(short(450000), '₹4.5k');
});

test('parseCSV handles quotes, CRLF, BOM and semicolons', () => {
  const rows = parseCSV('﻿Date,Narration,Amount\r\n01/10/2026,"Swiggy, Order ""A""",250.00\r\n');
  assert.deepEqual(rows, [['Date', 'Narration', 'Amount'], ['01/10/2026', 'Swiggy, Order "A"', '250.00']]);
  assert.deepEqual(parseCSV('a;b\n1;2'), [['a', 'b'], ['1', '2']]);
});

test('csvCell neutralises formulas', () => {
  assert.equal(csvCell('=SUM(A1)'), `"'=SUM(A1)"`);
  assert.equal(csvCell('a"b'), '"a""b"');
});

test('parseDate reads common bank formats, day first', () => {
  assert.equal(parseDate('2026-10-07'), '2026-10-07');
  assert.equal(parseDate('07/10/2026'), '2026-10-07');
  assert.equal(parseDate('07-10-26'), '2026-10-07');
  assert.equal(parseDate('7 Oct 2026'), '2026-10-07');
  assert.equal(parseDate('07-Oct-2026'), '2026-10-07');
  assert.equal(parseDate('31/02/2026'), null);
  assert.equal(parseDate('hello'), null);
});

test('parseMoney handles signs, commas, brackets and Dr/Cr', () => {
  assert.equal(parseMoney('1,234.50'), 123450);
  assert.equal(parseMoney('-99'), -9900);
  assert.equal(parseMoney('(99)'), -9900);
  assert.equal(parseMoney('500.00 Dr'), -50000);
  assert.equal(parseMoney('500.00 Cr'), 50000);
  assert.equal(parseMoney('₹ 1,000'), 100000);
  assert.equal(parseMoney(''), null);
  assert.equal(parseMoney('n/a'), null);
});

test('bank statement with debit and credit columns imports correctly', () => {
  const rows = parseCSV(
    'Date,Narration,Withdrawal Amt.,Deposit Amt.,Closing Balance\n' +
      '01/10/26,UPI-SWIGGY-123,450.00,,10000\n' +
      '02/10/26,SALARY CREDIT,,52000.00,62000\n' +
      '03/10/26,bad row,,,\n' +
      'nodate,UPI,10,,\n',
  );
  const map = detectColumns(rows[0]);
  assert.deepEqual(map, { date: 0, desc: 1, debit: 2, credit: 3, amount: -1, drcr: -1 });
  const { rows: out, skipped } = buildImportRows(rows.slice(1), map);
  assert.equal(out.length, 2);
  assert.equal(skipped, 2);
  assert.deepEqual([out[0].type, out[0].amount, out[0].category], ['expense', 45000, 'food']);
  assert.deepEqual([out[1].type, out[1].amount, out[1].category], ['income', 5200000, 'salary']);
});

test('single amount column: sign and Dr/Cr flag decide the type', () => {
  const header = ['Date', 'Description', 'Amount', 'Dr/Cr'];
  const map = detectColumns(header);
  assert.equal(map.drcr, 3);
  const data = [['01/10/2026', 'Uber ride', '200', 'DR'], ['02/10/2026', 'Refund', '50', 'CR']];
  const { rows } = buildImportRows(data, map);
  assert.deepEqual(rows.map((r) => r.type), ['expense', 'income']);

  const m2 = detectColumns(['Date', 'Details', 'Amount']);
  const neg = [['01/10/2026', 'Coffee', '-120'], ['02/10/2026', 'Salary', '5000'], ['03/10/2026', 'Bus', '-30']];
  assert.equal(guessPositive(neg, m2), 'income');
  const r = buildImportRows(neg, m2, 'income').rows;
  assert.deepEqual(r.map((x) => x.type), ['expense', 'income', 'expense']);
});

test('recurring: day 31 clamps, backfills missing months, respects end date and pause', () => {
  const rule = { day: 31, startDate: '2026-01-15', endDate: null, active: true };
  assert.equal(dateInMonth(rule, '2026-02'), '2026-02-28');
  assert.equal(dateInMonth(rule, '2028-02'), '2028-02-29');
  const due = dueOccurrences(rule, new Set(['2026-02-28']), '2026-04-10');
  assert.deepEqual(due, ['2026-01-31', '2026-03-31']);
  assert.deepEqual(dueOccurrences({ ...rule, active: false }, new Set(), '2026-04-10'), []);
  const ended = { day: 5, startDate: '2026-01-01', endDate: '2026-02-20', active: true };
  assert.deepEqual(dueOccurrences(ended, new Set(), '2026-06-01'), ['2026-01-05', '2026-02-05']);
  assert.deepEqual(dueOccurrences({ day: 20, startDate: '2026-03-01', endDate: null, active: true }, new Set(), '2026-03-10'), []);
});

test('recurring: dates before generatedThrough are not created again (deleted entries stay deleted)', () => {
  const rule = { day: 5, startDate: '2026-01-01', endDate: null, active: true, generatedThrough: '2026-03-31' };
  assert.deepEqual(dueOccurrences(rule, new Set(), '2026-06-10'), ['2026-04-05', '2026-05-05', '2026-06-05']);
  assert.deepEqual(dueOccurrences({ ...rule, generatedThrough: '2026-06-10' }, new Set(), '2026-06-10'), []);
});

test('recurring: next occurrence', () => {
  const rule = { day: 8, startDate: '2026-01-01', endDate: null, active: true };
  assert.equal(nextOccurrence(rule, '2026-10-07'), '2026-10-08');
  assert.equal(nextOccurrence(rule, '2026-10-08'), '2026-11-08');
  assert.equal(nextOccurrence({ ...rule, endDate: '2026-10-01' }, '2026-10-07'), null);
  assert.equal(nextOccurrence({ ...rule, active: false }, '2026-10-07'), null);
});

test('monthStats, lastMonths and insights', () => {
  const txs = [
    { type: 'income', amount: 5000000, category: 'salary', date: '2026-10-01', note: '' },
    { type: 'expense', amount: 1200000, category: 'bills', date: '2026-10-01', note: 'Rent' },
    { type: 'expense', amount: 30000, category: 'food', date: '2026-10-02', note: '' },
    { type: 'expense', amount: 70000, category: 'food', date: '2026-09-30', note: '' },
  ];
  const st = monthStats(txs, '2026-10');
  assert.equal(st.income, 5000000);
  assert.equal(st.expense, 1230000);
  assert.equal(st.net, 3770000);
  assert.equal(st.byDay[0], 1200000);
  assert.equal(st.byDay.length, 31);
  assert.ok(Math.abs(st.rate - 0.754) < 1e-9);
  const lm = lastMonths(txs, '2026-10', 3);
  assert.deepEqual(lm.map((x) => x.month), ['2026-08', '2026-09', '2026-10']);
  assert.equal(lm[1].expense, 70000);
  const tips = insights(txs, '2026-10', { _total: 1000000, bills: 1000000 }, '2026-10-20');
  assert.ok(tips.some((t) => t.tone === 'warn' && /Rent & bills is/.test(t.text)));
  assert.ok(tips.some((t) => t.tone === 'good' && /saving 75%/.test(t.text)));
});

test('backup round trip and validation', () => {
  const data = {
    txs: [{ id: '3f2b8c9e-1a4d-4e6f-9b7a-0c1d2e3f4a5b', type: 'expense', amount: 5000, category: 'food', date: '2026-10-01', note: 'x', method: 'upi', recurringId: null }],
    budgets: { _total: 100000, food: 5000 },
    recurring: [],
  };
  const back = parseBackup(makeBackup(data));
  assert.equal(back.transactions.length, 1);
  assert.equal(back.transactions[0].id, data.txs[0].id);
  assert.deepEqual(back.budgets, data.budgets);
  assert.throws(() => parseBackup('nope'), /not valid JSON/);
  assert.throws(() => parseBackup('{"a":1}'), /not a Kharcha Book backup/);
  const dirty = JSON.stringify({ app: 'kharcha-book', transactions: [{ type: 'expense', amount: -1, date: '2026-10-01' }, { type: 'expense', amount: 10, date: '2026-13-40' }, { type: 'income', amount: 10, date: '2026-10-01', category: 'zzz' }] });
  const b2 = parseBackup(dirty);
  assert.equal(b2.transactions.length, 1);
  assert.equal(b2.transactions[0].category, 'other_in');
});

test('backup keeps the link between recurring rules and the entries they made', () => {
  const rule = { id: 'r1', type: 'expense', amount: 100000, category: 'bills', note: 'Rent', method: 'bank', day: 1, startDate: '2026-01-01', endDate: null, active: true };
  const tx = { id: 's1', type: 'expense', amount: 100000, category: 'bills', date: '2026-02-01', note: 'Rent', method: 'bank', recurringId: 'r1' };
  const back = parseBackup(makeBackup({ txs: [tx], budgets: {}, recurring: [rule] }));
  assert.match(back.recurring[0].id, /^[0-9a-f-]{36}$/);
  assert.equal(back.transactions[0].recurringId, back.recurring[0].id);
  const orphan = parseBackup(makeBackup({ txs: [{ ...tx, recurringId: 'gone' }], budgets: {}, recurring: [] }));
  assert.equal(orphan.transactions[0].recurringId, null);
});

test('guessCategory', () => {
  assert.equal(guessCategory('UPI-ZOMATO-9912'), 'food');
  assert.equal(guessCategory('Blinkit order'), 'groc');
  assert.equal(guessCategory('IRCTC ticket'), 'move');
  assert.equal(guessCategory('Monthly salary', 'income'), 'salary');
  assert.equal(guessCategory('???'), 'other');
});

test('dates: month arithmetic', () => {
  assert.equal(addMonth('2026-01', -1), '2025-12');
  assert.equal(addMonth('2026-11', 3), '2027-02');
  assert.equal(daysIn('2028-02'), 29);
});

test('sample data is internally consistent', () => {
  const s = makeSample();
  assert.ok(s.transactions.length > 200);
  assert.ok(s.transactions.every((t) => Number.isInteger(t.amount) && t.amount > 0));
  assert.equal(s.recurring.length, 4);
});
