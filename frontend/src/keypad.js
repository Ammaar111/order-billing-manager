// A phone or tablet, as opposed to a mouse and keyboard. Decided once: the
// pointer a device has does not change under the page.
export const TOUCH =
  typeof window !== 'undefined' && !!window.matchMedia?.('(pointer: coarse)').matches;

/**
 * Props for a field that takes numbers. `kind` is 'num' (digits and one point)
 * or 'tel' (a phone number, where the point key becomes +).
 *
 * On a touch device inputMode "none" keeps the phone's own keyboard shut, and
 * the data attribute is how <Keypad /> knows to open the shop's own in its
 * place. Everywhere else the field behaves as it always did.
 */
export const numeric = (kind = 'num') => ({
  inputMode: TOUCH ? 'none' : kind === 'tel' ? 'tel' : 'decimal',
  'data-keypad': kind,
});
