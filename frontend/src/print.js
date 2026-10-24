import { money, prettyDate } from './utils.js';

const RULES_ID = 'obm-page-rules';

const PX_PER_MM = 96 / 25.4;

/**
 * How tall the receipt comes out at a given roll width, in millimetres.
 *
 * A roll has no page length — it feeds until the bill ends and the cutter goes.
 * CSS cannot say that: `@page { size: 80mm auto }` mixes a length with a
 * keyword, which is invalid, and a browser that cannot parse the rule quietly
 * falls back to Letter — which is exactly how a receipt ends up as a narrow
 * strip in the corner of a big sheet. So the height is measured off a copy laid
 * out at the real roll width and written into the rule as a number.
 */
function receiptHeightMm(widthMm) {
  const paper = document.querySelector('.print-only .bill-paper');
  if (!paper) return 297;
  const host = document.createElement('div');
  host.style.cssText =
    `position:fixed;left:-10000px;top:0;visibility:hidden;width:${widthMm}mm;`;
  const clone = paper.cloneNode(true);
  host.appendChild(clone);
  document.body.appendChild(host);
  const px = clone.getBoundingClientRect().height;
  host.remove();
  // A few millimetres of tail so the last line is never clipped by the cut.
  return Math.max(40, Math.ceil(px / PX_PER_MM) + 6);
}

/**
 * Both "Save as PDF" and "Print on the thermal roll" are the same browser print
 * dialog — the only difference is the paper. There is no PDF library here on
 * purpose: the browser's own print-to-PDF is what lets the shopkeeper choose
 * where the file lands, and it never gets the fonts wrong.
 *
 * @page has to be written into the document at print time because the thermal
 * width is a setting; a stylesheet cannot read it.
 */
export function printBill(mode, widthMm = 80) {
  return new Promise((resolve) => {
    document.getElementById(RULES_ID)?.remove();
    document.body.dataset.printMode = mode;

    const style = document.createElement('style');
    style.id = RULES_ID;
    if (mode === 'thermal') {
      const w = Number(widthMm) || 80;
      style.textContent = `@page { size: ${w}mm ${receiptHeightMm(w)}mm; margin: 0; }`;
    } else {
      style.textContent = '@page { size: A4 portrait; margin: 0; }';
    }
    document.head.appendChild(style);

    const cleanup = () => {
      window.removeEventListener('afterprint', cleanup);
      delete document.body.dataset.printMode;
      document.getElementById(RULES_ID)?.remove();
      resolve();
    };
    window.addEventListener('afterprint', cleanup);

    // One frame so the print layout is in the DOM before the dialog snapshots
    // the page.
    requestAnimationFrame(() => requestAnimationFrame(() => window.print()));
    // Safari and some Linux builds never fire afterprint; do not leak the rules.
    setTimeout(cleanup, 60000);
  });
}

const esc = (s) =>
  String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

