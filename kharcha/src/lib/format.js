const nf0 = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 });
const nf2 = new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** Amounts are stored as integer paise. */
export const inr = (p) => '₹' + (p % 100 === 0 ? nf0.format(p / 100) : nf2.format(p / 100));
export const inrSigned = (p) => (p < 0 ? '−' : '') + inr(Math.abs(p));

const trim1 = (n) => String(Math.round(n * 10) / 10).replace(/\.0$/, '');
export function short(p) {
  const r = p / 100;
  if (r >= 1e7) return '₹' + trim1(r / 1e7) + 'Cr';
  if (r >= 1e5) return '₹' + trim1(r / 1e5) + 'L';
  if (r >= 1e3) return '₹' + trim1(r / 1e3) + 'k';
  return '₹' + trim1(r);
}

/** "1,250.50" or "₹ 250" to paise. Returns 0 when the text is not a positive amount. */
export function parseAmount(s) {
  const t = String(s ?? '').replace(/[₹,\s]/g, '');
  if (!/^\d+(\.\d{1,2})?$/.test(t)) return 0;
  const p = Math.round(parseFloat(t) * 100);
  return p > 0 && p <= 1e10 ? p : 0;
}

export const pct = (part, whole) => (whole > 0 ? Math.round((part / whole) * 100) : 0);
