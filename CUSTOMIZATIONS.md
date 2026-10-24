# Customizations — what changed, and how to undo it yourself

A running log of small behaviour changes made after the app was first built,
written so you can tweak or revert them yourself later without having to ask.
Each entry says exactly which file, which lines, and what to put there instead.

**After editing anything under `frontend/`, you have to rebuild before the
change shows up** — editing the source alone does nothing, because the app
serves the *built* copy in `frontend/dist`, not the source files:

```bash
npm --prefix frontend run build
```

Then hard-refresh the browser tab (`Ctrl+Shift+R`) so it doesn't show you the
old cached version. This applies to every change below.

---

## 1. The bill is narrow and centred, with a hard 5mm margin

**What changed.** The printed bill / PDF used to stretch to the full width of
an A4 page (186mm), which is why the totals looked sparse and spread out no
matter how the rows inside them were aligned. It's now a narrow column
centred on the sheet — the same proportions as the thermal receipt — with a
firm 5mm of blank space down each side that nothing ever prints into, on
either paper.

**Where.** [`frontend/src/styles.css`](frontend/src/styles.css):

```css
/* A4 */
.bill-a4 { max-width: 100mm; margin: 0 auto; padding: 0 5mm; }

/* Thermal (search "bill-thermal {") */
.bill-thermal {
  width: 100%;
  padding: 5mm 5mm 8mm;   /* was 5mm 2.5mm 8mm — the 2.5mm are the two you'd touch */
  ...
}
```

**To go back to full-width A4** (edge-to-edge, like a normal printed page):
```css
.bill-a4 { padding: 0; max-width: 186mm; }
```

**To change the margin on either paper**, it's just the left/right numbers in
those two `padding` lines — e.g. `padding: 0 8mm` on `.bill-a4` for a wider
gap, or `padding: 5mm 3mm 8mm` on `.bill-thermal` for a narrower one. On the
thermal roll specifically, don't go far below ~2.5mm each side — that's about
where the column-width budget (a few entries down, in `.bill-thermal .bp-table`)
starts running out of room for a four-digit rate before it wraps.

---

## 2. Totals — full-width rows, colons included

**What changed, and why it's flexbox again, not a table.** Three earlier
attempts came before this: figures pulled in close beside their own label
(looked fine alone, but left a dead gap on short rows once the page was
narrow); the whole block pushed flush right with each row shrunk to its own
width (fixed the gap, but rows starting at different left positions read as
ragged); then a real CSS table (`display: table`, sized and pushed right with
`margin-left: auto`) — which lined every colon and figure up perfectly, but
being shrink-to-fit meant Grand total's border-top/border-bottom only spanned
that narrow table's own width, not the page — a short, isolated rule sitting
in the middle of the receipt while the item table above it ran edge to edge.
That mismatch was the actual complaint: "half lines" on Grand total.

Stretching the table to `width: 100%` was tried too, but a table's auto
layout dumps all the extra width into whichever column has room — here, the
label column — which blew a huge gap between e.g. "Discount given" and its
figure. Confirmed by actually rendering it, not just reasoning about it.

Back to plain flex rows, but now full width instead of shrink-to-fit: each
row is a `<div>` with `justify-content: space-between`, so every row —
including Grand total — is exactly as wide as the item table above it. That
guarantees Grand total's divider reaches both margins, matching the table.
The trade-off versus the table version: colons across different-length
labels don't sit in one shared vertical column anymore (each row's colon sits
right after that row's own label) — a minor cosmetic step down, but not what
was being complained about, and the user said explicitly to leave Grand
total's content and position as they are.

**Where.** [`frontend/src/styles.css`](frontend/src/styles.css), search for
`bp-totals`:

```css
.bill-paper .bp-totals {
  margin-top: 8pt;
  display: flex;
  flex-direction: column;
  gap: 2pt;
  font-size: 9.5pt;
}
.bill-paper .bp-totals > div {
  display: flex;
  justify-content: space-between;
  gap: 6pt;
  font-variant-numeric: tabular-nums;
}
.bill-paper .bp-totals > div > span:first-child::after { content: ':'; }
.bill-paper .bp-grand {
  border-top: 0.75pt solid #000;
  border-bottom: 0.75pt solid #000;
  padding: 3pt 0;
  margin: 3pt 0;
  font-weight: 700;
  font-size: 11pt;
}
```

