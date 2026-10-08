import { addMonth, daysIn, dayOf, monthOf } from './dates.js';
import { catName } from './categories.js';
import { inr, pct } from './format.js';

export function monthStats(txs, month) {
  const byCat = {};
  const incByCat = {};
  const byDay = new Array(daysIn(month)).fill(0);
  let income = 0;
  let expense = 0;
  let count = 0;
  let biggest = null;
  for (const t of txs) {
    if (monthOf(t.date) !== month) continue;
    count++;
    if (t.type === 'income') {
      income += t.amount;
      incByCat[t.category] = (incByCat[t.category] || 0) + t.amount;
    } else {
      expense += t.amount;
      byCat[t.category] = (byCat[t.category] || 0) + t.amount;
      byDay[dayOf(t.date) - 1] += t.amount;
      if (!biggest || t.amount > biggest.amount) biggest = t;
    }
  }
  const net = income - expense;
  return { income, expense, net, rate: income > 0 ? net / income : null, byCat, incByCat, byDay, count, biggest };
}

/** Sum of one type in a month, counting only days up to `upToDay`. */
export function sumUpTo(txs, month, type, upToDay) {
  let s = 0;
  for (const t of txs) if (t.type === type && monthOf(t.date) === month && dayOf(t.date) <= upToDay) s += t.amount;
  return s;
}

/** Income and spending for the `n` months ending at `month`. */
export function lastMonths(txs, month, n = 6) {
  const out = [];
  for (let k = n - 1; k >= 0; k--) out.push({ month: addMonth(month, -k), income: 0, expense: 0 });
  const idx = Object.fromEntries(out.map((o, i) => [o.month, i]));
  for (const t of txs) {
    const i = idx[monthOf(t.date)];
    if (i === undefined) continue;
    if (t.type === 'income') out[i].income += t.amount;
    else out[i].expense += t.amount;
  }
  return out;
}

/** Plain-language observations about the month. Each is { tone: 'good' | 'warn' | 'info', text }. */
export function insights(txs, month, budgets, today) {
  const st = monthStats(txs, month);
  const out = [];
  if (!st.count) return out;
  const isCur = monthOf(today) === month;
  const elapsed = isCur ? dayOf(today) : daysIn(month);
  const dim = daysIn(month);

  const cats = Object.keys(st.byCat).sort((a, b) => st.byCat[b] - st.byCat[a]);
  if (cats.length && st.expense > 0) {
    out.push({ tone: 'info', text: `${catName(cats[0])} is your biggest category at ${inr(st.byCat[cats[0]])}, ${pct(st.byCat[cats[0]], st.expense)}% of what you spent.` });
  }

  const total = budgets._total || 0;
  if (total && isCur && elapsed >= 5 && elapsed < dim) {
    const projected = Math.round((st.expense / elapsed) * dim);
    if (projected > total) out.push({ tone: 'warn', text: `At this pace you will spend about ${inr(projected)} by month end, ${inr(projected - total)} over your ${inr(total)} budget.` });
    else out.push({ tone: 'good', text: `You are on pace to finish around ${inr(projected)}, inside your ${inr(total)} budget.` });
  } else if (total && st.expense > total) {
    out.push({ tone: 'warn', text: `You spent ${inr(st.expense - total)} more than your ${inr(total)} budget.` });
  }

  const over = cats.filter((c) => budgets[c] && st.byCat[c] > budgets[c]);
  over.slice(0, 2).forEach((c) => out.push({ tone: 'warn', text: `${catName(c)} is ${inr(st.byCat[c] - budgets[c])} over its ${inr(budgets[c])} limit.` }));

  if (st.income > 0) {
    if (st.net < 0) out.push({ tone: 'warn', text: `You spent ${inr(-st.net)} more than you earned this month.` });
    else if (st.rate >= 0.2) out.push({ tone: 'good', text: `You are saving ${Math.round(st.rate * 100)}% of your income, ${inr(st.net)} so far.` });
    else out.push({ tone: 'info', text: `You have kept ${Math.round(st.rate * 100)}% of your income, ${inr(st.net)} so far.` });
  }

  const prev = monthStats(txs, addMonth(month, -1));
  let jump = null;
  for (const c of cats) {
    const was = prev.byCat[c] || 0;
    const rise = st.byCat[c] - was;
    if (was > 0 && rise >= 50000 && rise / was >= 0.3 && (!jump || rise > jump.rise)) jump = { c, rise, was };
  }
  if (jump && (!isCur || elapsed >= 15)) out.push({ tone: 'info', text: `${catName(jump.c)} is up ${inr(jump.rise)} from last month.` });

  if (st.biggest && st.expense > 0 && st.biggest.amount / st.expense >= 0.25 && st.count > 3) {
    out.push({ tone: 'info', text: `Your largest single expense was ${inr(st.biggest.amount)}${st.biggest.note ? ` (${st.biggest.note})` : ''}.` });
  }
  return out.slice(0, 5);
}
