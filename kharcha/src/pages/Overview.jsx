import { useMemo } from 'react';
import { Chip, Dot, Empty, Icon, Meter, useToast } from '../components/ui.jsx';
import MonthNav from '../components/MonthNav.jsx';
import TxRow from '../components/TxRow.jsx';
import { DailyChart, FlowChart } from '../components/Charts.jsx';
import { useData } from '../data/store.jsx';
import { addMonth, dayOf, daysIn, diffDays, fmtShort, longMonth, monthName, monthOf, todayStr } from '../lib/dates.js';
import { catName } from '../lib/categories.js';
import { inr, inrSigned, pct } from '../lib/format.js';
import { insights, lastMonths, monthStats, sumUpTo } from '../lib/stats.js';
import { nextOccurrence } from '../lib/recurring.js';
import { makeSample } from '../lib/sample.js';
import { href } from '../lib/router.js';

export default function Overview({ onAdd, onEdit }) {
  const { ready, txs, budgets, recurring, month, mode, restore } = useData();
  const toast = useToast();
  const today = todayStr();
  const cur = monthOf(today);
  const isCur = month === cur;
  const el = isCur ? dayOf(today) : daysIn(month);

  const st = useMemo(() => monthStats(txs, month), [txs, month]);
  const six = useMemo(() => lastMonths(txs, month, 6), [txs, month]);
  const tips = useMemo(() => insights(txs, month, budgets, today), [txs, month, budgets, today]);
  const prev = addMonth(month, -1);
  const prevSpent = useMemo(() => sumUpTo(txs, prev, 'expense', isCur ? el : 31), [txs, prev, isCur, el]);
  const upcoming = useMemo(
    () =>
      recurring
        .map((r) => ({ r, next: nextOccurrence(r, today) }))
        .filter((x) => x.next && diffDays(today, x.next) <= 30)
        .sort((a, b) => (a.next < b.next ? -1 : 1))
        .slice(0, 5),
    [recurring, today],
  );
  const recent = useMemo(() => [...txs].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0)).slice(0, 6), [txs]);

  if (!ready) return <div className="page"><p className="muted">Loading your entries…</p></div>;

  if (txs.length === 0) {
    return (
      <div className="page">
        <header className="page-h"><h1>Overview</h1></header>
        <div className="card">
          <Empty
            title="Start with your first entry"
            action={
              <div className="actions inline">
                <button className="btn" type="button" onClick={() => onAdd()}>Add an entry</button>
                {mode === 'local' && (
                  <button
                    className="btn ghost"
                    type="button"
                    onClick={async () => {
                      const r = await restore(makeSample());
                      toast(r.ok ? 'Sample data loaded. Replace it from the Data page any time.' : r.error, r.ok ? 'ok' : 'bad');
                    }}
                  >
                    Try with sample data
                  </button>
                )}
              </div>
            }
          >
            Log what you spend and earn. Charts, budgets and savings fill in as you add entries. You can also import a bank statement or set up rent and salary under Recurring.
          </Empty>
        </div>
      </div>
    );
  }

  const spentDelta = prevSpent ? st.expense - prevSpent : null;
  const prevLabel = isCur ? (el === 1 ? `1 ${monthName(prev).slice(0, 3)}` : `1–${el} ${monthName(prev).slice(0, 3)}`) : monthName(prev);
  const total = budgets._total || 0;
  const cats = Object.keys(st.byCat).sort((a, b) => st.byCat[b] - st.byCat[a]);
  const catMax = cats.length ? st.byCat[cats[0]] : 0;
  const avg = el ? Math.round(st.expense / el) : 0;

  return (
    <div className="page">
      <header className="page-h">
        <h1>Overview</h1>
        <div className="page-actions">
          <MonthNav />
        </div>
      </header>

      <section className="kpis" aria-label={`Summary for ${longMonth(month)}`}>
        <div className="kpi">
          <div className="k">Spent</div>
          <div className="v big">{inr(st.expense)}</div>
          <div className="s">
            {spentDelta === null ? (
              <span>Nothing logged in {prevLabel} to compare.</span>
            ) : spentDelta === 0 ? (
              <span>Same as {prevLabel}.</span>
            ) : (
              <span className={'delta ' + (spentDelta > 0 ? 'up' : 'down')}>
                <Icon name={spentDelta > 0 ? 'up' : 'down'} size={13} />
                {inr(Math.abs(spentDelta))} {spentDelta > 0 ? 'more' : 'less'} than {prevLabel}
              </span>
            )}
          </div>
        </div>
        <div className="kpi">
          <div className="k">Income</div>
          <div className="v big income">{inr(st.income)}</div>
          <div className="s">{st.income ? `${Object.keys(st.incByCat).length} source${Object.keys(st.incByCat).length === 1 ? '' : 's'} this month` : <a className="link" href={href('recurring')}>Add your salary as recurring</a>}</div>
        </div>
        <div className="kpi">
          <div className="k">Saved</div>
          <div className={'v big' + (st.net < 0 ? ' neg' : '')}>{inrSigned(st.net)}</div>
          <div className="s">{st.rate === null ? 'Needs income to calculate.' : st.net < 0 ? 'You spent more than you earned.' : `${Math.round(st.rate * 100)}% of income kept`}</div>
        </div>
        <div className="kpi">
          <div className="k">Monthly budget</div>
          {total ? (
            <>
              <div className="v">{inr(st.expense)} <span className="of">of {inr(total)}</span></div>
              <Meter value={st.expense} max={total} tone={st.expense > total ? 'over' : pct(st.expense, total) >= 80 ? 'warn' : ''} />
              <div className={'s' + (st.expense > total ? ' badtxt' : '')}>
                {st.expense > total ? <><Icon name="alert" size={13} /> Over by {inr(st.expense - total)}</> : `${pct(st.expense, total)}% used · ${inr(total - st.expense)} left`}
              </div>
            </>
          ) : (
            <>
              <div className="v sm">No budget set</div>
              <div className="s"><a className="link" href={href('budgets')}>Set a monthly budget</a> to see what is left.</div>
            </>
          )}
        </div>
      </section>

      <div className="grid">
        <section className="card span7">
          <div className="card-h"><h2>Where it went</h2><span className="muted small">Select a category to see its entries</span></div>
          {cats.length === 0 ? (
            <p className="none">No spending logged in {longMonth(month)}.</p>
          ) : (
            <div className="cats">
              {cats.map((id) => {
                const v = st.byCat[id];
                const lim = budgets[id] || 0;
                return (
                  <a key={id} className="catrow" href={href('transactions', { cat: id, type: 'expense' })} aria-label={`${catName(id)}: ${inr(v)}, ${pct(v, st.expense)} percent. Show entries.`}>
                    <span className="cname"><Dot id={id} />{catName(id)}</span>
                    <span className="ctrack"><span className="cfill" style={{ width: Math.max(1, (v / catMax) * 100) + '%', background: `var(--c-${id})` }} /></span>
                    <span className="camt">{inr(v)}</span>
                    <span className="cpct">{pct(v, st.expense)}%</span>
                    {lim > 0 && (
                      <span className="cbud">
                        {v > lim ? <Chip tone="bad" icon="alert">Over by {inr(v - lim)}</Chip> : <span className="muted small">{inr(lim - v)} left of {inr(lim)}</span>}
                      </span>
                    )}
                  </a>
                );
              })}
            </div>
          )}
        </section>

        <section className="card span5">
          <div className="card-h"><h2>What stands out</h2></div>
          {tips.length === 0 ? (
            <p className="none">Insights appear as you add more entries and set a budget.</p>
          ) : (
            <ul className="insights">
              {tips.map((t, i) => (
                <li key={i} className={'insight ' + t.tone}>
                  <Icon name={t.tone === 'warn' ? 'alert' : t.tone === 'good' ? 'check' : 'info'} size={16} />
                  <span>{t.text}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="card span7">
          <div className="card-h">
            <h2>Day by day</h2>
            {avg > 0 && <span className="legend"><span className="dash" />Daily average {inr(avg)}</span>}
          </div>
          {st.expense ? <DailyChart byDay={st.byDay} month={month} avg={avg} /> : <p className="none">No spending logged in {longMonth(month)}.</p>}
        </section>

        <section className="card span5">
          <div className="card-h">
            <h2>Last six months</h2>
            <span className="legend"><i className="sw income" />Income <i className="sw" />Spent</span>
          </div>
          <FlowChart data={six} />
        </section>

        <section className="card span5">
          <div className="card-h"><h2>Coming up</h2><a className="link small" href={href('recurring')}>Manage</a></div>
          {upcoming.length === 0 ? (
            <p className="none">Nothing due in the next 30 days. Add rent, subscriptions or salary under Recurring.</p>
          ) : (
            <ul className="rows">
              {upcoming.map(({ r, next }) => (
                <li key={r.id} className="tx nodate">
                  <div className="tx-main">
                    <div className="tx-note">{r.note || catName(r.category)}</div>
                    <div className="tx-meta"><Dot id={r.category} size={8} />{fmtShort(next)} · in {diffDays(today, next)} {diffDays(today, next) === 1 ? 'day' : 'days'}</div>
                  </div>
                  <span className={'tx-amt ' + r.type}>{r.type === 'income' ? '+' : ''}{inr(r.amount)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="card span7">
          <div className="card-h"><h2>Recent</h2><a className="link small" href={href('transactions')}>See all</a></div>
          <ul className="rows">
            {recent.map((t) => (
              <TxRow key={t.id} t={t} onEdit={onEdit} />
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}
