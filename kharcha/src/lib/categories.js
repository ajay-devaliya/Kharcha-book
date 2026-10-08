export const EXPENSE_CATS = [
  { id: 'food', name: 'Food & dining' },
  { id: 'groc', name: 'Groceries' },
  { id: 'move', name: 'Transport' },
  { id: 'bills', name: 'Rent & bills' },
  { id: 'shop', name: 'Shopping' },
  { id: 'health', name: 'Health' },
  { id: 'fun', name: 'Entertainment' },
  { id: 'other', name: 'Other' },
];

export const INCOME_CATS = [
  { id: 'salary', name: 'Salary' },
  { id: 'freelance', name: 'Freelance' },
  { id: 'interest', name: 'Interest & returns' },
  { id: 'other_in', name: 'Other income' },
];

export const CAT = Object.fromEntries([...EXPENSE_CATS, ...INCOME_CATS].map((c) => [c.id, c]));
export const catsFor = (type) => (type === 'income' ? INCOME_CATS : EXPENSE_CATS);
export const fallbackCat = (type) => (type === 'income' ? 'other_in' : 'other');
export const catName = (id) => (CAT[id] ? CAT[id].name : 'Other');

export const METHODS = [
  { id: 'upi', name: 'UPI' },
  { id: 'cash', name: 'Cash' },
  { id: 'card', name: 'Card' },
  { id: 'bank', name: 'Bank transfer' },
];
export const METHOD = Object.fromEntries(METHODS.map((m) => [m.id, m.name]));

const EXPENSE_RULES = [
  [/swiggy|zomato|restaurant|cafe|dominos|domino's|mcdonald|kfc|pizza|burger|dining|chai|tea|bakery|biryani|eatery/i, 'food'],
  [/bigbasket|blinkit|zepto|grofers|dmart|grocery|groceries|vegetable|fruit|milk|instamart|supermarket|kirana/i, 'groc'],
  [/uber|ola\b|rapido|petrol|diesel|fuel|metro|irctc|fastag|redbus|bus|auto|cab|train|flight|parking|toll/i, 'move'],
  [/rent|electric|bescom|msedcl|torrent|broadband|airtel|jio|vodafone|vi\b|recharge|insurance|premium|emi|loan|gas|water|lic\b|maintenance|bill/i, 'bills'],
  [/amazon|flipkart|myntra|ajio|nykaa|meesho|shopping|mall|store|clothes|apparel|electronics/i, 'shop'],
  [/pharmacy|apollo|medplus|hospital|clinic|doctor|1mg|netmeds|health|diagnostic|lab\b|dental|medicine/i, 'health'],
  [/netflix|hotstar|spotify|prime video|bookmyshow|movie|inox|pvr|youtube|gaming|steam|concert|outing|subscription/i, 'fun'],
];
const INCOME_RULES = [
  [/salary|payroll|stipend|wages/i, 'salary'],
  [/interest|int\.?\s*pd|dividend|mutual fund|redemption|cashback/i, 'interest'],
  [/freelance|invoice|client|consult|project/i, 'freelance'],
];

export function guessCategory(text, type = 'expense') {
  const rules = type === 'income' ? INCOME_RULES : EXPENSE_RULES;
  for (const [re, id] of rules) if (re.test(text || '')) return id;
  return fallbackCat(type);
}
