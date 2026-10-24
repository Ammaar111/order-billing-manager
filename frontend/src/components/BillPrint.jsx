import React from 'react';
import { money, prettyDate, prettyTime } from '../utils.js';

const n2 = (v) => money(v).toFixed(2);

// On the roll a whole number prints bare — 1250, not 1250.00. Three characters
// per figure is a column's worth of paper at this width, and paise only appear
// on a bill that actually has them.
const nRoll = (v) => {
  const n = money(v);
  return Number.isInteger(n) ? String(n) : n.toFixed(2);
};

// Below this the six columns genuinely cannot hold a product name: the numbers
// alone want more than a 58mm roll has, and something would wrap mid-figure.
// Narrower paper falls back to a name on its own line.
const TABLE_MIN_MM = 70;

// Nothing is printed within this distance of either edge of the roll. A
// thermal head cannot reach the outer few millimetres of its paper, so on an
// 80mm roll the bill lives in the middle 70mm and the printer never has to
// clip anything.
const ROLL_SIDE_MM = 5;

/**
 * The bill as it goes on paper. One component covers both A4 and the thermal
 * roll — same figures, different stylesheet — so a receipt can never disagree
 * with the PDF of the same order.
 */
export default function BillPrint({ order, items, settings, mode = 'a4' }) {
  if (!order) return null;
  const cur = settings.currency || '₹';
  const withNames = order.bill_type !== 'qty-rate';
  const thermal = mode === 'thermal';
  const hasDiscount = withNames && items.some((it) => money(it.discount) > 0);
  const rollMm = Number(settings.thermal_width) || 80;
  // Only a narrow roll gives up the table; 80mm keeps all six columns.
  const stacked = thermal && withNames && rollMm < TABLE_MIN_MM;
  const fig = thermal ? nRoll : n2;
  // Columns in front of Qty; the Total qty label spans them.
  const beforeQty = withNames ? 2 : 1;

  return (
    <div
      className={`bill-paper ${thermal ? 'bill-thermal' : 'bill-a4'}`}
      style={thermal ? { width: `${rollMm - 2 * ROLL_SIDE_MM}mm` } : undefined}
    >
      <header className="bp-head">
        <h1>{settings.shop_name || 'Order Bill Manager'}</h1>
        {settings.shop_address ? <p>{settings.shop_address}</p> : null}
        {settings.shop_phone ? <p>{settings.shop_phone}</p> : null}
      </header>

      <div className="bp-meta">
        <div>
          <strong>Order #{order.order_no}</strong>
          <span>
            {prettyDate(order.order_date)}
            {' · '}
            {prettyTime()}
          </span>
        </div>
        <div className="bp-customer">
          <span>Name: {order.customer_name}</span>
          {order.customer_phone ? <span>Phone: {order.customer_phone}</span> : null}
          {order.address ? <span>Address: {order.address}</span> : null}
        </div>
      </div>

      {stacked ? (
        /* Only for rolls narrower than 70mm: the name across the paper, the
           arithmetic underneath, the way a till receipt does it. */
        <div className="bp-lines">
          {items.map((it) => (
            <div className="bp-line" key={it.sr_no}>
              <div className="bp-line-name">
                {it.sr_no}. {it.product_name}
              </div>
              <div className="bp-line-nums">
                <span>
                  {it.qty} × {fig(it.rate)}
                  {money(it.discount) > 0 ? ` less ${it.discount}%` : ''}
                </span>
                <span>{fig(it.line_total)}</span>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <table className={`bp-table${withNames ? '' : ' bp-no-names'}`}>
          <thead>
            <tr>
              <th className="c-sr">Sr</th>
              {withNames && <th className="c-name">Product</th>}
              <th className="c-num c-qty">Qty</th>
              <th className="c-num c-rate">Rate</th>
              {hasDiscount && <th className="c-num c-disc">{thermal ? '%' : 'Disc%'}</th>}
              <th className="c-num c-cost">Total</th>
            </tr>
          </thead>
          <tbody>
            {items.map((it) => (
              <tr key={it.sr_no}>
                <td className="c-sr">{it.sr_no}</td>
                {withNames && (
                  <td className="c-name">
                    {it.product_name}
                  </td>
                )}
                <td className="c-num c-qty">{it.qty}</td>
                <td className="c-num c-rate">{fig(it.rate)}</td>
                {hasDiscount && (
                  <td className="c-num c-disc">{it.discount ? it.discount : '—'}</td>
                )}
                <td className="c-num c-cost">{fig(it.line_total)}</td>
              </tr>
            ))}
            {/* The last row of the body, not a <tfoot>: a printer repeats a
                tfoot at the bottom of every page, so a long A4 bill would show
                the total on page one as well. */}
            <tr className="bp-qty-total">
              <td className="c-qty-label" colSpan={beforeQty}>
                {withNames ? 'Total qty' : 'Total'}
              </td>
              <td className="c-num c-qty">{money(order.total_qty)}</td>
              <td colSpan={hasDiscount ? 3 : 2} />
            </tr>
          </tbody>
        </table>
      )}

      <div className="bp-totals">
        {/* With the table, the total quantity already sits under the Qty
            column. The stacked layout has no such column, so it stays here. */}
        {stacked && (
          <div>
            <span>Total qty</span>
            <span>{money(order.total_qty)}</span>
          </div>
        )}
        <div>
          <span>Bill total</span>
          <span>
            {cur}
            {fig(order.items_total)}
          </span>
        </div>
        {money(order.total_discount) > 0 && (
          <div>
            <span>Discount given</span>
            <span>
              − {cur}
              {fig(order.total_discount)}
            </span>
          </div>
        )}
        <div>
          <span>Packing</span>
          <span>
            {cur}
            {fig(order.packing)}
          </span>
        </div>
        {money(order.round_off) !== 0 && (
          <div>
            <span>Round off</span>
            <span>
              {money(order.round_off) > 0 ? '+ ' : '− '}
              {cur}
              {fig(Math.abs(money(order.round_off)))}
            </span>
          </div>
        )}
        {money(order.old_balance) !== 0 && (
          <div>
            <span>Old balance</span>
            <span>
              {cur}
              {fig(order.old_balance)}
            </span>
          </div>
        )}
        <div className="bp-grand">
          <span>Grand total</span>
          <span>
            {cur}
            {fig(order.grand_total)}
          </span>
        </div>
        <div>
          <span>Amount received</span>
          <span>
            {cur}
            {fig(order.amount_paid)}
          </span>
        </div>
        <div className={money(order.pending) > 0 ? 'bp-pending' : ''}>
          <span>{money(order.pending) < 0 ? 'Change due' : 'Pending'}</span>
          <span>
            {cur}
            {fig(Math.abs(money(order.pending)))}
          </span>
        </div>
      </div>

      {order.note ? <p className="bp-note">{order.note}</p> : null}
      <p className="bp-thanks">Thank you</p>
    </div>
  );
}
