import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { createLocalStore } from './localStore.js';
import { createSupabaseStore } from './supabaseStore.js';
import { dueOccurrences } from '../lib/recurring.js';
import { monthOf, todayStr } from '../lib/dates.js';
import { useToast } from '../components/ui.jsx';

const Ctx = createContext(null);
export const useData = () => useContext(Ctx);

function friendly(e) {
  const msg = String((e && e.message) || e || '');
  if (e && e.code === '23505') return 'That entry already exists.';
  if (/jwt|expired|not authenticated|row-level/i.test(msg)) return 'Your session expired. Sign in again.';
  if (/failed to fetch|networkerror|network request/i.test(msg)) return 'No connection. Check your internet and try again.';
  return msg || 'Something went wrong. Try again.';
}

const EMPTY = { ready: false, txs: [], budgets: {}, recurring: [], error: null };

export function DataProvider({ session, children }) {
  const toast = useToast();
  const userId = session && session.user ? session.user.id : null;
  const api = useMemo(() => (userId ? createSupabaseStore(userId) : createLocalStore()), [userId]);
  const [s, setS] = useState(EMPTY);
  const [month, setMonth] = useState(() => monthOf(todayStr()));
  const live = useRef(s);
  live.current = s;

  /**
   * Create any recurring entries that have come due, then remember that each rule is up to date as of today.
   * Returns the new entries and the rules with their updated marker.
   */
  const generate = useCallback(
    async (rules, txs) => {
      const today = todayStr();
      const have = {};
      for (const t of txs) if (t.recurringId) (have[t.recurringId] ||= new Set()).add(t.date);
      const rows = [];
      for (const r of rules) {
        for (const d of dueOccurrences(r, have[r.id] || new Set(), today)) {
          rows.push({ type: r.type, amount: r.amount, category: r.category, date: d, note: r.note, method: r.method, recurringId: r.id });
        }
      }
      const added = rows.length ? await api.addTxs(rows, { ignoreDuplicates: true }) : [];
      const stale = rules.filter((r) => r.active && r.generatedThrough !== today).map((r) => r.id);
      if (stale.length) {
        try {
          await api.markGenerated(stale, today);
        } catch (e) {
          console.error(e);
        }
      }
      return { added, rules: rules.map((r) => (stale.includes(r.id) ? { ...r, generatedThrough: today } : r)) };
    },
    [api],
  );

  // A second call while one is running (React StrictMode does this in development) shares the first,
  // so recurring entries are never created twice and the screen never shows a half-updated list.
  const inflight = useRef(null);
  const load = useCallback(() => {
    if (inflight.current) return inflight.current;
    const p = (async () => {
      try {
        const d = await api.load();
        let added = [];
        let rules = d.recurring;
        try {
          const g = await generate(d.recurring, d.transactions);
          added = g.added;
          rules = g.rules;
        } catch (e) {
          console.error(e);
        }
        setS({ ready: true, txs: [...added, ...d.transactions], budgets: d.budgets, recurring: rules, error: null });
        if (added.length) toast(`Added ${added.length} recurring ${added.length === 1 ? 'entry' : 'entries'} that came due`);
      } catch (e) {
        console.error(e);
        setS((prev) => ({ ...prev, ready: true, error: friendly(e) }));
      }
    })().finally(() => {
      inflight.current = null;
    });
    inflight.current = p;
    return p;
  }, [api, generate, toast]);

  useEffect(() => {
    setS(EMPTY);
    load();
  }, [load]);

  const actions = useMemo(() => {
    const run = async (fn) => {
      try {
        return { ok: true, value: await fn() };
      } catch (e) {
        console.error(e);
        return { ok: false, error: friendly(e) };
      }
    };
    return {
      addTx: (t) =>
        run(async () => {
          const [row] = await api.addTxs([t]);
          setS((p) => ({ ...p, txs: [row, ...p.txs] }));
          return row;
        }),
      updateTx: (id, patch) =>
        run(async () => {
          const row = await api.updateTx(id, patch);
          setS((p) => ({ ...p, txs: p.txs.map((t) => (t.id === id ? row : t)) }));
        }),
      deleteTx: (id) =>
        run(async () => {
          await api.deleteTx(id);
          setS((p) => ({ ...p, txs: p.txs.filter((t) => t.id !== id) }));
        }),
      addTxs: (list) =>
        run(async () => {
          const rows = await api.addTxs(list);
          setS((p) => ({ ...p, txs: [...rows, ...p.txs] }));
          return rows.length;
        }),
      setBudget: (cat, amount) =>
        run(async () => {
          await api.setBudget(cat, amount);
          setS((p) => {
            const b = { ...p.budgets };
            if (amount) b[cat] = amount;
            else delete b[cat];
            return { ...p, budgets: b };
          });
        }),
      saveRecurring: (rule) =>
        run(async () => {
          const saved = await api.saveRecurring(rule);
          const cur = live.current;
          const g = await generate([saved], cur.txs);
          const rules = rule.id ? cur.recurring.map((r) => (r.id === saved.id ? g.rules[0] : r)) : [...cur.recurring, g.rules[0]];
          setS((p) => ({ ...p, recurring: rules, txs: [...g.added, ...p.txs] }));
          return g.added.length;
        }),
      deleteRecurring: (id) =>
        run(async () => {
          await api.deleteRecurring(id);
          setS((p) => ({ ...p, recurring: p.recurring.filter((r) => r.id !== id) }));
        }),
      restore: (b) =>
        run(async () => {
          await api.replaceAll(b);
          await load();
        }),
      clearAll: () =>
        run(async () => {
          await api.clearAll();
          await load();
        }),
    };
  }, [api, generate, load]);

  const value = useMemo(() => ({ ...s, month, setMonth, mode: api.mode, session, reload: load, ...actions }), [s, month, api, session, load, actions]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
