const KEY = 'kharcha.local.v2';
const uid = () => (globalThis.crypto?.randomUUID ? crypto.randomUUID() : 'l' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8));

function read() {
  try {
    const o = JSON.parse(localStorage.getItem(KEY));
    return { transactions: o.transactions || [], budgets: o.budgets || {}, recurring: o.recurring || [] };
  } catch {
    return { transactions: [], budgets: {}, recurring: [] };
  }
}

/** Browser-only storage, used when no Supabase keys are configured. Same interface as the cloud store. */
export function createLocalStore() {
  let s = read();
  const save = () => {
    try {
      localStorage.setItem(KEY, JSON.stringify(s));
    } catch {
      throw new Error('This browser blocked saving. Turn off private mode or free up space.');
    }
  };
  return {
    mode: 'local',
    async load() {
      return JSON.parse(JSON.stringify(s));
    },
    async addTxs(list, { ignoreDuplicates = false } = {}) {
      const have = new Set(s.transactions.filter((t) => t.recurringId).map((t) => `${t.recurringId}|${t.date}`));
      const rows = [];
      for (const t of list) {
        if (ignoreDuplicates && t.recurringId && have.has(`${t.recurringId}|${t.date}`)) continue;
        rows.push({ ...t, id: uid() });
      }
      s.transactions.push(...rows);
      save();
      return rows;
    },
    async updateTx(id, patch) {
      const i = s.transactions.findIndex((t) => t.id === id);
      if (i < 0) throw new Error('That entry no longer exists.');
      s.transactions[i] = { ...s.transactions[i], ...patch, id };
      save();
      return s.transactions[i];
    },
    async deleteTx(id) {
      s.transactions = s.transactions.filter((t) => t.id !== id);
      save();
    },
    async setBudget(category, amount) {
      if (amount) s.budgets[category] = amount;
      else delete s.budgets[category];
      save();
    },
    async saveRecurring(rule) {
      if (rule.id) {
        const i = s.recurring.findIndex((r) => r.id === rule.id);
        if (i >= 0) s.recurring[i] = { ...rule };
        else s.recurring.push({ ...rule });
        save();
        return rule;
      }
      const r = { ...rule, id: uid() };
      s.recurring.push(r);
      save();
      return r;
    },
    async markGenerated(ids, date) {
      s.recurring = s.recurring.map((r) => (ids.includes(r.id) ? { ...r, generatedThrough: date } : r));
      save();
    },
    async deleteRecurring(id) {
      s.recurring = s.recurring.filter((r) => r.id !== id);
      save();
    },
    async replaceAll(b) {
      s = {
        transactions: b.transactions.map((t) => ({ ...t, id: t.id || uid() })),
        budgets: { ...b.budgets },
        recurring: b.recurring.map((r) => ({ ...r, id: r.id || uid() })),
      };
      save();
    },
    async clearAll() {
      s = { transactions: [], budgets: {}, recurring: [] };
      save();
    },
  };
}
