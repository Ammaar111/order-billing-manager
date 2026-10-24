import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { api } from '../api.js';
import ProductPicker from '../components/ProductPicker.jsx';
import SaveSheet from '../components/SaveSheet.jsx';
import Confirm from '../components/Confirm.jsx';
import { cleanNumeric, money, num, rupees, todayStr } from '../utils.js';

// Every cell in a row, left to right. Arrow keys walk this.
const COLUMNS = {
  full: ['sr', 'name', 'qty', 'rate', 'cost', 'discount'],
  'qty-rate': ['sr', 'qty', 'rate', 'cost'],
};

// What the Enter key visits. Cost is left out on purpose: it fills itself in
// from qty x rate, so stopping there on every single line is a keystroke the
// biller pays for hundreds of times a day. It stays reachable by Tab, by arrow
// key and by clicking, for the times a line really is rounded off by hand.
const ENTER_COLUMNS = {
  full: ['name', 'qty', 'rate', 'discount'],
  'qty-rate': ['qty', 'rate'],
};

// The cell that decides whether a row is a row at all. Enter on it while it is
// empty means "this bill has no more lines" and drops straight to packing.
const FIRST_REQUIRED = { full: 'name', 'qty-rate': 'qty' };

let rowSeq = 0;
const blankRow = () => ({
  key: ++rowSeq,
  product_id: '',
  product_name: '',
  qty: '',
  rate: '',
  cost: '',
  discount: '',
  // Cost follows qty x rate until someone types over it, then it stays put —
  // a shopkeeper rounding a line off should not have it recalculated away.
  costManual: false,
});

