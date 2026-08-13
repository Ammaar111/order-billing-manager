// Money is kept as a string while it is being typed so a half-typed "12." does
// not get rewritten under the cursor. It becomes a number only on save.
export const num = (v) => {
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : 0;
};

export const money = (n) => Math.round((Number(n) || 0) * 100) / 100;

export const rupees = (n, symbol = '₹') =>
  `${symbol}${money(n).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

// Digits and at most one dot. The bill has no spin buttons anywhere, so this is
// the only thing standing between a shopkeeper and "12..5".
export const cleanNumeric = (s) => {
  const t = String(s).replace(/[^0-9.]/g, '');
  const i = t.indexOf('.');
  if (i === -1) return t;
  return t.slice(0, i + 1) + t.slice(i + 1).replace(/\./g, '');
};

const pad = (n) => String(n).padStart(2, '0');

// Local date parts, never toISOString(): before 05:30 IST that reports
// yesterday and files the bill under the wrong day.
export const todayStr = (d = new Date()) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

export const prettyDate = (iso) => {
  if (!iso) return '';
  const [y, m, d] = iso.split(/[- ]/);
  const date = new Date(Number(y), Number(m) - 1, Number(d));
  return date.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
};

export const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
