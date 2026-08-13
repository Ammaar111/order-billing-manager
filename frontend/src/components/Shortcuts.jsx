import React, { useEffect } from 'react';

/**
 * The whole keyboard, written down. A biller who never touches the mouse still
 * has to be told what the keys are once, and this is cheaper to keep honest
 * than a page in a manual nobody opens.
 */
export const SHORTCUT_GROUPS = [
  {
    title: 'Anywhere in the app',
    keys: [
      ['Ctrl + N', 'New bill'],
      ['Ctrl + D', 'New product'],
      ['Ctrl + P', 'Print or share this bill'],
      ['Ctrl + Enter', 'Print this bill (asks first)'],
      ['Ctrl + S', 'Save the bill'],
      ['?', 'Show this list'],
      ['Esc', 'Close whatever is open'],
    ],
  },
  {
    title: 'Filling a bill',
    keys: [
      ['Enter', 'Next box, and off the end of a row it opens the next row'],
      ['Enter on an empty product', 'Bill is finished — jumps to Packing'],
      ['Esc', 'Jump straight to Packing from anywhere in the table'],
      ['↑ ↓', 'Same column, row above or below'],
      ['← →', 'Previous or next column, at the ends of the text'],
      ['Tab', 'Every box including Cost'],
    ],
  },
  {
    title: 'Choosing a product',
    keys: [
      ['Type an ID or a name', 'The matching products appear beside the box'],
      ['↑ ↓', 'Move through the list'],
      ['Enter', 'Take the highlighted one and go on to Qty'],
      ['Esc', 'Close the list without taking anything'],
    ],
  },
];

export default function Shortcuts({ onClose }) {
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <>
      <div className="sheet-backdrop" onClick={onClose} role="presentation" />
      <div className="sheet sheet-wide" role="dialog" aria-label="Keyboard shortcuts">
        <div className="sheet-head">
          <h3>Keyboard shortcuts</h3>
          <p>The whole bill can be typed without touching the mouse.</p>
        </div>
        <div className="shortcut-groups">
          {SHORTCUT_GROUPS.map((g) => (
            <section key={g.title}>
              <h4>{g.title}</h4>
              <dl>
                {g.keys.map(([k, what]) => (
                  <div key={k}>
                    <dt>
                      {k.split(' + ').map((part, i) => (
                        <React.Fragment key={part}>
                          {i > 0 && <span className="plus">+</span>}
                          <kbd>{part}</kbd>
                        </React.Fragment>
                      ))}
                    </dt>
                    <dd>{what}</dd>
                  </div>
                ))}
              </dl>
            </section>
          ))}
        </div>
        <div className="sheet-foot">
          <button type="button" className="primary" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </>
  );
}
