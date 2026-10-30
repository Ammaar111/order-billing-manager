import React, { useEffect, useRef, useState } from 'react';
import { TOUCH } from '../keypad.js';

const SELECTOR = 'input[data-keypad]';

// Keys act on pointer-down, and a key such as Enter can close the pad in that
// same instant. The phone still fires the tap's click afterwards — on whatever
// is now under the finger, which at the bottom of a bill is Back/Discard. That
// stray click left a bill unsaved. Clicks this soon after a key are dropped.
let swallowUntil = 0;
if (TOUCH && typeof document !== 'undefined') {
  document.addEventListener(
    'click',
    (e) => {
      // Only a real finger's click: the Save that Enter presses on purpose is
      // a programmatic click and must go through.
      if (e.isTrusted && Date.now() < swallowUntil && !e.target.closest?.('.keypad')) {
        e.preventDefault();
        e.stopPropagation();
      }
    },
    true
  );
}

// React tracks a controlled input's value itself, so assigning `.value` is
// invisible to it. Going through the prototype's setter and then firing a real
// `input` event is what makes onChange run exactly as if it had been typed.
const setValue = (() => {
  const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
  return (el, v, caret) => {
    set.call(el, v);
    el.dispatchEvent(new Event('input', { bubbles: true }));
    try {
      el.setSelectionRange(caret, caret);
    } catch {
      // Not every input type has a caret. Nothing to restore.
    }
  };
})();

/** "Row 3 · Qty", "Packing" — what the biller is typing into, for the bar. */
function describe(el) {
  const row = /^row-(\d+)-/.exec(el.dataset.chain || '');
  const cell = el.closest('[data-label]')?.dataset.label;
  const field = el.closest('label')?.querySelector('span')?.textContent;
  const name = cell || field || el.placeholder || '';
  return row ? `Row ${Number(row[1]) + 1} · ${name}` : name;
}

/** The inputs Tab can reach, in page order, within the dialog if there is one. */
function fieldsAround(el) {
  const scope = el.closest('.sheet') || document;
  return Array.from(
    scope.querySelectorAll(
      'input:not([readonly]):not([disabled]):not([type=hidden]):not([type=file]):not([type=checkbox]):not([type=radio]), textarea:not([disabled])'
    )
  ).filter((n) => n.offsetParent !== null);
}

const KEYS = [
  ['7', 'digit'], ['8', 'digit'], ['9', 'digit'], ['⌫', 'back'],
  ['4', 'digit'], ['5', 'digit'], ['6', 'digit'], ['Tab', 'tab'],
  ['1', 'digit'], ['2', 'digit'], ['3', 'digit'], ['Enter', 'enter'],
  ['0', 'zero'], ['.', 'dot'],
];

/**
 * The shop's own number pad. A phone's numeric keyboard has no Enter and no
 * Tab, so after every figure the biller had to dismiss it and tap the next cell
 * by hand. This one sits at the bottom of the screen whenever a number field is
 * focused, the phone's keyboard stays shut (see `numeric()`), and Enter and Tab
 * do what they do on a real keyboard.
 *
 * Keys never take focus — the field the biller is typing into stays focused —
 * and act on pointer-down, so a quick run of digits is not eaten by tap delays.
 */
