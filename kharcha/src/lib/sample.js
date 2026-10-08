import { addMonth, daysIn, dayOf, pad, todayStr, monthOf } from './dates.js';

/** Made-up data for trying the app. Only used from the "Load sample data" button in local mode. */
export function makeSample() {
  const today = todayStr();
  const cur = monthOf(today);
  let s = 20261007;
  const rnd = () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const pick = (a) => a[Math.floor(rnd() * a.length)];
  const T = {
    food: [['Swiggy dinner', 180, 560], ['Lunch with colleagues', 140, 360], ['Chai and snacks', 30, 140], ['Zomato order', 200, 650]],
    groc: [['Vegetables and fruit', 120, 480], ['Zepto order', 320, 1450], ['Milk and curd', 60, 170]],
    move: [['Auto to office', 60, 230], ['Petrol', 500, 1400], ['Metro recharge', 200, 500], ['Cab ride', 160, 640]],
    shop: [['Clothes', 700, 3000], ['Amazon order', 280, 2400], ['Household items', 200, 900]],
    health: [['Pharmacy', 110, 790], ['Doctor visit', 300, 800]],
    fun: [['Movie tickets', 300, 720], ['Weekend outing', 500, 1900]],
  };
  const W = [['food', 0.38], ['groc', 0.2], ['move', 0.2], ['shop', 0.09], ['health', 0.04], ['fun', 0.09]];
  const pickCat = () => {
    const r = rnd();
    let a = 0;
    for (const [c, w] of W) {
      a += w;
      if (r <= a) return c;
    }
    return 'food';
  };
  const transactions = [];
  const add = (date, type, category, note, rupees, method) =>
    transactions.push({ id: `s${transactions.length}`, type, amount: Math.round(rupees * 100), category, date, note, method, recurringId: null });

  for (let k = -5; k <= 0; k++) {
    const m = addMonth(cur, k);
    const nd = k === 0 ? dayOf(today) : daysIn(m);
    for (let d = 1; d <= nd; d++) {
      const date = `${m}-${pad(d)}`;
      // Rent, salary, broadband and streaming come from the recurring rules below.
      if (d === 5) add(date, 'expense', 'bills', 'Electricity bill', Math.round(900 + rnd() * 1400), 'upi');
      if (d === 12 && k % 2 === 0) add(date, 'income', 'freelance', 'Freelance project', Math.round(6000 + rnd() * 9000), 'bank');
      const c = rnd() < 0.2 ? 0 : 1 + (rnd() < 0.45 ? 1 : 0) + (rnd() < 0.15 ? 1 : 0);
      for (let i = 0; i < c; i++) {
        const cat = pickCat();
        const t = pick(T[cat]);
        add(date, 'expense', cat, t[0], Math.max(t[1], Math.round((t[1] + rnd() * (t[2] - t[1])) / 10) * 10), rnd() < 0.7 ? 'upi' : rnd() < 0.5 ? 'card' : 'cash');
      }
    }
  }
  const start = `${addMonth(cur, -5)}-01`;
  const recurring = [
    { id: 'r1', type: 'expense', amount: 1200000, category: 'bills', note: 'Rent', method: 'bank', day: 1, startDate: start, endDate: null, active: true },
    { id: 'r2', type: 'income', amount: 5200000, category: 'salary', note: 'Salary', method: 'bank', day: 1, startDate: start, endDate: null, active: true },
    { id: 'r3', type: 'expense', amount: 99900, category: 'bills', note: 'Mobile and broadband', method: 'upi', day: 8, startDate: start, endDate: null, active: true },
    { id: 'r4', type: 'expense', amount: 64900, category: 'fun', note: 'Streaming plan', method: 'card', day: 18, startDate: start, endDate: null, active: true },
  ];
  const budgets = { _total: 4500000, food: 800000, groc: 700000, move: 500000, shop: 600000, fun: 300000 };
  return { transactions, budgets, recurring };
}
