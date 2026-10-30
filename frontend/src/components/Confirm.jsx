import React, { useEffect, useRef } from 'react';

/**
 * A yes/no the keyboard can answer: Enter is yes, Escape is no, and the yes
 * button holds focus from the moment it opens. Used by Ctrl+Enter, where the
 * biller's hands are already on the keys and reaching for a mouse to confirm a
 * print would undo the point of the shortcut.
 *
 * `safe` flips the default for a destructive yes (Discard): Enter, and a tap
 * outside the box, then mean no, so a biller hammering Enter never loses work.
 */
export default function Confirm({ title, message, yes = 'Yes', no = 'No', onYes, onNo, safe = false }) {
  const yesRef = useRef(null);
  const noRef = useRef(null);

  useEffect(() => {
    (safe ? noRef : yesRef).current?.focus();
    const onKey = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onNo();
      } else if (e.key === 'Enter') {
        e.preventDefault();
        (safe ? onNo : onYes)();
      }
    };
    // Capture, so the bill form underneath never sees these keys.
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [onYes, onNo, safe]);

  return (
    <>
      <div className="sheet-backdrop" onClick={onNo} role="presentation" />
      <div className="sheet sheet-narrow" role="alertdialog" aria-label={title}>
        <div className="sheet-head">
          <h3>{title}</h3>
          {message && <p>{message}</p>}
        </div>
        <div className="sheet-foot">
          <button type="button" className={safe ? 'primary' : 'ghost'} ref={noRef} onClick={onNo}>
            {no} <kbd>{safe ? 'Enter' : 'Esc'}</kbd>
          </button>
          <button type="button" className={safe ? 'destructive' : 'primary'} ref={yesRef} onClick={onYes}>
            {yes} {!safe && <kbd>Enter</kbd>}
          </button>
        </div>
      </div>
    </>
  );
}
