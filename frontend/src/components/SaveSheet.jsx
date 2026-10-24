import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import BillPrint from './BillPrint.jsx';
import { billText, downloadFile, downloadWord, printBill } from '../print.js';
import { billPdf } from '../pdf.js';
import { money, rupees } from '../utils.js';

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
  // The bill as an actual PDF file, built as soon as the sheet opens so that
  // tapping Share is instant. navigator.share only works inside the tap that
  // asked for it; if the file were still being drawn when the tap landed, the
  // browser would refuse and the bill would go out as bare text again.
  const [pdf, setPdf] = useState(null);
  const [pdfFailed, setPdfFailed] = useState(false);
  const [hint, setHint] = useState('');
  const items = order.items || [];
  const text = billText(order, items, settings);
  const cur = settings.currency || '₹';

  useEffect(() => {
    let alive = true;
    billPdf(order, items, settings)
      .then((f) => alive && setPdf(f))
      .catch(() => alive && setPdfFailed(true));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [order]);

  // Phones can hand a file straight to WhatsApp. That needs a secure page
  // (https or localhost), so a phone opening the shop PC over plain wi-fi gets
  // `false` here and falls back to saving the file instead.
  const canShareFile = !!(pdf && navigator.canShare && navigator.canShare({ files: [pdf] }));
  // Print dialogs are a desktop idea; on a phone "Save as PDF" should just save.
  const touch = window.matchMedia?.('(pointer: coarse)').matches;

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

  const shareFile = async () => {
    try {
      await navigator.share({ files: [pdf], title: `Order #${order.order_no}` });
      return true;
    } catch (err) {
      // Closing the share sheet is an answer, not a failure.
      return err?.name === 'AbortError';
    }
  };

  const share = async () => {
    if (canShareFile && (await shareFile())) return;
    setView('share');
  };

  const savePdf = () => {
    if (!pdf) return false;
    downloadFile(pdf.name, pdf);
    return true;
  };

  const sendWhatsApp = () => {
    // wa.me cannot carry a file, so the PDF is saved first and the biller
    // attaches it with the paperclip. The prefilled line says what it is.
    const saved = savePdf();
    setHint(
      saved
        ? 'PDF saved. In WhatsApp tap the paperclip, then Document, and choose it.'
        : ''
    );
    window.open(waHref, '_blank', 'noopener');
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
  // The bill itself travels as the PDF; the message only says what it is.
  const blurb = `${subject}\nTotal ${cur}${money(order.grand_total)}${
    order.pending > 0 ? `, pending ${cur}${money(order.pending)}` : ''
  }. Bill attached.`;
  const body = encodeURIComponent(blurb);
  // Mail keeps the full figures in the body: it is the one place a bill is read
  // without opening an attachment.
  const mailBody = encodeURIComponent(text);
  const phone = (order.customer_phone || '').replace(/\D/g, '');

  // Without a number wa.me still opens WhatsApp on its own contact picker, so
  // the button is worth showing either way.
  const waHref = `https://wa.me/${phone}?text=${body}`;

  const mailApps = [
    {
      key: 'gmail',
      name: 'Gmail',
      note: 'Opens in the browser',
      href: `https://mail.google.com/mail/?view=cm&fs=1&su=${su}&body=${mailBody}`,
    },
    {
      key: 'outlook',
      name: 'Outlook',
      note: 'Opens in the browser',
      href: `https://outlook.live.com/mail/0/deeplink/compose?subject=${su}&body=${mailBody}`,
    },
    {
      key: 'yahoo',
      name: 'Yahoo Mail',
      note: 'Opens in the browser',
      href: `https://compose.mail.yahoo.com/?subject=${su}&body=${mailBody}`,
    },
    {
      key: 'default',
      name: 'Mail app on this computer',
      note: 'Thunderbird, Outlook desktop, whatever is set up',
      href: `mailto:?subject=${su}&body=${mailBody}`,
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
            <button
              type="button"
              className="primary"
              onClick={() => (touch && pdf ? savePdf() : go('a4'))}
            >
              Save as PDF
              <small>
                {touch && pdf ? 'Saves to this phone' : 'Pick “Save as PDF” as the printer'}
              </small>
            </button>
            <button type="button" onClick={() => go('thermal')}>
              Print receipt
              <small>{settings.thermal_width || 80}mm thermal roll</small>
            </button>
            <button type="button" onClick={() => downloadWord(order, items, settings)}>
              Word document
              <small>Opens in Word or Docs</small>
            </button>
            <button type="button" onClick={share} disabled={!pdf && !pdfFailed}>
              Share
              <small>
                {!pdf && !pdfFailed ? 'Preparing the PDF…' : 'The bill as a PDF — WhatsApp, mail, anywhere'}
              </small>
            </button>
          </div>
        )}

        {view === 'share' && (
          <div className="sheet-actions">
            {canShareFile && (
              <button type="button" className="primary" onClick={shareFile}>
                Send the PDF
                <small>Pick WhatsApp or any app</small>
              </button>
            )}
            <button type="button" onClick={sendWhatsApp}>
              WhatsApp
              <small>
                {phone ? `To ${order.customer_phone}` : 'Pick the contact in WhatsApp'} · you attach the PDF
              </small>
            </button>
            <button type="button" onClick={() => setView('email')}>
              Email
              <small>Gmail, Outlook, Yahoo or your mail app</small>
            </button>
            <button type="button" onClick={() => setHint(savePdf() ? 'PDF saved.' : '')}>
              Download PDF
              <small>{pdf ? `${Math.max(1, Math.round(pdf.size / 1024))} KB` : 'Preparing…'}</small>
            </button>
            <button type="button" onClick={copy}>
              Copy bill text
              <small>{copied || 'Paste it anywhere'}</small>
            </button>
            {hint && <p className="sheet-hint">{hint}</p>}
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
                onClick={savePdf}
                {...(m.key === 'default' ? {} : { target: '_blank', rel: 'noreferrer' })}
              >
                {m.name}
                <small>{m.note}</small>
              </a>
            ))}
            <p className="sheet-hint">The PDF is saved as you open the mail — attach it there.</p>
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