**To remove the colons**, delete the `::after` rule.

**To go back to a right-hugging block** (narrower, pushed against the right
margin instead of spanning the full width): add `margin-left: auto` and
`width: max-content` to `.bp-totals`. Note this brings back the short-divider
problem on Grand total described above — it's why that layout was dropped.

---

## 3. Current time, top right

**What it does.** The date next to the order number now also carries the
time — filled in live, at the moment the bill is printed or opened for
sharing, not frozen at the moment the order was first saved. Reprint an old
bill next week and it shows this week's time.

**Where.** The formatter lives in
[`frontend/src/utils.js`](frontend/src/utils.js) as `prettyTime`, and it's
used in [`frontend/src/components/BillPrint.jsx`](frontend/src/components/BillPrint.jsx),
in the same line as the date:

```jsx
<span>
  {prettyDate(order.order_date)}
  {' · '}
  {prettyTime()}
</span>
```

**To remove it**, delete the `{' · '}{prettyTime()}` two lines, leaving just
`<span>{prettyDate(order.order_date)}</span>` as it was before.

---

## 4. Amount received — defaults to the bill total

**What it does.** On a new bill, "Amount received" now fills itself in with
the running grand total as you add items — so a normal, fully-paid sale needs
no typing there at all. The moment you type into that field yourself —
including typing `0` for a bill going out on credit — it stops following the
total and keeps exactly what you typed, even if you then add more items.
Reopening a saved bill always shows what was actually recorded for it, never
re-defaulted.

**Where.** [`frontend/src/screens/BillForm.jsx`](frontend/src/screens/BillForm.jsx).
Three small pieces, all easy to find by searching for `paidTouched`:

1. A bit of state, near the other `useState` calls:
   ```js
   const [paidTouched, setPaidTouched] = useState(false);
   ```
2. The part that actually fills the field in, a `useEffect`:
   ```js
   useEffect(() => {
     if (!orderId && !paidTouched) setPaid(grand ? String(grand) : '');
   }, [grand, orderId, paidTouched]);
   ```
3. One flag set in two places — when a saved order is loaded (so it's never
   re-defaulted), and inside the "Amount received" field's `onChange`, right
   next to `setPaid(v)`:
   ```js
   setPaidTouched(true);
   ```

**To turn it off completely** (go back to the field always starting blank,
like before): delete just the `useEffect` block in point 2 above. That one
block is what does the filling-in — removing it stops the behaviour and
leaves everything else harmless and unused. You don't need to touch the other
two pieces, though you're welcome to remove all three for a fully clean revert.

**To change *when* it stops following** instead of removing it: the condition
`!orderId && !paidTouched` on the `useEffect` is the whole rule. For example,
if you wanted it to keep following the total even after typing 0 — i.e. never
lock — you could change the effect to ignore `paidTouched` entirely:
```js
useEffect(() => {
  if (!orderId) setPaid(grand ? String(grand) : '');
}, [grand, orderId]);
```
(Not recommended — this brings back the exact problem the feature was built
to avoid: typing `0` for a credit sale would get silently overwritten the
next time an item changes.)

---

## 5. Thermal bill fits in 70mm, and Total qty sits under the Qty column

**What changed.** Two things on the thermal receipt:

1. **The whole bill is a fixed 70mm box centred on the 80mm roll**, so 5mm
   on each side is always blank. (This replaces the thermal half of entry 1:
   the old `padding: 5mm 4mm 8mm 6mm` put the right-hand figures only 4mm
   from the edge of the paper. Most 80mm printers can only print the middle
   ~72mm, so the Total column was getting clipped.) The box width is
   *roll width − 10mm*, so a 58mm roll gets 48mm automatically. Checked by
   rendering a worst-case bill (6-figure totals, 5-digit rates with paise,
   discount column, long names) in Chrome: every character lands between
   5mm and 75mm.
2. **Total qty is now the last row of the item table.** The label "Total qty"
   sits at the right end of the Product column, and the number sits in the
   Qty column, right under the item quantities, with a black rule above it.
   It was removed from the totals block below (except on rolls narrower than
   70mm, which use the stacked layout with no Qty column, so it stays in the
   totals block there). The same row appears on the A4/PDF bill.

**Where.**
- [`frontend/src/components/BillPrint.jsx`](frontend/src/components/BillPrint.jsx):
  `ROLL_SIDE_MM = 5` (the blank margin each side) and the `bp-qty-total` row.