function billHtml(order, items, settings) {
  const cur = settings.currency || '₹';
  const withNames = order.bill_type !== 'qty-rate';
  const n2 = (v) => money(v).toFixed(2);
  const rows = items
    .map(
      (it) => `<tr>
      <td>${it.sr_no}</td>
      ${withNames ? `<td>${esc(it.product_name)}</td>` : ''}
      <td align="right">${it.qty}</td>
      <td align="right">${n2(it.rate)}</td>
      <td align="right">${it.discount || 0}</td>
      <td align="right">${n2(it.line_total)}</td>
    </tr>`
    )
    .join('');

  const line = (label, value, bold) =>
    `<tr><td colspan="${withNames ? 4 : 3}"></td>
       <td align="right"${bold ? ' style="font-weight:bold"' : ''}>${esc(label)}</td>
       <td align="right"${bold ? ' style="font-weight:bold"' : ''}>${value}</td></tr>`;

  return `<!doctype html>
<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word">
<head><meta charset="utf-8"><title>Order ${order.order_no}</title>
<style>
  body { font-family: Calibri, Arial, sans-serif; font-size: 11pt; color: #1d1d1f; }
  h1 { font-size: 16pt; margin: 0 0 2pt; }
  .muted { color: #6e6e73; font-size: 9pt; margin: 0; }
  table { border-collapse: collapse; width: 100%; margin-top: 12pt; }
  th, td { border: 1px solid #d2d2d7; padding: 4pt 6pt; font-size: 10pt; }
  th { background: #f5f5f7; text-align: left; }
</style></head>
<body>
  <h1>${esc(settings.shop_name || 'Order Bill Manager')}</h1>
  ${settings.shop_address ? `<p class="muted">${esc(settings.shop_address)}</p>` : ''}
  ${settings.shop_phone ? `<p class="muted">${esc(settings.shop_phone)}</p>` : ''}
  <p><strong>Order #${order.order_no}</strong> &nbsp; ${esc(prettyDate(order.order_date))}</p>
  <p>Name: ${esc(order.customer_name)}<br>
     ${order.customer_phone ? `Phone: ${esc(order.customer_phone)}<br>` : ''}
     ${order.address ? `Address: ${esc(order.address)}` : ''}</p>
  <table>
    <thead><tr>
      <th>Sr</th>${withNames ? '<th>Product</th>' : ''}
      <th align="right">Qty</th><th align="right">Rate</th>
      <th align="right">Disc%</th><th align="right">Cost</th>
    </tr></thead>
    <tbody>
      ${rows}
      ${line('Total qty', money(order.total_qty))}
      ${line('Bill total', cur + n2(order.items_total))}
      ${money(order.total_discount) > 0 ? line('Discount given', '- ' + cur + n2(order.total_discount)) : ''}
      ${line('Packing', cur + n2(order.packing))}
      ${money(order.old_balance) !== 0 ? line('Old balance', cur + n2(order.old_balance)) : ''}
      ${money(order.round_off) !== 0 ? line('Round off', (money(order.round_off) > 0 ? '+ ' : '- ') + cur + n2(Math.abs(order.round_off))) : ''}
      ${line('Grand total', cur + n2(order.grand_total), true)}
      ${line('Amount received', cur + n2(order.amount_paid))}
      ${line(order.pending < 0 ? 'Change due' : 'Pending', cur + n2(Math.abs(order.pending)), true)}
    </tbody>
  </table>
</body></html>`;
}

function download(filename, blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// Word opens an .doc that is really HTML, which keeps the table editable and
// avoids shipping a document library for one button.
export function downloadWord(order, items, settings) {
  download(
    `order-${order.order_no}-${order.customer_name.replace(/[^\w]+/g, '-')}.doc`,
    new Blob(['﻿', billHtml(order, items, settings)], { type: 'application/msword' })
  );
}

export function downloadHtml(order, items, settings) {
  download(
    `order-${order.order_no}.html`,
    new Blob([billHtml(order, items, settings)], { type: 'text/html' })
  );
}

export function billText(order, items, settings) {
  const cur = settings.currency || '₹';
  const withNames = order.bill_type !== 'qty-rate';
  const lines = [
    `${settings.shop_name || 'Order Bill Manager'}`,
    `Order #${order.order_no} · ${prettyDate(order.order_date)}`,
    `Name: ${order.customer_name}`,
    order.address ? `Address: ${order.address}` : '',
    '',
    ...items.map(
      (it) =>
        `${it.sr_no}. ${withNames ? `${it.product_name} — ` : ''}${it.qty} x ${cur}${money(
          it.rate
        )} = ${cur}${money(it.line_total)}`
    ),
    '',
    `Total qty: ${money(order.total_qty)}`,
    money(order.total_discount) > 0 ? `Discount given: -${cur}${money(order.total_discount)}` : '',
    `Packing: ${cur}${money(order.packing)}`,
    money(order.old_balance) !== 0 ? `Old balance: ${cur}${money(order.old_balance)}` : '',
    money(order.round_off) !== 0
      ? `Round off: ${money(order.round_off) > 0 ? '+' : '-'}${cur}${money(Math.abs(order.round_off))}`
      : '',
    `Grand total: ${cur}${money(order.grand_total)}`,
    `Received: ${cur}${money(order.amount_paid)}`,
    order.pending < 0
      ? `Change due: ${cur}${money(-order.pending)}`
      : `Pending: ${cur}${money(order.pending)}`,
  ];
  return lines.filter((l) => l !== '').join('\n');
}