export default function Keypad() {
  const [target, setTarget] = useState(null);
  const [shown, setShown] = useState('');
  const barRef = useRef(null);
  const repeat = useRef(null);

  useEffect(() => {
    if (!TOUCH) return undefined;
    const onIn = (e) => {
      if (e.target.matches?.(SELECTOR)) {
        setTarget(e.target);
        setShown(e.target.value);
      } else {
        setTarget(null);
      }
    };
    const onOut = () =>
      setTimeout(() => {
        if (!document.activeElement?.matches?.(SELECTOR)) setTarget(null);
      }, 0);
    // Keeps the bar's readout current however the value changed.
    const onInput = (e) => {
      if (e.target.matches?.(SELECTOR)) setShown(e.target.value);
    };
    document.addEventListener('focusin', onIn);
    document.addEventListener('focusout', onOut);
    document.addEventListener('input', onInput);
    return () => {
      document.removeEventListener('focusin', onIn);
      document.removeEventListener('focusout', onOut);
      document.removeEventListener('input', onInput);
    };
  }, []);

  // A screen change removes the focused field without a blur event.
  useEffect(() => {
    if (!target) return undefined;
    const t = setInterval(() => {
      if (!document.body.contains(target)) setTarget(null);
    }, 300);
    return () => clearInterval(t);
  }, [target]);

  // Make room for the pad, then bring the field out from behind it.
  useEffect(() => {
    const root = document.documentElement;
    if (!target || !barRef.current) {
      root.classList.remove('kp-on');
      return undefined;
    }
    root.style.setProperty('--kp-h', `${barRef.current.offsetHeight}px`);
    root.classList.add('kp-on');

    const raf = requestAnimationFrame(() => {
      if (!document.body.contains(target)) return;
      // Tapping a field selects what is in it, so typing replaces it.
      target.select?.();
      if (target.closest('.sheet')) {
        target.scrollIntoView({ block: 'nearest' });
        return;
      }
      const top = (document.querySelector('.topbar')?.offsetHeight || 0) + 8;
      const bottom = window.innerHeight - barRef.current.offsetHeight - 8;
      const r = target.getBoundingClientRect();
      if (r.top < top || r.bottom > bottom) {
        window.scrollBy({ top: r.top + r.height / 2 - (top + bottom) / 2 });
      }
    });
    return () => cancelAnimationFrame(raf);
  }, [target]);

  useEffect(() => () => document.documentElement.classList.remove('kp-on'), []);

  if (!TOUCH || !target) return null;

  const kind = target.dataset.keypad;

  const insert = (ch) => {
    const el = target;
    const s = el.selectionStart ?? el.value.length;
    const e = el.selectionEnd ?? s;
    const before = el.value.slice(0, s);
    const after = el.value.slice(e);
    let next = ch;
    if (kind === 'num') {
      // "0" then "5" is 5, not 05; a lone point is 0.
      if (ch !== '.' && before === '0' && after === '') {
        setValue(el, ch, 1);
        return;
      }
      if (ch === '.') {
        if ((before + after).includes('.')) return;
        if (before === '') next = '0.';
      }
    } else if (ch === '.') {
      // On a phone number the point key is the + of an international number.
      if (before !== '' || after.startsWith('+')) return;
      next = '+';
    }
    setValue(el, before + next + after, s + next.length);
  };

  const back = () => {
    const el = target;
    if (!document.body.contains(el)) return;
    const s = el.selectionStart ?? el.value.length;
    const e = el.selectionEnd ?? s;
    if (s !== e) setValue(el, el.value.slice(0, s) + el.value.slice(e), s);
    else if (s > 0) setValue(el, el.value.slice(0, s - 1) + el.value.slice(s), s - 1);
  };

  const enter = () => {
    const el = target;
    // The screen's own Enter handling decides where to go, so the pad and a
    // hardware keyboard walk a bill identically.
    const ev = new KeyboardEvent('keydown', {
      key: 'Enter',
      code: 'Enter',
      keyCode: 13,
      which: 13,
      bubbles: true,
      cancelable: true,
    });
    const claimed = !el.dispatchEvent(ev);
    // A field nobody walks on from is simply finished.
    if (!claimed && document.activeElement === el) el.blur();
  };

  const tab = () => {
    const all = fieldsAround(target);
    const next = all[all.indexOf(target) + 1];
    if (next) next.focus();
    else target.blur();
  };

  const stopRepeat = () => {
    clearTimeout(repeat.current);
    clearInterval(repeat.current);
    repeat.current = null;
  };

  const press = (kindOfKey, label) => (e) => {
    e.preventDefault();
    swallowUntil = Date.now() + 600;
    if (kindOfKey === 'back') {
      back();
      // Hold to keep deleting.
      stopRepeat();
      repeat.current = setTimeout(() => {
        repeat.current = setInterval(back, 70);
      }, 380);
    } else if (kindOfKey === 'tab') tab();
    else if (kindOfKey === 'enter') enter();
    else insert(kindOfKey === 'dot' ? '.' : label);
  };

  return (
    <div
      className="keypad"
      ref={barRef}
      role="group"
      aria-label="Number pad"
      // Without this a tap on the pad would take focus from the field.
      onMouseDown={(e) => e.preventDefault()}
      onContextMenu={(e) => e.preventDefault()}
    >
      <div className="kp-head">
        <span className="kp-label">{describe(target)}</span>
        <span className="kp-value">{shown || '—'}</span>
        <button type="button" className="kp-hide" onPointerDown={(e) => { e.preventDefault(); swallowUntil = Date.now() + 600; target.blur(); }}>
          Hide
        </button>
      </div>
      <div className="kp-grid">
        {KEYS.map(([label, k]) => (
          <button
            key={k + label}
            type="button"
            className={`kp-key kp-${k}`}
            aria-label={k === 'back' ? 'Backspace' : k === 'dot' ? (kind === 'tel' ? 'Plus' : 'Decimal point') : label}
            onPointerDown={press(k, label)}
            onPointerUp={stopRepeat}
            onPointerCancel={stopRepeat}
            onPointerLeave={stopRepeat}
          >
            {k === 'dot' && kind === 'tel' ? '+' : label}
          </button>
        ))}
      </div>
    </div>
  );
}