- [`frontend/src/styles.css`](frontend/src/styles.css): `.bill-thermal`
  (centred box), `.bp-qty-total` (the row's look), the `.bill-thermal .bp-table .c-…`
  column percentages, and `.bp-totals`. Totals now use one shared grid whose
  columns widen for a big figure instead of spilling off the paper.

**To change the blank margin**, edit `ROLL_SIDE_MM` in BillPrint.jsx. For
example, `4` gives a 72mm bill on an 80mm roll and `6` gives 68mm.

**To put Total qty back in the totals block**, delete the `<tr className="bp-qty-total">`
row in BillPrint.jsx and change `{stacked && (` just above the Total qty
`<div>` in `.bp-totals` to `{true && (`.

---

## 6. start-windows.bat rebuilds by itself when the source changes

**What changed.** `start-windows.bat` used to build the front end only when
there was no build at all. Now it also rebuilds whenever any file under
`frontend\src` (or `frontend\index.html`) is newer than the last build, so
after copying in changed files you just double-click it as usual. If a
rebuild fails, it says so in a box and starts the previous version, so billing
isn't blocked. Both `.bat` files were also converted to Windows (CRLF) line
endings, which `cmd` needs to follow `goto`/`call` labels reliably.

**About the PowerShell error.** "running scripts is disabled on this system"
only happens when `npm` is typed into a *PowerShell* window. The `.bat` runs
in Command Prompt, where that block doesn't apply.

**Where.** The `:build` section near the bottom of `start-windows.bat`.
**To go back** to "build only if missing", replace everything from `:build` to
the first `exit /b 0` after it with the old four lines: check
`frontend\dist\index.html` exists, else `pushd frontend`, `call npm run build`,
`popd`.

---

## 7. No product ID on the bill, no browser header/footer on the print

**What changed.**
1. The product ID (the `(ID)` after each product name) no longer prints on the
   bill, the PDF, or the Word/HTML download.
2. "Order Bill Manager" (top) and "localhost:4100/…" (bottom) on the printed
   page and saved PDF were the browser's own header/footer, not part of the
   bill. Chrome only prints them when the page has a margin, so the A4 `@page`
   margin is now `0` and the white border comes from padding instead.

**Where.**
- Product ID: the two `product_id` lines in
  [`BillPrint.jsx`](frontend/src/components/BillPrint.jsx) and the one in
  `billHtml` in [`print.js`](frontend/src/print.js). To bring it back, re-add
  `{it.product_id ? <em> ({it.product_id})</em> : null}` after the product name.
- Header/footer: `@page { size: A4 portrait; margin: 0; }` in `print.js`, plus
  `body[data-print-mode='a4'] .print-only { padding: 14mm 12mm; }` in
  [`styles.css`](frontend/src/styles.css). To change the A4 border, edit that
  padding. Thermal was already margin 0.

If a header/footer ever still appears, untick "Headers and footers" under
"More settings" in the print dialog.

---

## 8. Enter skips Sr, and an Old balance field

- **Enter no longer stops on the Sr cell** (it still can be reached with the
  arrow keys / click). `ENTER_COLUMNS` and the new-row focus in
  [`BillForm.jsx`](frontend/src/screens/BillForm.jsx). To undo, put `'sr'` back
  at the front of both `ENTER_COLUMNS` lists.
- **Old balance** (what the customer owed before this bill): a new field between
  Packing and Amount received. It is **added into Grand total**, so Amount
  received / Pending cover it, and prints as an "Old balance" line above Grand
  total (also in the Word download and share text). Stored in a new
  `orders.old_balance` column (added automatically on start-up; existing bills
  read as 0). Note: since it's inside `grand_total`, the Reports revenue figure
  counts it too.

---

## 9. New products typed into a bill are added to Products

When a bill is saved with a product name that isn't in the catalogue (and wasn't
picked from the suggestions), the server adds it to Products at that line's
rate, stock 0, with an automatic ID of the first two letters of the name plus the rate
("Kitchen set" at 250 → `KI250`). Matching is by name, ignoring case, so resaving never
duplicates. Qty & rate bills have no names, so nothing is added. It lives at
the end of `writeOrder` in [`backend/server.js`](backend/server.js); delete that
`if (str(body.bill_type) !== 'qty-rate')` block to turn it off. Restart the
server for it to take effect.
