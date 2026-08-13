import React, { useEffect, useRef } from 'react';

/**
 * A yes/no the keyboard can answer: Enter is yes, Escape is no, and the yes
 * button holds focus from the moment it opens. Used by Ctrl+Enter, where the
 * biller's hands are already on the keys and reaching for a mouse to confirm a
 * print would undo the point of the shortcut.
 */
export default function Confirm({ title, message, yes = 'Yes', no = 'No', onYes, onNo }) {
  const yesRef = useRef(null);

  useEffect(() => {
    yesRef.current?.focus();
    const onKey = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onNo();
      } else if (e.key === 'Enter') {
        e.preventDefault();
        onYes();
      }
    };
    // Capture, so the bill form underneath never sees these keys.
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [onYes, onNo]);

  return (
    <>
      <div className="sheet-backdrop" onClick={onNo} role="presentation" />
      <div className="sheet sheet-narrow" role="alertdialog" aria-label={title}>
        <div className="sheet-head">
          <h3>{title}</h3>
          {message && <p>{message}</p>}
        </div>
        <div className="sheet-foot">
          <button type="button" className="ghost" onClick={onNo}>
            {no} <kbd>Esc</kbd>
          </button>
          <button type="button" className="primary" ref={yesRef} onClick={onYes}>
            {yes} <kbd>Enter</kbd>
          </button>
        </div>
      </div>
    </>
  );
}
