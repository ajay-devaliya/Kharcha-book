export const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export const MONL = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
export const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export const pad = (n) => String(n).padStart(2, '0');
export const ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const todayStr = () => ymd(new Date());
export const monthOf = (s) => s.slice(0, 7);
export const dayOf = (s) => Number(s.slice(8, 10));
export const parseD = (s) => {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
};
export const isDate = (s) => typeof s === 'string' && /^\d{4}-\d\d-\d\d$/.test(s) && ymd(parseD(s)) === s;
export const daysIn = (m) => {
  const [y, mo] = m.split('-').map(Number);
  return new Date(y, mo, 0).getDate();
};
export const addMonth = (m, k) => {
  const [y, mo] = m.split('-').map(Number);
  const d = new Date(y, mo - 1 + k, 1);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
};
export const addDays = (s, k) => {
  const d = parseD(s);
  d.setDate(d.getDate() + k);
  return ymd(d);
};
export const diffDays = (a, b) => Math.round((parseD(b) - parseD(a)) / 86400000);
export const fmtShort = (s) => {
  const d = parseD(s);
  return `${pad(d.getDate())} ${MON[d.getMonth()]}`;
};
export const fmtLong = (s) => {
  const d = parseD(s);
  return `${DOW[d.getDay()]} ${d.getDate()} ${MON[d.getMonth()]}`;
};
export const longMonth = (m) => {
  const [y, mo] = m.split('-').map(Number);
  return `${MONL[mo - 1]} ${y}`;
};
export const monthName = (m) => MONL[Number(m.slice(5, 7)) - 1];
export const monShort = (m) => {
  const [y, mo] = m.split('-').map(Number);
  return MON[mo - 1] + (mo === 1 ? ` ${String(y).slice(2)}` : '');
};
