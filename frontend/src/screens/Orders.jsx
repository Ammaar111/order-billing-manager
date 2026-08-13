import React, { useEffect, useState } from 'react';
import { api } from '../api.js';
import { prettyDate, rupees } from '../utils.js';

export default function Orders({ settings, onOpen, onNew }) {
  const [q, setQ] = useState('');
  // The counter only wants what is still open. Completed bills are kept for
  // good and are one tap away, but they are not in the way.
  const [scope, setScope] = useState('active');
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const cur = settings.currency || '₹';

  const load = (query, sc) => {
    setLoading(true);
    api
      .orders({ q: query, scope: sc })
      .then(setOrders)
      .catch(() => setOrders([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    const t = setTimeout(() => load(q, scope), q ? 160 : 0);
    return () => clearTimeout(t);
  }, [q, scope]);

  const remove = async (o) => {
    if (!window.confirm(`Delete order #${o.order_no} for ${o.customer_name}? This cannot be undone.`))
      return;
    await api.deleteOrder(o.id);
    load(q, scope);
  };

  const reopen = async (o) => {
    await api.completeOrder(o.id, false);
    load(q, scope);
  };

  const empty = q
    ? 'No order matches that.'
    : scope === 'completed'
      ? 'No completed orders yet.'
      : 'No open orders.';

  return (
    <div className="screen">
      <div className="screen-head">
        <h2>Orders</h2>
        <div className="head-tools">
          <div className="segmented" role="group" aria-label="Which orders">
            <button
              type="button"
              className={scope === 'active' ? 'on' : ''}
              onClick={() => setScope('active')}
            >
              Open
            </button>
            <button
              type="button"
              className={scope === 'completed' ? 'on' : ''}
              onClick={() => setScope('completed')}
            >
              Completed
            </button>
          </div>
          <input
            className="search"
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search by number, name or phone"
          />
          <button
            type="button"
            className={editing ? 'chip on' : 'chip'}
            onClick={() => setEditing((v) => !v)}
          >
            {editing ? 'Done' : 'Edit'}
          </button>
          <button type="button" className="primary" onClick={onNew}>
            + New order
          </button>
        </div>
      </div>

      {loading ? (
        <p className="muted pad">Loading…</p>
      ) : orders.length === 0 ? (
        <div className="empty">
          <p>{empty}</p>
          {!q && scope === 'active' && (
            <button type="button" className="primary" onClick={onNew}>
              Make a bill
            </button>
          )}
        </div>
      ) : (
        <ul className="order-list">
          {orders.map((o) => (
            <li key={o.id}>
              <button type="button" className="order-card" onClick={() => onOpen(o.id)}>
                <span className="oc-no">#{o.order_no}</span>
                <span className="oc-main">
                  <strong>{o.customer_name}</strong>
                  <span className="muted">
                    {o.customer_phone || 'no phone'} · {prettyDate(o.order_date)}
                  </span>
                </span>
                <span className="oc-money">
                  <strong>{rupees(o.grand_total, cur)}</strong>
                  {o.pending > 0 ? (
                    <span className="due">{rupees(o.pending, cur)} due</span>
                  ) : (
                    <span className="paid">paid</span>
                  )}
                </span>
              </button>
              {scope === 'completed' && !editing && (
                <button type="button" className="chip" onClick={() => reopen(o)}>
                  Reopen
                </button>
              )}
              {editing && (
                <button type="button" className="del" onClick={() => remove(o)}>
                  Delete
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
