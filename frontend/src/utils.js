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

// The moment a bill is printed, not the order's own timestamp — a reprint
// months later should show today's time, not when it was first raised.
export const prettyTime = (d = new Date()) =>
  d.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true });

export const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

/**
 * A phone photo is 3-8 MB; a product card shows it at a couple of hundred
 * pixels. Shrinking it here, before it is uploaded, keeps the Products screen
 * and the picker fast on a phone over wi-fi. Any failure returns the original
 * file untouched — an oversized photo is better than no photo.
 */
export async function shrinkImage(file, maxSide = 800, quality = 0.82) {
  try {
    if (!/^image\/(jpeg|png|webp)$/.test(file.type)) return file;
    const bmp = await createImageBitmap(file);
    const scale = Math.min(1, maxSide / Math.max(bmp.width, bmp.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bmp.width * scale);
    canvas.height = Math.round(bmp.height * scale);
    const ctx = canvas.getContext('2d');
    // JPEG has no transparency; a transparent PNG would otherwise go black.
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(bmp, 0, 0, canvas.width, canvas.height);
    bmp.close?.();
    const blob = await new Promise((r) => canvas.toBlob(r, 'image/jpeg', quality));
    if (!blob || blob.size >= file.size) return file;
    return new File([blob], file.name.replace(/\.\w+$/, '') + '.jpg', { type: 'image/jpeg' });
  } catch {
    return file;
  }
}
