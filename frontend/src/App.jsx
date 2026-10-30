import React, { useCallback, useEffect, useState } from 'react';
import { api } from './api.js';
import Orders from './screens/Orders.jsx';
import Products from './screens/Products.jsx';
import Settings from './screens/Settings.jsx';
import BillForm from './screens/BillForm.jsx';
import Shortcuts from './components/Shortcuts.jsx';
import Keypad from './components/Keypad.jsx';

const TABS = [
  { key: 'orders', label: 'Orders', icon: '🧾' },
  { key: 'products', label: 'Products', icon: '📦' },
  { key: 'settings', label: 'Settings', icon: '⚙︎' },
];

export default function App() {
  const [tab, setTab] = useState('orders');
  const [bill, setBill] = useState(null); // { orderId } while a bill is open
  const [settings, setSettings] = useState(null);
  const [dirty, setDirty] = useState(false);
  const [showKeys, setShowKeys] = useState(false);
  // Bumped to ask whichever screen is open to do its shortcut's work. A counter
  // rather than a boolean, so pressing the same key twice fires twice.
  const [newProductSignal, setNewProductSignal] = useState(0);

  useEffect(() => {
    api.settings().then(setSettings).catch(() => setSettings({}));
  }, []);

  // Closing the tab mid-bill should not lose it silently.
  useEffect(() => {
    if (!dirty) return undefined;
    const warn = (e) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  // Merged, never replaced. A reply that happens to leave a key out should not
  // silently blank what is on screen — that is how Records ended up showing
  // zeros for a shop with money on the books.
  const mergeSettings = useCallback(
    (next) => setSettings((prev) => ({ ...prev, ...next })),
    []
  );

  const closeBill = useCallback(() => {
    setBill(null);
    setDirty(false);
    api.settings().then(mergeSettings).catch(() => {});
  }, [mergeSettings]);

  const startBill = useCallback((orderId = null) => setBill({ orderId, at: Date.now() }), []);

  // The shop-wide keys. Ctrl+N and Ctrl+D are claimed from the browser
  // deliberately — a till has no use for a new browser window mid-bill, and a
  // biller who has learned the key should not get Chrome's version of it.
  useEffect(() => {
    const onKey = (e) => {
      const ctrl = e.ctrlKey || e.metaKey;
      const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName);

      if (ctrl && e.key.toLowerCase() === 'n') {
        e.preventDefault();
        setShowKeys(false);
        startBill(null);
      } else if (ctrl && e.key.toLowerCase() === 'd') {
        e.preventDefault();
        setShowKeys(false);
        setBill(null);
        setTab('products');
        setNewProductSignal((n) => n + 1);
      } else if (e.key === '?' && !typing) {
        e.preventDefault();
        setShowKeys((v) => !v);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [startBill]);

  if (!settings) return <div className="boot">Loading…</div>;

  const openBill = (orderId) => startBill(orderId);

  return (
    <div className={`app${bill ? ' in-bill' : ''}`}>
      <header className="topbar">
        <button
          type="button"
          className="brand"
          onClick={() => {
            if (bill) closeBill();
            setTab('orders');
          }}
        >
          {settings.shop_name || 'Order Bill Manager'}
        </button>
        <nav className="tabs">
          {TABS.map((t) => (
            <button
              key={t.key}
              type="button"
              className={!bill && tab === t.key ? 'on' : ''}
              onClick={() => {
                if (bill) closeBill();
                setTab(t.key);
              }}
            >
              <span className="ic" aria-hidden="true">
                {t.icon}
              </span>
              {t.label}
            </button>
          ))}
          <button
            type="button"
            className="keys-btn"
            title="Keyboard shortcuts (?)"
            aria-label="Show keyboard shortcuts"
            onClick={() => setShowKeys(true)}
          >
            ⌨
          </button>
        </nav>
      </header>

      <main>
        {bill ? (
          <BillForm
            key={bill.at}
            orderId={bill.orderId}
            settings={settings}
            onDirtyChange={setDirty}
            onDone={closeBill}
          />
        ) : tab === 'orders' ? (
          <Orders
            settings={settings}
            onOpen={(id) => openBill(id)}
            onNew={() => openBill(null)}
          />
        ) : tab === 'products' ? (
          <Products settings={settings} newSignal={newProductSignal} />
        ) : (
          <Settings
            settings={settings}
            onSettings={mergeSettings}
            onOpenOrder={(id) => openBill(id)}
          />
        )}
      </main>

      {showKeys && <Shortcuts onClose={() => setShowKeys(false)} />}
      <Keypad />
    </div>
  );
}
