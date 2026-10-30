import React, { useEffect, useMemo, useState } from 'react';
import { api } from '../api.js';
import { MONTHS, prettyDate, rupees, todayStr } from '../utils.js';
import { numeric } from '../keypad.js';

/* ------------------------------------------------------ lifetime orders */

function Calendar({ settings, onOpen, onClose }) {
  const [byDate, setByDate] = useState([]);
  const [cursor, setCursor] = useState(() => {
    const d = new Date();
    return { y: d.getFullYear(), m: d.getMonth() };
  });
  const [day, setDay] = useState(null);
  const [dayOrders, setDayOrders] = useState([]);
  const cur = settings.currency || '₹';

  useEffect(() => {
    api.ordersByDate().then(setByDate).catch(() => setByDate([]));
  }, []);

  useEffect(() => {
    if (!day) return;
    // History means everything that day, open and completed alike.
    api
      .orders({ date: day, scope: 'all' })
      .then(setDayOrders)
      .catch(() => setDayOrders([]));
  }, [day]);

  const index = useMemo(() => {
    const m = new Map();
    for (const r of byDate) m.set(r.order_date, r);
    return m;
  }, [byDate]);

  const first = new Date(cursor.y, cursor.m, 1);
  const daysInMonth = new Date(cursor.y, cursor.m + 1, 0).getDate();
  const lead = (first.getDay() + 6) % 7; // weeks start Monday
  const cells = [
    ...Array(lead).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  const iso = (d) =>
    `${cursor.y}-${String(cursor.m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

  const monthTotal = byDate
    .filter((r) => r.order_date.startsWith(`${cursor.y}-${String(cursor.m + 1).padStart(2, '0')}`))
    .reduce((a, r) => a + (r.total || 0), 0);

  const step = (n) => {
    setDay(null);
    setCursor(({ y, m }) => {
      const d = new Date(y, m + n, 1);
      return { y: d.getFullYear(), m: d.getMonth() };
    });
  };

  return (
    <>
      <div className="sheet-backdrop" onClick={onClose} role="presentation" />
      <div className="sheet sheet-wide" role="dialog" aria-label="Lifetime orders">
        <div className="sheet-head">
          <h3>Lifetime orders</h3>
          <p>Every order the shop has ever raised, by the day it was raised.</p>
        </div>

        <div className="cal">
          <div className="cal-head">
            <button type="button" className="chip" onClick={() => step(-1)} aria-label="Previous month">
              ‹
            </button>
            <strong>
              {MONTHS[cursor.m]} {cursor.y}
            </strong>
            <button type="button" className="chip" onClick={() => step(1)} aria-label="Next month">
              ›
            </button>
            <span className="muted small">{rupees(monthTotal, cur)} this month</span>
          </div>
          <div className="cal-grid">
            {['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'].map((d) => (
              <span key={d} className="cal-dow">
                {d}
              </span>
            ))}
            {cells.map((d, i) => {
              if (d === null) return <span key={`e${i}`} className="cal-cell empty" />;
              const key = iso(d);
              const info = index.get(key);
              return (
                <button
                  key={key}
                  type="button"
                  className={`cal-cell${info ? ' has' : ''}${day === key ? ' on' : ''}${
                    key === todayStr() ? ' today' : ''
                  }`}
                  onClick={() => setDay(key)}
                  disabled={!info}
                >
                  <span className="cal-n">{d}</span>
                  {info && <span className="cal-dot">{info.orders}</span>}
                </button>
              );
            })}
          </div>
        </div>

        {day && (
          <div className="cal-day">
            <h4>{prettyDate(day)}</h4>
            {dayOrders.length === 0 ? (
              <p className="muted">Nothing on this day.</p>
            ) : (
              <ul className="mini-list">
                {dayOrders.map((o) => (
                  <li key={o.id}>
                    <button type="button" onClick={() => onOpen(o.id)}>
                      <span>#{o.order_no}</span>
                      <strong>{o.customer_name}</strong>
                      <span className="muted">{rupees(o.grand_total, cur)}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        <div className="sheet-foot">
          <button type="button" className="primary" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </>
  );
}

/* ------------------------------------------------------------ customers */

function Customers({ settings, onClose }) {
  const [rows, setRows] = useState([]);
  const [q, setQ] = useState('');
  const cur = settings.currency || '₹';

  useEffect(() => {
    api.customers().then(setRows).catch(() => setRows([]));
  }, []);

  const shown = rows
    .filter((r) => `${r.name} ${r.phone || ''}`.toLowerCase().includes(q.trim().toLowerCase()))
    // Whoever owes money comes first — that is the reason this list gets opened.
    .sort((a, b) => (b.pending || 0) - (a.pending || 0));

  const owed = shown.reduce((sum, r) => sum + (r.pending || 0), 0);

  return (
    <>
      <div className="sheet-backdrop" onClick={onClose} role="presentation" />
      <div className="sheet sheet-wide" role="dialog" aria-label="Customers">
        <div className="sheet-head">
          <h3>Customers</h3>
          <p>Built from the orders themselves — nothing extra to keep up to date.</p>
        </div>
        <input
          className="search"
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search customers"
        />
        <div className={`pending-hero${owed > 0 ? ' owed' : ''}`}>
          <span className="ph-label">
            {q ? 'Pending from these customers' : 'Pending from everyone'}
          </span>
          <strong>{rupees(owed, cur)}</strong>
          <span className="ph-sub">
            {shown.length} customer{shown.length === 1 ? '' : 's'} listed
          </span>
        </div>
        {shown.length === 0 ? (
          <p className="muted pad">No customers yet.</p>
        ) : (
          <ul className="mini-list customers">
            {shown.map((c) => (
              <li key={c.name}>
                <div className="cust">
                  <strong>{c.name}</strong>
                  <span className="muted">
                    {c.phone || 'no phone'}
                    {c.address ? ` · ${c.address}` : ''}
                  </span>
                  <span className="cust-nums">
                    <span>
                      {c.orders} order{c.orders === 1 ? '' : 's'}
                    </span>
                    <span>{rupees(c.spent, cur)} total</span>
                    {c.pending > 0 ? (
                      <span className="due">{rupees(c.pending, cur)} pending</span>
                    ) : null}
                    <span className="muted">last {prettyDate(c.last_order)}</span>
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
        <div className="sheet-foot">
          <button type="button" className="primary" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </>
  );
}

/* --------------------------------------------------------- clear data */

function ClearData({ onClose, onCleared }) {
  const [typed, setTyped] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const ready = typed === 'CONFIRM';

  const run = async () => {
    setBusy(true);
    try {
      const out = await api.clearData(typed);
      onCleared(out.backup);
    } catch (e) {
      setError(e.message);
      setBusy(false);
    }
  };

  return (
    <>
      <div className="sheet-backdrop" onClick={onClose} role="presentation" />
      <div className="sheet danger" role="dialog" aria-label="Clear all data">
        <div className="sheet-head">
          <h3>Clear all data</h3>
          <p>
            Every order, every bill line and every product goes. Your shop details, paper size
            and other settings stay. A copy of the database is written to{' '}
            <code>backend/backups/</code> first — that is the only way back.
          </p>
        </div>
        <label className="field">
          <span>
            Type <strong>CONFIRM</strong> in capitals
          </span>
          <input
            type="text"
            value={typed}
            autoFocus
            onChange={(e) => setTyped(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && ready) run();
            }}
            placeholder="CONFIRM"
          />
        </label>
        {error && <p className="error">{error}</p>}
        <div className="sheet-foot">
          <button type="button" className="ghost" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="destructive" disabled={!ready || busy} onClick={run}>
            {busy ? 'Clearing…' : 'Clear everything'}
          </button>
        </div>
      </div>
    </>
  );
}

/* ------------------------------------------------------------- screen */

export default function Settings({ settings, onSettings, onOpenOrder }) {
  const [form, setForm] = useState(settings);
  const [saved, setSaved] = useState('');
  const [panel, setPanel] = useState(null);
  const stats = settings._stats || {};
  const cur = settings.currency || '₹';

  useEffect(() => setForm(settings), [settings]);

  const save = async (patch) => {
    const next = { ...form, ...patch };
    setForm(next);
    const out = await api.saveSettings({
      shop_name: next.shop_name,
      shop_phone: next.shop_phone,
      shop_address: next.shop_address,
      thermal_width: next.thermal_width,
      currency: next.currency,
    });
    onSettings(out);
    setSaved('Saved');
    setTimeout(() => setSaved(''), 1600);
  };

  const backup = async () => {
    const out = await api.backup();
    setSaved(`Copy written to backups/${out.backup}`);
    setTimeout(() => setSaved(''), 4000);
  };

  return (
    <div className="screen">
      <div className="screen-head">
        <h2>Settings</h2>
        {saved && <span className="saved-tag">{saved}</span>}
      </div>

      <div className="settings-grid">
        <section className="card">
          <h3>Shop</h3>
          <p className="muted small">These appear at the top of every bill and receipt.</p>
          <label className="field">
            <span>Shop name</span>
            <input
              type="text"
              value={form.shop_name || ''}
              onChange={(e) => setForm({ ...form, shop_name: e.target.value })}
              onBlur={() => save({})}
            />
          </label>
          <label className="field">
            <span>Phone</span>
            <input
              type="text"
              value={form.shop_phone || ''}
              onChange={(e) => setForm({ ...form, shop_phone: e.target.value })}
              onBlur={() => save({})}
            />
          </label>
          <label className="field">
            <span>Address</span>
            <input
              type="text"
              value={form.shop_address || ''}
              onChange={(e) => setForm({ ...form, shop_address: e.target.value })}
              onBlur={() => save({})}
            />
          </label>
        </section>

        <section className="card">
          <h3>Thermal paper</h3>
          <p className="muted small">
            The width of the roll in your printer. The receipt is laid out to fit it exactly, so
            getting this wrong is what cuts the totals off the right-hand edge.
          </p>
          <div className="segmented wide">
            {['58', '80'].map((w) => (
              <button
                key={w}
                type="button"
                className={String(form.thermal_width) === w ? 'on' : ''}
                onClick={() => save({ thermal_width: w })}
              >
                {w}mm
              </button>
            ))}
            <button
              type="button"
              className={!['58', '80'].includes(String(form.thermal_width)) ? 'on' : ''}
              onClick={() => save({ thermal_width: '76' })}
            >
              Other
            </button>
          </div>
          {!['58', '80'].includes(String(form.thermal_width)) && (
            <label className="field">
              <span>Width in mm</span>
              <input
                type="text"
                {...numeric()}
                value={form.thermal_width || ''}
                onChange={(e) =>
                  setForm({ ...form, thermal_width: e.target.value.replace(/[^0-9.]/g, '') })
                }
                onBlur={() => save({})}
              />
            </label>
          )}
        </section>

        <section className="card">
          <h3>Records</h3>

          {/* Everything anyone still owes the shop, in one number. Per-customer
              amounts live behind the Customers button; this is the total the
              owner actually wants at a glance. */}
          <div className={`pending-hero${stats.pending > 0 ? ' owed' : ''}`}>
            <span className="ph-label">Pending from everyone</span>
            <strong>{rupees(stats.pending || 0, cur)}</strong>
            <span className="ph-sub">
              {stats.pending > 0
                ? `${stats.customers_owing || 0} customer${
                    stats.customers_owing === 1 ? '' : 's'
                  } · ${stats.unpaid_orders || 0} bill${
                    stats.unpaid_orders === 1 ? '' : 's'
                  } unpaid`
                : 'Everyone is settled up'}
            </span>
          </div>

          <div className="stat-row">
            <div>
              <strong>{stats.orders || 0}</strong>
              <span>orders</span>
            </div>
            <div>
              <strong>{stats.open || 0}</strong>
              <span>still open</span>
            </div>
            <div>
              <strong>{rupees(stats.revenue || 0, cur)}</strong>
              <span>billed</span>
            </div>
            <div>
              <strong>{rupees(stats.collected || 0, cur)}</strong>
              <span>collected</span>
            </div>
            <div>
              <strong>{stats.products || 0}</strong>
              <span>products</span>
            </div>
          </div>
          <div className="button-row">
            <button type="button" onClick={() => setPanel('calendar')}>
              Lifetime orders
            </button>
            <button type="button" onClick={() => setPanel('customers')}>
              Customers
            </button>
            <button type="button" onClick={backup}>
              Back up now
            </button>
          </div>
        </section>

        <section className="card danger-card">
          <h3>Clear data</h3>
          <p className="muted small">
            Wipes orders and products. Settings are kept, and a copy of the database is saved
            first.
          </p>
          <button type="button" className="destructive" onClick={() => setPanel('clear')}>
            Clear data
          </button>
        </section>
      </div>

      {panel === 'calendar' && (
        <Calendar
          settings={settings}
          onClose={() => setPanel(null)}
          onOpen={(id) => {
            setPanel(null);
            onOpenOrder(id);
          }}
        />
      )}
      {panel === 'customers' && (
        <Customers settings={settings} onClose={() => setPanel(null)} />
      )}
      {panel === 'clear' && (
        <ClearData
          onClose={() => setPanel(null)}
          onCleared={(file) => {
            setPanel(null);
            setSaved(`Cleared. Copy kept as backups/${file}`);
            api.settings().then(onSettings);
            setTimeout(() => setSaved(''), 6000);
          }}
        />
      )}
    </div>
  );
}
