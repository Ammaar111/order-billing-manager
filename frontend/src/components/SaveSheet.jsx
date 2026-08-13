import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import BillPrint from './BillPrint.jsx';
import { billText, downloadWord, printBill } from '../print.js';
import { rupees } from '../utils.js';

/**
 * What happens the moment a bill is saved: the shopkeeper is asked where it
 * should go — a PDF on the machine, the thermal roll, Word, or someone's phone.
 * Nothing here can change the figures; the order is already in the database.
 */
export default function SaveSheet({
  order,
  settings,
  onClose,
  onDone,
  justSaved = true,
  autoPrint = false,
}) {
  const [mode, setMode] = useState('a4');
  // 'main' → 'share' → 'email'. Email is its own step because a shop machine
  // usually has no mail program registered, so a bare mailto: link looks like a
  // dead button; the webmail sites always work in the browser that is open.
  const [view, setView] = useState('main');
  const [copied, setCopied] = useState('');
  const items = order.items || [];
  const text = billText(order, items, settings);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const go = async (m) => {
    setMode(m);
    // One paint so the right paper layout is mounted before the dialog opens.
    await new Promise((r) => requestAnimationFrame(r));
    await printBill(m, settings.thermal_width);
  };

  // Ctrl+Enter already asked. Go straight to the roll rather than making the
  // biller pick "Print receipt" out of a menu they did not ask to see.
  useEffect(() => {
    if (autoPrint) go('thermal');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoPrint]);

  const share = async () => {
    // A phone has its own share sheet and it is better than anything here.
    // A desktop does not — navigator.share simply does not exist on Linux
    // Chrome — so that falls through to the list below.
    if (navigator.share) {
      try {
        await navigator.share({ title: `Order #${order.order_no}`, text });
        return;
      } catch {
        // Cancelled or not permitted — fall through to the links.
      }
    }
    setView('share');
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied('Copied');
    } catch {
      setCopied('Could not copy — select the text instead');
    }
    setTimeout(() => setCopied(''), 2200);
  };

  const subject = `Order #${order.order_no} — ${settings.shop_name || 'Bill'}`;
  const su = encodeURIComponent(subject);
  const body = encodeURIComponent(text);
  const phone = (order.customer_phone || '').replace(/\D/g, '');

  // Without a number wa.me still opens WhatsApp on its own contact picker, so
  // the button is worth showing either way.
  const waHref = `https://wa.me/${phone}?text=${body}`;

  const mailApps = [
    {
      key: 'gmail',
      name: 'Gmail',
      note: 'Opens in the browser',
      href: `https://mail.google.com/mail/?view=cm&fs=1&su=${su}&body=${body}`,
    },
    {
      key: 'outlook',
      name: 'Outlook',
      note: 'Opens in the browser',
      href: `https://outlook.live.com/mail/0/deeplink/compose?subject=${su}&body=${body}`,
    },
    {
      key: 'yahoo',
      name: 'Yahoo Mail',
      note: 'Opens in the browser',
      href: `https://compose.mail.yahoo.com/?subject=${su}&body=${body}`,
    },
    {
      key: 'default',
      name: 'Mail app on this computer',
      note: 'Thunderbird, Outlook desktop, whatever is set up',
      href: `mailto:?subject=${su}&body=${body}`,
    },
  ];

  return (
    <>
      <div className="sheet-backdrop" onClick={onClose} role="presentation" />
      <div className="sheet" role="dialog" aria-label={`Order ${order.order_no} saved`}>
        <div className="sheet-head">
          {justSaved && (
            <span className="tick" aria-hidden="true">
              ✓
            </span>
          )}
          {/* Reopening an old bill has not saved anything, and saying so would
              be a small lie the shopkeeper would learn to distrust. */}
          <h3>
            Order #{order.order_no}
            {justSaved ? ' saved' : ''}
          </h3>
          <p>
            {order.customer_name} · {rupees(order.grand_total, settings.currency)}
            {order.pending > 0 ? ` · ${rupees(order.pending, settings.currency)} pending` : ''}
          </p>
        </div>

        {view === 'main' && (
          <div className="sheet-actions">
            <button type="button" className="primary" onClick={() => go('a4')}>
              Save as PDF
              <small>Pick “Save as PDF” as the printer</small>
            </button>
            <button type="button" onClick={() => go('thermal')}>
              Print receipt
              <small>{settings.thermal_width || 80}mm thermal roll</small>
            </button>
            <button type="button" onClick={() => downloadWord(order, items, settings)}>
              Word document
              <small>Opens in Word or Docs</small>
            </button>
            <button type="button" onClick={share}>
              Share
              <small>WhatsApp, mail, anywhere</small>
            </button>
          </div>
        )}

        {view === 'share' && (
          <div className="sheet-actions">
            <a className="btn-like" href={waHref} target="_blank" rel="noreferrer">
              WhatsApp
              <small>{phone ? `To ${order.customer_phone}` : 'Pick the contact in WhatsApp'}</small>
            </a>
            <button type="button" onClick={() => setView('email')}>
              Email
              <small>Gmail, Outlook, Yahoo or your mail app</small>
            </button>
            <button type="button" onClick={copy}>
              Copy bill text
              <small>{copied || 'Paste it anywhere'}</small>
            </button>
            <button type="button" className="ghost" onClick={() => setView('main')}>
              Back
            </button>
          </div>
        )}

        {view === 'email' && (
          <div className="sheet-actions">
            {mailApps.map((m) => (
              <a
                key={m.key}
                className="btn-like"
                href={m.href}
                {...(m.key === 'default' ? {} : { target: '_blank', rel: 'noreferrer' })}
              >
                {m.name}
                <small>{m.note}</small>
              </a>
            ))}
            <button type="button" className="ghost" onClick={() => setView('share')}>
              Back
            </button>
          </div>
        )}

        <div className="sheet-foot">
          <button type="button" className="ghost" onClick={onClose}>
            Keep editing
          </button>
          <button type="button" className="primary" onClick={onDone}>
            Done
          </button>
        </div>
      </div>

      {/* Off screen on a monitor, the only thing on the page in a print.
          Portalled onto <body> rather than left where it is rendered: printing
          hides .app, and a display:none ancestor takes its whole subtree with
          it — no display:block on the child can bring it back. Nested inside,
          this printed a blank sheet. It has to be .app's sibling. */}
      {createPortal(
        <div className="print-only">
          <BillPrint order={order} items={items} settings={settings} mode={mode} />
        </div>,
        document.body
      )}
    </>
  );
}
