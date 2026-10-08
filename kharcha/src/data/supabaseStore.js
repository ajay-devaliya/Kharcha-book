import { createClient } from '@supabase/supabase-js';
import { isUuid } from '../lib/backup.js';

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY;

/** null when the two environment variables are missing, which puts the app in local mode. */
export const supabase = url && key ? createClient(url, key) : null;

const toTx = (r) => ({
  id: r.id,
  type: r.type,
  amount: Number(r.amount_paise),
  category: r.category,
  date: r.date,
  note: r.note || '',
  method: r.method || '',
  recurringId: r.recurring_id || null,
});
const fromTx = (t, uid) => ({
  ...(isUuid(t.id) ? { id: t.id } : {}),
  user_id: uid,
  type: t.type,
  amount_paise: t.amount,
  category: t.category,
  date: t.date,
  note: t.note || '',
  method: t.method || '',
  recurring_id: isUuid(t.recurringId) ? t.recurringId : null,
});
const toRule = (r) => ({
  id: r.id,
  type: r.type,
  amount: Number(r.amount_paise),
  category: r.category,
  note: r.note || '',
  method: r.method || '',
  day: r.day_of_month,
  startDate: r.start_date,
  endDate: r.end_date || null,
  active: r.active,
  generatedThrough: r.generated_through || null,
});
const fromRule = (r, uid) => ({
  ...(isUuid(r.id) ? { id: r.id } : {}),
  user_id: uid,
  type: r.type,
  amount_paise: r.amount,
  category: r.category,
  note: r.note || '',
  method: r.method || '',
  day_of_month: r.day,
  start_date: r.startDate,
  end_date: r.endDate || null,
  active: r.active !== false,
  generated_through: r.generatedThrough || null,
});

const ok = ({ data, error }) => {
  if (error) throw error;
  return data;
};
const chunk = (a, n) => Array.from({ length: Math.ceil(a.length / n) }, (_, i) => a.slice(i * n, i * n + n));

/** Cloud storage for one signed-in user. Row level security in schema.sql keeps each user's rows private. */
export function createSupabaseStore(userId) {
  const db = supabase;
  return {
    mode: 'cloud',
    async load() {
      const txs = [];
      for (let from = 0; ; from += 1000) {
        const page = ok(await db.from('transactions').select('*').order('date', { ascending: false }).order('created_at', { ascending: false }).range(from, from + 999));
        txs.push(...page.map(toTx));
        if (page.length < 1000) break;
      }
      const budgets = {};
      ok(await db.from('budgets').select('category, amount_paise')).forEach((b) => (budgets[b.category] = Number(b.amount_paise)));
      const recurring = ok(await db.from('recurring').select('*').order('created_at')).map(toRule);
      return { transactions: txs, budgets, recurring };
    },
    async addTxs(list, { ignoreDuplicates = false } = {}) {
      const out = [];
      for (const part of chunk(list.map((t) => fromTx(t, userId)), 500)) {
        const q = ignoreDuplicates
          ? db.from('transactions').upsert(part, { onConflict: 'user_id,recurring_id,date', ignoreDuplicates: true })
          : db.from('transactions').insert(part);
        out.push(...ok(await q.select()).map(toTx));
      }
      return out;
    },
    async updateTx(id, patch) {
      const row = fromTx({ ...patch, id: undefined }, userId);
      delete row.user_id;
      return toTx(ok(await db.from('transactions').update(row).eq('id', id).select().single()));
    },
    async deleteTx(id) {
      ok(await db.from('transactions').delete().eq('id', id).select());
    },
    async setBudget(category, amount) {
      if (amount) ok(await db.from('budgets').upsert({ user_id: userId, category, amount_paise: amount }, { onConflict: 'user_id,category' }).select());
      else ok(await db.from('budgets').delete().eq('category', category).select());
    },
    async saveRecurring(rule) {
      const row = fromRule(rule, userId);
      if (rule.id) {
        delete row.user_id;
        delete row.id;
        return toRule(ok(await db.from('recurring').update(row).eq('id', rule.id).select().single()));
      }
      return toRule(ok(await db.from('recurring').insert(row).select().single()));
    },
    async markGenerated(ids, date) {
      ok(await db.from('recurring').update({ generated_through: date }).in('id', ids).select());
    },
    async deleteRecurring(id) {
      ok(await db.from('recurring').delete().eq('id', id).select());
    },
    async replaceAll(b) {
      await this.clearAll();
      const ruleRows = b.recurring.map((r) => fromRule(r, userId));
      for (const part of chunk(ruleRows, 500)) ok(await db.from('recurring').insert(part).select());
      const keep = new Set(ruleRows.map((r) => r.id).filter(Boolean));
      const txRows = b.transactions.map((t) => fromTx({ ...t, recurringId: keep.has(t.recurringId) ? t.recurringId : null }, userId));
      for (const part of chunk(txRows, 500)) ok(await db.from('transactions').insert(part).select());
      const budgetRows = Object.entries(b.budgets).map(([category, amount]) => ({ user_id: userId, category, amount_paise: amount }));
      if (budgetRows.length) ok(await db.from('budgets').insert(budgetRows).select());
    },
    async clearAll() {
      ok(await db.from('transactions').delete().eq('user_id', userId).select());
      ok(await db.from('recurring').delete().eq('user_id', userId).select());
      ok(await db.from('budgets').delete().eq('user_id', userId).select());
    },
  };
}