export default function BillForm({ orderId, settings, onDone, onDirtyChange }) {
  const [orderNo, setOrderNo] = useState(null);
  const [billType, setBillType] = useState('full');
  const [customer, setCustomer] = useState({ name: '', address: '', phone: '' });
  const [rows, setRows] = useState([blankRow()]);
  const [packing, setPacking] = useState('');
  const [oldBalance, setOldBalance] = useState('');
  const [paid, setPaid] = useState('');
  const [note, setNote] = useState('');
  const [orderDate, setOrderDate] = useState(todayStr());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(null);
  const [dirty, setDirty] = useState(false);
  const [completedAt, setCompletedAt] = useState('');
  const [justSaved, setJustSaved] = useState(true);
  const [askPrint, setAskPrint] = useState(false);
  const [autoPrint, setAutoPrint] = useState(false);
  const [roundOff, setRoundOff] = useState(0);
  // Whether the biller has typed into Amount received themselves — including
  // typing 0 for a credit sale. Until then it tracks the grand total live, so
  // a normal full-payment sale needs no typing at all; the moment it is
  // touched, by any value, it stops following and keeps exactly what was typed.
  const [paidTouched, setPaidTouched] = useState(false);

  const formRef = useRef(null);
  const packingRef = useRef(null);
  const nameRef = useRef(null);
  const pendingFocus = useRef(null);

  const cur = settings.currency || '₹';

  /* ------------------------------------------------------------- loading */

  useEffect(() => {
    let alive = true;
    if (orderId) {
      api.order(orderId).then((o) => {
        if (!alive) return;
        setOrderNo(o.order_no);
        setBillType(o.bill_type || 'full');
        setCustomer({
          name: o.customer_name,
          address: o.address || '',
          phone: o.customer_phone || '',
        });
        setPacking(o.packing ? String(o.packing) : '');
        setOldBalance(o.old_balance ? String(o.old_balance) : '');
        setPaid(o.amount_paid ? String(o.amount_paid) : '');
        setPaidTouched(true); // a saved order keeps what it was actually paid, never re-defaulted
        setRoundOff(o.round_off || 0);
        setNote(o.note || '');
        setOrderDate(o.order_date);
        setCompletedAt(o.completed_at || '');
        setRows(
          (o.items.length ? o.items : [{}]).map((it) => ({
            ...blankRow(),
            product_id: it.product_id || '',
            product_name: it.product_name || '',
            qty: it.qty ? String(it.qty) : '',
            rate: it.rate ? String(it.rate) : '',
            cost: it.cost ? String(it.cost) : '',
            discount: it.discount ? String(it.discount) : '',
            costManual: true,
          }))
        );
      });
    } else {
      // The number shown is only a preview; the one that sticks is taken by the
      // server inside the insert, so two tills cannot both claim #7.
      api.nextOrderNo().then((r) => alive && setOrderNo(r.order_no));
      setTimeout(() => nameRef.current?.focus(), 60);
    }
    return () => {
      alive = false;
    };
  }, [orderId]);

  const markDirty = useCallback(() => {
    setDirty(true);
    onDirtyChange?.(true);
  }, [onDirtyChange]);

  /* -------------------------------------------------------------- totals */

  const totals = useMemo(() => {
    let items = 0;
    let qty = 0;
    let discount = 0;
    const lines = rows.map((r) => {
      const cost = r.cost === '' ? money(num(r.qty) * num(r.rate)) : money(r.cost);
      const off = money((cost * num(r.discount)) / 100);
      const line = money(cost - off);
      if (r.product_name || num(r.qty) || cost) {
        items += line;
        discount += off;
        qty += num(r.qty);
      }
      return line;
    });
    const grandRaw = money(items + num(packing) + num(oldBalance));
    return {
      lines,
      items: money(items),
      qty: money(qty),
      discount: money(discount),
      grandRaw,
    };
  }, [rows, packing, oldBalance]);

  // The round-off only counts while it still rounds the CURRENT raw total to a
  // whole rupee. An edit that changes items or packing after a round-off was
  // chosen would otherwise carry a stale adjustment forward — either doing
  // nothing or pushing the new total further off a whole number — so instead
  // it is silently treated as not-yet-decided and the ask reappears for the
  // new figure. This also covers reopening a bill that was rounded off before:
  // its saved round_off still rounds its (unchanged) total, so it is trusted.
  const roundedGrand = money(totals.grandRaw + roundOff);
  const roundOffValid = roundOff === 0 || Number.isInteger(roundedGrand);
  const effectiveRoundOff = roundOffValid ? roundOff : 0;
  const grand = money(totals.grandRaw + effectiveRoundOff);
  const pending = money(grand - num(paid));
  const roundTarget = Math.round(totals.grandRaw);
  const needsRoundAsk =
    effectiveRoundOff === 0 && totals.grandRaw > 0 && !Number.isInteger(totals.grandRaw);

  // Amount received defaults to the bill total, so a plain full-payment sale
  // needs no typing — but the instant the biller types anything into that
  // field themselves, including 0 for a credit sale, it stops following and
  // keeps exactly what they typed from then on.
  useEffect(() => {
    if (!orderId && !paidTouched) setPaid(grand ? String(grand) : '');
  }, [grand, orderId, paidTouched]);

  const applyRoundOff = () => {
    setRoundOff(money(roundTarget - totals.grandRaw));
    markDirty();
  };
  const clearRoundOff = () => {
    setRoundOff(0);
    markDirty();
  };

  /* --------------------------------------------------------- row editing */

  const setRow = (i, patch) => {
    markDirty();
    setRows((rs) =>
      rs.map((r, j) => {
        if (j !== i) return r;
        const next = { ...r, ...patch };
        if (!next.costManual && ('qty' in patch || 'rate' in patch)) {
          const c = num(next.qty) * num(next.rate);
          next.cost = c ? String(money(c)) : '';
        }
        return next;
      })
    );
  };

  const addRow = () => {
    markDirty();
    setRows((rs) => {
      pendingFocus.current = `row-${rs.length}-${ENTER_COLUMNS[billType][0]}`;
      return [...rs, blankRow()];
    });
  };

  const removeRow = (i) => {
    markDirty();
    setRows((rs) => (rs.length === 1 ? [blankRow()] : rs.filter((_, j) => j !== i)));
  };

  useEffect(() => {
    if (!pendingFocus.current) return;
    const el = formRef.current?.querySelector(`[data-chain="${pendingFocus.current}"]`);
    pendingFocus.current = null;
    el?.focus();
  }, [rows.length]);

  /* --------------------------------------------------------- the keyboard */

  const at = (chain) => formRef.current?.querySelector(`[data-chain="${chain}"]`);

  const focusChain = (chain) => {
    const el = at(chain);
    if (!el) return false;
    el.focus();
    if (el.select) el.select();
    return true;
  };

  const jumpToPacking = () => {
    packingRef.current?.focus();
    packingRef.current?.select();
  };

  // Where Enter goes from a given cell. Kept as a lookup on the column list
  // rather than "the next focusable thing in the document", so leaving cost out
  // of the walk does not also make it unreachable.
  const enterTargetFrom = (rowIdx, col) => {
    const cols = ENTER_COLUMNS[billType];
    const i = cols.indexOf(col);
    if (i === -1) {
      // A cell Enter does not normally visit — cost, reached by arrow or click.
      // Carry on from wherever it sits in the walk.
      const all = COLUMNS[billType];
      const after = all.slice(all.indexOf(col) + 1).find((c) => cols.includes(c));
      return after ? { row: rowIdx, col: after } : { row: rowIdx + 1, col: cols[0] };
    }
    if (i < cols.length - 1) return { row: rowIdx, col: cols[i + 1] };
    return { row: rowIdx + 1, col: cols[0] };
  };

  const onKeyDown = (e) => {
    // Escape leaves the item table wherever it is and drops onto packing; from
    // there Enter walks down to amount received and then to Save. That is the
    // whole "finish this bill" gesture, one key.
    if (e.key === 'Escape') {
      e.preventDefault();
      jumpToPacking();
      return;
    }

    const el = e.target;
    const m = /^row-(\d+)-(.+)$/.exec(el.dataset?.chain || '');

    // Arrows move around the grid like a spreadsheet. Left and right only take
    // over at the ends of the text, so they still move the caret through a
    // half-typed number the rest of the time.
    if (m && ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
      const rowIdx = Number(m[1]);
      const col = m[2];
      const cols = COLUMNS[billType];
      const c = cols.indexOf(col);
      const caretAtStart = el.selectionStart === 0 && el.selectionEnd === 0;
      const caretAtEnd =
        el.selectionStart === el.value.length && el.selectionEnd === el.value.length;

      let target = null;
      if (e.key === 'ArrowUp' && rowIdx > 0) target = { row: rowIdx - 1, col };
      else if (e.key === 'ArrowDown' && rowIdx < rows.length - 1) target = { row: rowIdx + 1, col };
      else if (e.key === 'ArrowLeft' && caretAtStart && c > 0) target = { row: rowIdx, col: cols[c - 1] };
      else if (e.key === 'ArrowRight' && caretAtEnd && c < cols.length - 1)
        target = { row: rowIdx, col: cols[c + 1] };

      if (target) {
        e.preventDefault();
        focusChain(`row-${target.row}-${target.col}`);
      }
      return;
    }

    if (e.key !== 'Enter') return;
    // The end of the chain is the Save button, and Enter there presses it.
    // Done explicitly rather than left to the browser's default activation,
    // which does not fire reliably for a type="button" inside a form.
    if (el.tagName === 'BUTTON') {
      if (el.dataset?.chain) {
        e.preventDefault();
        el.click();
      }
      return;
    }
    if (!el.dataset?.chain) return;
    e.preventDefault();

    if (!m) {
      // Header and footer fields walk in plain document order.
      const all = Array.from(formRef.current?.querySelectorAll('[data-chain]') || []).filter(
        (n) => !n.disabled && n.offsetParent !== null
      );
      const next = all[all.indexOf(el) + 1];
      if (next) {
        next.focus();
        if (next.select) next.select();
      }
      return;
    }

    const rowIdx = Number(m[1]);
    const col = m[2];
    const row = rows[rowIdx];

    // Enter past an empty product name means there is nothing more to bill.
    // Skipping the one column a line cannot exist without is the biller saying
    // "done" — so go where they were heading anyway.
    if (col === FIRST_REQUIRED[billType] && !String(row?.[col === 'name' ? 'product_name' : col] ?? '').trim()) {
      jumpToPacking();
      return;
    }

    const target = enterTargetFrom(rowIdx, col);
    if (target.row < rows.length) {
      focusChain(`row-${target.row}-${target.col}`);
      return;
    }
    // Off the end of the last row: open the next one, unless it is still blank.
    if (row && (row.product_name || row.qty || row.cost)) {
      addRow();
    } else {
      jumpToPacking();
    }
  };

  /* ------------------------------------------------------------- saving */

  // Writes the bill and hands back what the database now holds. Everything that
  // prints, shares or completes goes through here first, so paper and books
  // can never show different figures.
  const persist = async () => {
    // No check on the customer name. A counter sale is nobody in particular and
    // the biller should not have to type a name to get paid; the server files a
    // blank one under "Cash".
    setSaving(true);
    setError('');
    const payload = {
      customer_name: customer.name,
      customer_phone: customer.phone,
      address: customer.address,
      packing: num(packing),
      amount_paid: num(paid),
      round_off: effectiveRoundOff,
      old_balance: num(oldBalance),
      bill_type: billType,
      note,
      order_date: orderDate,
      items: rows.map((r) => ({
        product_id: r.product_id,
        product_name: r.product_name,
        qty: num(r.qty),
        rate: num(r.rate),
        cost: r.cost === '' ? '' : num(r.cost),
        discount: num(r.discount),
      })),
    };
    try {
      const out = orderId
        ? await api.updateOrder(orderId, payload)
        : await api.createOrder(payload);
      setOrderNo(out.order_no);
      setDirty(false);
      onDirtyChange?.(false);
      return out;
    } catch (err) {
      setError(err.message);
      return null;
    } finally {
      setSaving(false);
    }
  };

  const save = async () => {
    const out = await persist();
    if (out) {
      setJustSaved(true);
      setSaved(out);
    }
  };

  // Reopening a bill months later to print or send it again. Unsaved edits are
  // written first so what leaves the shop matches what is on the books.
  const printOrShare = async () => {
    const wrote = dirty || !orderId;
    const out = wrote ? await persist() : await api.order(orderId);
    if (out) {
      setJustSaved(wrote);
      setSaved(out);
    }
  };

  const toggleCompleted = async () => {
    let id = orderId;
    if (!id || dirty) {
      const out = await persist();
      if (!out) return;
      id = out.id;
    }
    const out = await api.completeOrder(id, !completedAt);
    setCompletedAt(out.completed_at || '');
    // Back to the list, where a completed bill has just left the open orders —
    // seeing it go is the confirmation that the button worked.
    if (out.completed_at) onDone(out);
  };

  /* ------------------------------------------------- shortcuts on a bill */

  useEffect(() => {
    const onKey = (e) => {
      const ctrl = e.ctrlKey || e.metaKey;
      if (!ctrl) return;
      if (e.key === 'Enter') {
        // Ctrl+Enter is the "and print it" key, and printing paper is worth one
        // question first — a mistyped bill on the roll costs a reprint.
        e.preventDefault();
        setAskPrint(true);
      } else if (e.key.toLowerCase() === 's') {
        e.preventDefault();
        save();
      } else if (e.key.toLowerCase() === 'p') {
        e.preventDefault();
        printOrShare();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  /* --------------------------------------------------------------- view */

  const numProps = (value, onValue, chainName) => ({
    type: 'text',
    inputMode: 'decimal',
    // No type="number": the shop asked for no up/down arrows, and a number
    // input also changes value on a stray scroll over the cell.
    value,
    'data-chain': chainName,
    onChange: (e) => onValue(cleanNumeric(e.target.value)),
    onFocus: (e) => e.target.select(),
  });

  return (
    <div className="screen bill-screen">
      <div className="bill-top">
        <div className="bill-title">
          <h2>
            Order <span className="order-no">#{orderNo ?? '—'}</span>
            {!orderId && <span className="auto-tag">auto</span>}
            {completedAt && <span className="done-tag">completed</span>}
          </h2>
          <input
            className="date-input"
            type="date"
            value={orderDate}
            onChange={(e) => {
              setOrderDate(e.target.value);
              markDirty();
            }}
          />
        </div>
        <div className="segmented" role="group" aria-label="Bill type">
          <button
            type="button"
            className={billType === 'full' ? 'on' : ''}
            onClick={() => {
              setBillType('full');
              markDirty();
            }}
          >
            Full bill
          </button>
          <button
            type="button"
            className={billType === 'qty-rate' ? 'on' : ''}
            onClick={() => {
              setBillType('qty-rate');
              markDirty();
            }}
          >
            Qty &amp; rate
          </button>
        </div>
      </div>

      <form ref={formRef} onKeyDown={onKeyDown} onSubmit={(e) => e.preventDefault()}>
        <section className="card customer-card">
          <label className="field">
            <span>Customer name</span>
            <input
              ref={nameRef}
              data-chain="customer-name"
              type="text"
              autoComplete="off"
              value={customer.name}
              onChange={(e) => {
                setCustomer((c) => ({ ...c, name: e.target.value }));
                markDirty();
              }}
              placeholder="Cash"
            />
          </label>
          <label className="field">
            <span>Address</span>
            <input
              data-chain="customer-address"
              type="text"
              autoComplete="off"
              value={customer.address}
              onChange={(e) => {
                setCustomer((c) => ({ ...c, address: e.target.value }));
                markDirty();
              }}
              placeholder="Optional"
            />
          </label>
          <label className="field">
            <span>Phone</span>
            <input
              data-chain="customer-phone"
              type="text"
              inputMode="tel"
              autoComplete="off"
              value={customer.phone}
              onChange={(e) => {
                setCustomer((c) => ({ ...c, phone: e.target.value }));
                markDirty();
              }}
              placeholder="Optional"
            />
          </label>
        </section>

        <section className="card items-card">
          <div className="items-scroll">
            <table className={`items ${billType === 'qty-rate' ? 'no-names' : ''}`}>
              <thead>
                <tr>
                  <th className="c-sr">Sr</th>
                  {billType === 'full' && <th className="c-name">Product name</th>}
                  <th className="c-num">Qty</th>
                  <th className="c-num">Rate</th>
                  <th className="c-num">Cost</th>
                  {billType === 'full' && <th className="c-num">Disc %</th>}
                  <th className="c-act" aria-label="Remove" />
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={r.key}>
                    <td className="c-sr">
                      <input
                        className="sr-input"
                        data-chain={`row-${i}-sr`}
                        type="text"
                        readOnly
                        value={i + 1}
                        tabIndex={0}
                      />
                    </td>
                    {billType === 'full' && (
                      <td className="c-name">
                        <ProductPicker
                          data-chain={`row-${i}-name`}
                          currency={cur}
                          value={r.product_name}
                          onChange={(v) => setRow(i, { product_name: v, product_id: '' })}
                          onPick={(p) =>
                            setRow(i, {
                              product_name: p.name,
                              product_id: p.product_id,
                              // The catalogue price is a starting point; the
                              // rate cell is still the one that decides.
                              rate: p.cost ? String(p.cost) : r.rate,
                            })
                          }
                          placeholder="Type a name or an ID"
                        />
                      </td>
                    )}
                    <td className="c-num">
                      <input {...numProps(r.qty, (v) => setRow(i, { qty: v }), `row-${i}-qty`)} />
                    </td>
                    <td className="c-num">
                      <input {...numProps(r.rate, (v) => setRow(i, { rate: v }), `row-${i}-rate`)} />
                    </td>
                    <td className="c-num">
                      <input
                        {...numProps(
                          r.cost,
                          (v) => setRow(i, { cost: v, costManual: v !== '' }),
                          `row-${i}-cost`
                        )}
                        className={r.costManual ? 'cost-manual' : ''}
                        title={r.costManual ? 'Typed by hand' : 'Qty × rate'}
                      />
                    </td>
                    {billType === 'full' && (
                      <td className="c-num">
                        <input
                          {...numProps(
                            r.discount,
                            (v) => setRow(i, { discount: v }),
                            `row-${i}-discount`
                          )}
                          placeholder="—"
                        />
                      </td>
                    )}
                    <td className="c-act">
                      <button
                        type="button"
                        className="row-x"
                        tabIndex={-1}
                        onClick={() => removeRow(i)}
                        aria-label={`Remove row ${i + 1}`}
                      >
                        ×
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="items-foot">
            <button type="button" className="ghost" onClick={addRow}>
              + Add row
            </button>
            <p className="hint">
              <kbd>Enter</kbd> moves along and opens the next row · <kbd>Esc</kbd> jumps to
              packing
            </p>
            <span className="total-qty">Total qty {totals.qty}</span>
          </div>
        </section>

        <section className="card totals-card">
          <label className="field money-field">
            <span>Packing</span>
            <input
              ref={packingRef}
              {...numProps(packing, (v) => {
                setPacking(v);
                markDirty();
              }, 'packing')}
              placeholder="0"
            />
          </label>
          <label className="field money-field">
            <span>Old balance</span>
            <input
              {...numProps(oldBalance, (v) => {
                setOldBalance(v);
                markDirty();
              }, 'old-balance')}
              placeholder="0"
            />
          </label>
          <label className="field money-field">
            <span>Amount received</span>
            <input
              {...numProps(paid, (v) => {
                setPaid(v);
                setPaidTouched(true);
                markDirty();
              }, 'amount-received')}
              placeholder="0"
            />
          </label>
          <div className="totals-read">
            <div>
              <span>Total qty</span>
              <strong>{totals.qty}</strong>
            </div>
            <div>
              <span>Bill total</span>
              <strong>{rupees(totals.items, cur)}</strong>
            </div>
            {num(oldBalance) > 0 && (
              <div>
                <span>Old balance</span>
                <strong>{rupees(num(oldBalance), cur)}</strong>
              </div>
            )}
            {totals.discount > 0 && (
              <div className="saved">
                <span>Discount given</span>
                <strong>− {rupees(totals.discount, cur)}</strong>
              </div>
            )}
            {needsRoundAsk && (
              <div className="round-ask">
                <span>
                  Round {rupees(totals.grandRaw, cur)} to {rupees(roundTarget, cur)}?
                </span>
                <button type="button" className="chip" onClick={applyRoundOff}>
                  Round off
                </button>
              </div>
            )}
            {effectiveRoundOff !== 0 && (
              <div className="saved round-off-note">
                <span>Round off</span>
                <strong>
                  {effectiveRoundOff > 0 ? '+ ' : '− '}
                  {rupees(Math.abs(effectiveRoundOff), cur)}
                  <button type="button" className="undo" onClick={clearRoundOff}>
                    undo
                  </button>
                </strong>
              </div>
            )}
            <div className="grand">
              <span>Grand total</span>
              <strong>{rupees(grand, cur)}</strong>
            </div>
            <div>
              <span>Received</span>
              <strong>{rupees(num(paid), cur)}</strong>
            </div>
            {/* Handing over more than the bill is change owed back, not a
                negative debt. "Pending ₹-35" is a sum nobody at a counter
                should have to translate. */}
            {pending < 0 ? (
              <div className="saved">
                <span>Change due</span>
                <strong>{rupees(-pending, cur)}</strong>
              </div>
            ) : (
              <div className={pending > 0 ? 'due' : ''}>
                <span>Pending</span>
                <strong>{rupees(pending, cur)}</strong>
              </div>
            )}
          </div>
        </section>

        {error && <p className="error">{error}</p>}

        <div className="bill-actions">
          <button
            type="button"
            className="primary"
            data-chain="save"
            onClick={save}
            disabled={saving}
          >
            {saving ? 'Saving…' : orderId ? 'Save changes' : 'Save'}
          </button>
          {orderId && (
            <button type="button" onClick={printOrShare} disabled={saving}>
              Print / share
            </button>
          )}
          <button
            type="button"
            className={completedAt ? '' : 'complete'}
            onClick={toggleCompleted}
            disabled={saving}
          >
            {completedAt ? 'Reopen order' : '✓ Mark completed'}
          </button>
          <button type="button" className="ghost" onClick={() => onDone(null)}>
            {dirty ? 'Discard' : 'Back'}
          </button>
        </div>
      </form>

      {askPrint && (
        <Confirm
          title="Print this bill?"
          message={`Order #${orderNo ?? '—'} · ${rupees(grand, cur)}. It will be saved first, then sent to the printer.`}
          yes="Print"
          no="Cancel"
          onNo={() => setAskPrint(false)}
          onYes={async () => {
            setAskPrint(false);
            const out = await persist();
            if (out) {
              setJustSaved(true);
              setAutoPrint(true);
              setSaved(out);
            }
          }}
        />
      )}

      {saved && (
        <SaveSheet
          order={saved}
          settings={settings}
          justSaved={justSaved}
          autoPrint={autoPrint}
          onClose={() => {
            setSaved(null);
            setAutoPrint(false);
          }}
          onDone={() => onDone(saved)}
        />
      )}
    </div>
  );
}
