import React, { useEffect, useRef, useState } from 'react';
import { api } from '../api.js';
import { rupees } from '../utils.js';

/**
 * The product cell of a bill row. Typing either an ID or a name opens a list of
 * every match beside the input — "KS" shows every kitchen set — and Enter takes
 * the highlighted one and carries on to qty, so a whole row can be typed
 * without the hand leaving the keyboard.
 *
 * The popup is positioned fixed against the input's own rectangle rather than
 * inside the table cell: the bill table scrolls sideways on a phone, and an
 * absolutely positioned list would be clipped by it.
 */
export default function ProductPicker({
  value,
  onChange,
  onPick,
  inputRef,
  currency = '₹',
  ...inputProps
}) {
  const [matches, setMatches] = useState([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [rect, setRect] = useState(null);
  const localRef = useRef(null);
  const ref = inputRef || localRef;
  const boxRef = useRef(null);
  // A stale response from a slower earlier keystroke must not overwrite the
  // list for what is now in the box.
  const seq = useRef(0);

  useEffect(() => {
    const q = (value || '').trim();
    if (!q) {
      setMatches([]);
      return undefined;
    }
    // Only a box someone is typing in needs a list. Without this, reopening a
    // 20-line bill, or taking a product from the list, fired a search per row
    // for lists nobody would ever see.
    if (!open) return undefined;
    const mine = ++seq.current;
    const t = setTimeout(() => {
      api
        .products(q)
        .then((rows) => {
          if (mine !== seq.current) return;
          setMatches(rows);
          setActive(0);
        })
        .catch(() => {});
    }, 110);
    return () => clearTimeout(t);
  }, [value, open]);

  const place = () => {
    const el = ref.current;
    if (!el) return;
    setRect(el.getBoundingClientRect());
  };

  useEffect(() => {
    if (!open) return undefined;
    place();
    const handler = () => place();
    window.addEventListener('scroll', handler, true);
    window.addEventListener('resize', handler);
    return () => {
      window.removeEventListener('scroll', handler, true);
      window.removeEventListener('resize', handler);
    };
  }, [open, matches.length]);

  useEffect(() => {
    if (!open || !boxRef.current) return;
    const el = boxRef.current.querySelector('[data-active="true"]');
    if (el) el.scrollIntoView({ block: 'nearest' });
  }, [active, open]);

  const showing = open && matches.length > 0;

  const take = (p) => {
    onPick(p);
    setOpen(false);
  };

  const handleKey = (e) => {
    if (e.key === 'ArrowDown' && showing) {
      e.preventDefault();
      e.stopPropagation();
      setActive((i) => (i + 1) % matches.length);
    } else if (e.key === 'ArrowUp' && showing) {
      e.preventDefault();
      e.stopPropagation();
      setActive((i) => (i - 1 + matches.length) % matches.length);
    } else if (e.key === 'Escape' && showing) {
      // The first Escape only dismisses the list. A second one falls through to
      // the form, which is what jumps down to packing.
      e.preventDefault();
      e.stopPropagation();
      setOpen(false);
    } else if (e.key === 'Enter' && showing) {
      // Take the highlighted product but let the event carry on bubbling: the
      // form's own Enter handler is what moves focus along to qty.
      take(matches[active]);
    }
  };

  const popupStyle = rect
    ? (() => {
        const gap = 8;
        const width = Math.min(300, window.innerWidth - gap * 2);
        const room = window.innerWidth - rect.right;
        // Beside the input where there is room for it, underneath on a phone.
        const beside = room > width + gap * 2;
        return {
          top: Math.min(rect.top, window.innerHeight - 260),
          left: beside
            ? rect.right + gap
            : Math.max(gap, Math.min(rect.left, window.innerWidth - width - gap)),
          width,
          ...(beside ? {} : { top: rect.bottom + 4 }),
        };
      })()
    : null;

  return (
    <>
      <input
        {...inputProps}
        ref={ref}
        type="text"
        autoComplete="off"
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
        }}
        onFocus={() => {
          setOpen(true);
          place();
        }}
        onBlur={() => setTimeout(() => setOpen(false), 120)}
        onKeyDown={handleKey}
      />
      {showing && popupStyle && (
        <div className="picker" style={popupStyle} ref={boxRef}>
          <div className="picker-head">
            {matches.length} match{matches.length === 1 ? '' : 'es'}
          </div>
          {matches.map((p, i) => (
            <button
              key={p.id}
              type="button"
              className="picker-row"
              data-active={i === active}
              // mousedown fires before blur, so the click is not lost to the
              // popup closing underneath the pointer.
              onMouseDown={(e) => {
                e.preventDefault();
                take(p);
                if (ref.current) ref.current.focus();
              }}
              onMouseEnter={() => setActive(i)}
            >
              {p.image ? (
                <img src={p.image} alt="" className="picker-img" loading="lazy" decoding="async" />
              ) : (
                <span className="picker-img picker-img-empty" />
              )}
              <span className="picker-text">
                <span className="picker-name">{p.name}</span>
                <span className="picker-meta">
                  {p.product_id}
                  {p.stock ? ` · ${p.stock} in stock` : ''}
                </span>
              </span>
              <span className="picker-cost">{rupees(p.cost, currency)}</span>
            </button>
          ))}
        </div>
      )}
    </>
  );
}
