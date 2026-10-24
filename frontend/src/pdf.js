import { money, prettyDate } from './utils.js';

// A4 in millimetres, with the margins the printed bill uses.
const W = 210;
const H = 297;
const M = 14;

/**
 * jsPDF's built-in Helvetica only knows Latin-1, so the rupee sign (and any
 * other character outside it) would come out as a garbled glyph. ₹ is written
 * as "Rs." — what a paper bill says anyway — and anything else it cannot draw
 * becomes "?" rather than corrupting the whole line.
 */
const latin = (s) =>
  String(s ?? '')
    .replace(/₹/g, 'Rs.')
    .replace(/[−–—]/g, '-')
    .replace(/[^\x20-\x7e\xa0-\xff]/g, '?');

export const pdfFileName = (order) =>
  `order-${order.order_no}-${String(order.customer_name || 'bill').replace(/[^\w]+/g, '-')}.pdf`;

/**
 * The bill as a real PDF file, small enough to send over a mobile connection.
 * Text rather than a screenshot of the page: a one-page bill comes to a few
 * kilobytes, stays sharp when zoomed, and the text is searchable.
 *
 * jsPDF is imported here, not at the top of the file, so the ~350 KB library
 * only travels to the phone when someone actually asks for a PDF.
 */
export async function billPdf(order, items, settings) {
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF({ unit: 'mm', format: 'a4', compress: true });

  const cur = latin(settings.currency || '₹');
  const withNames = order.bill_type !== 'qty-rate';
  const hasDiscount = withNames && items.some((it) => money(it.discount) > 0);
  const n2 = (v) => money(v).toFixed(2);

  const INK = [29, 29, 31];
  const MUTED = [110, 110, 115];
  const LINE = [210, 210, 215];
  const text = (color) => doc.setTextColor(...color);

  doc.setProperties({
    title: `Order #${order.order_no}`,
    subject: latin(settings.shop_name || 'Bill'),
  });

  /* ---------------------------------------------------------------- head */

  let y = M + 4;
  text(INK);
  doc.setFont('helvetica', 'bold').setFontSize(18);
  doc.text(latin(settings.shop_name || 'Order Bill Manager'), W / 2, y, { align: 'center' });
  doc.setFont('helvetica', 'normal').setFontSize(9.5);
  text(MUTED);
  for (const line of [settings.shop_address, settings.shop_phone]) {
    if (!line) continue;
    for (const part of doc.splitTextToSize(latin(line), W - 2 * M - 10)) {
      y += 5;
      doc.text(part, W / 2, y, { align: 'center' });
    }
  }

  y += 5;
  doc.setDrawColor(...LINE).setLineWidth(0.3).line(M, y, W - M, y);

  y += 7;
  text(INK);
  doc.setFont('helvetica', 'bold').setFontSize(12);
  doc.text(`Order #${order.order_no}`, M, y);
  doc.setFont('helvetica', 'normal').setFontSize(10);
  text(MUTED);
  doc.text(latin(prettyDate(order.order_date)), W - M, y, { align: 'right' });

  y += 6;
  text(INK);
  doc.setFontSize(10);
  const who = [
    `Name: ${order.customer_name}`,
    order.customer_phone && `Phone: ${order.customer_phone}`,
    order.address && `Address: ${order.address}`,
  ].filter(Boolean);
  for (const w of who) {
    for (const part of doc.splitTextToSize(latin(w), W - 2 * M)) {
      doc.text(part, M, y);
      y += 4.8;
    }
  }

  /* --------------------------------------------------------------- table */

  // Right edge of each numeric column, working in from the margin.
  const right = W - M;
  const colCost = right;
  const colDisc = hasDiscount ? colCost - 28 : null;
  const colRate = (colDisc ?? colCost) - 28;
  const colQty = colRate - 24;
  const nameX = M + 12;
  const nameW = colQty - 18 - nameX;

  const head = () => {
    doc.setFillColor(245, 245, 247).rect(M, y, W - 2 * M, 7.5, 'F');
    doc.setFont('helvetica', 'bold').setFontSize(9);
    text(MUTED);
    const ty = y + 5;
    doc.text('Sr', M + 2, ty);
    if (withNames) doc.text('Product', nameX, ty);
    doc.text('Qty', colQty, ty, { align: 'right' });
    doc.text('Rate', colRate, ty, { align: 'right' });
    if (hasDiscount) doc.text('Disc%', colDisc, ty, { align: 'right' });
    doc.text('Total', colCost - 1, ty, { align: 'right' });
    y += 7.5;
  };

  y += 3;
  head();

  doc.setFont('helvetica', 'normal').setFontSize(10);
  for (const it of items) {
    const nameLines = withNames ? doc.splitTextToSize(latin(it.product_name), nameW) : [''];
    const rowH = Math.max(1, nameLines.length) * 4.8 + 2.6;

    if (y + rowH > H - M - 40) {
      doc.addPage();
      y = M;
      head();
      doc.setFont('helvetica', 'normal').setFontSize(10);
    }

    text(INK);
    const ty = y + 5;
    doc.text(String(it.sr_no), M + 2, ty);
    if (withNames) doc.text(nameLines, nameX, ty);
    doc.text(String(it.qty), colQty, ty, { align: 'right' });
    doc.text(n2(it.rate), colRate, ty, { align: 'right' });
    if (hasDiscount) doc.text(it.discount ? String(it.discount) : '-', colDisc, ty, { align: 'right' });
    doc.text(n2(it.line_total), colCost - 1, ty, { align: 'right' });

    y += rowH;
    doc.setDrawColor(...LINE).setLineWidth(0.15).line(M, y, W - M, y);
  }

  // Total quantity sits under the Qty column, as on the printed bill.
  y += 5.5;
  doc.setFont('helvetica', 'bold');
  doc.text(withNames ? 'Total qty' : 'Total', nameX, y);
  doc.text(String(money(order.total_qty)), colQty, y, { align: 'right' });

  /* -------------------------------------------------------------- totals */

  const rows = [
    ['Bill total', `${cur}${n2(order.items_total)}`],
    money(order.total_discount) > 0 && ['Discount given', `- ${cur}${n2(order.total_discount)}`],
    ['Packing', `${cur}${n2(order.packing)}`],
    money(order.round_off) !== 0 && [
      'Round off',
      `${money(order.round_off) > 0 ? '+' : '-'} ${cur}${n2(Math.abs(order.round_off))}`,
    ],
    money(order.old_balance) !== 0 && ['Old balance', `${cur}${n2(order.old_balance)}`],
    ['Grand total', `${cur}${n2(order.grand_total)}`, 'grand'],
    ['Amount received', `${cur}${n2(order.amount_paid)}`],
    [
      money(order.pending) < 0 ? 'Change due' : 'Pending',
      `${cur}${n2(Math.abs(order.pending))}`,
      money(order.pending) > 0 ? 'due' : '',
    ],
  ].filter(Boolean);

  // Keep the totals together: if they will not fit under the last line, they
  // start the next page rather than being split across two.
  const need = rows.length * 6.2 + 12;
  if (y + need > H - M) {
    doc.addPage();
    y = M;
  }

  y += 8;
  const labelX = right - 70;
  for (const [label, value, kind] of rows) {
    if (kind === 'grand') {
      doc.setDrawColor(...INK).setLineWidth(0.3).line(labelX, y - 4.6, right, y - 4.6);
      y += 1;
    }
    doc.setFont('helvetica', kind ? 'bold' : 'normal').setFontSize(kind === 'grand' ? 12 : 10);
    text(kind === 'due' ? [200, 52, 43] : kind === 'grand' ? INK : MUTED);
    doc.text(label, labelX, y);
    text(kind === 'due' ? [200, 52, 43] : INK);
    doc.text(value, right, y, { align: 'right' });
    y += kind === 'grand' ? 7.2 : 6.2;
  }

  return new File([doc.output('blob')], pdfFileName(order), { type: 'application/pdf' });
}
