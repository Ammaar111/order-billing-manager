# Order Bill Manager

A billing book for a counter. One person types an order in, it is saved, and it
goes out as a PDF, a Word file, a thermal receipt or a message. Built from the
wireframe in `WIREFRAME/` — React + Vite in front, Node + Express behind, one
SQLite file underneath.

```
frontend/   React 18 + Vite      the whole interface
backend/    Express 4 + SQLite   the API, and it serves the built frontend
            orders.db            every order, product and setting
            uploads/             product photographs
            backups/             a copy of the database before anything is deleted
```

## Running it

```bash
./start.sh
```

That installs anything missing, builds the interface if it has not been built,
starts the one server and opens the browser at **http://localhost:4100**.

The first time only, this takes a minute or two while npm downloads.

Other machines on the same wi-fi can reach it at `http://<this-pc-ip>:4100`, so
a phone at the counter works without installing anything.

### After changing the interface code

The server hands out the *built* copy, so a change in `frontend/src` does not
appear until it is rebuilt:

```bash
npm --prefix frontend run build
```

Then reload the page with `Ctrl+Shift+R`.

### While developing

```bash
npm --prefix frontend run dev
```

Hot reload on http://localhost:5180, sending `/api` through to 4100. The backend
still has to be running.

## Using it

### The keyboard is the point

A whole bill is typed without touching the mouse. Press **`?`** in the app at any
time for this list on screen.

**Enter** moves to the next box; off the end of a row it opens the next row.

```
Customer name → Address → Phone
   → Sr 1 → Product name → Qty → Rate → Discount
   → Sr 2 → …                                (Enter opens each new row)
```

**Cost is skipped on purpose.** It fills itself in as qty × rate, so stopping
there every line is a keystroke paid for hundreds of times a day. It is still
reachable by `Tab`, by arrow key, and by clicking — type in it and it stays as
typed, turning blue to show it was set by hand.

| Key | What it does |
|---|---|
| `Ctrl` `N` | New bill |
| `Ctrl` `D` | New product |
| `Ctrl` `S` | Save the bill |
| `Ctrl` `P` | Print or share this bill |
| `Ctrl` `Enter` | Print this bill — asks yes/no first |
| `?` | Show the shortcut list |
| `Esc` | Close whatever is open |

Inside a bill:

| Key | What it does |
|---|---|
| `Enter` | Next box; off the end of a row, opens the next row |
| `Enter` on an empty product name | The bill is finished — jumps to **Packing** |
| `Esc` | Jumps to **Packing** from anywhere in the table |
| `↑` `↓` | Same column, row above or below |
| `←` `→` | Previous or next column, once the caret is at the end of the text |
| `Tab` | Every box, Cost included |

From **Packing**, Enter goes to **Amount received** and then to **Save**, and
Enter on Save saves the bill. That is the whole "this bill is finished" gesture.

- **Discount** is a percentage and is optional. What it came to in rupees is
  totalled at the foot of the bill.
- **Customer name is optional.** Left blank, the bill is filed under **Cash**.
  Address and phone are optional too.
- **Sr numbers** and the **order number** are given out automatically. Order
  numbers start at #1 and count up; the number is taken at the moment the bill is
  saved, so two people billing at once cannot both get #7.
- There are **no up/down arrows** on any number box anywhere — plain typing only.

### Finding a product while billing

In the product name box, type either the name or the ID. Everything matching
appears in a list beside the box (underneath it on a phone) — typing `KS` brings
up every kitchen set. Arrow keys move through the list, **Enter** takes the
highlighted one and carries straight on to Qty. **Esc** closes the list without
taking anything; press Esc again to jump to packing.

### Two kinds of bill

At the top of a bill:

- **Full bill** — Sr, product name, qty, rate, cost, discount.
- **Qty & rate** — Sr, qty, rate, cost. No product names on the paper, and Enter
  skips that box entirely.

### Saving

Press Save and the app asks where the bill should go:

| | |
|---|---|
| **Save as PDF** | Opens the print window. Choose **Save as PDF** as the printer and pick a folder. |
| **Print receipt** | The same bill on the thermal roll, at the width set in Settings. |
| **Word document** | Downloads a `.doc` that opens in Word, LibreOffice or Google Docs. |
| **Share** | The phone's own share sheet where there is one, otherwise WhatsApp, email or copy. |

Nothing is lost by closing that window — the order is already saved. It can be
reopened from Orders at any time.

### Finishing an order

**✓ Mark completed** on a bill takes it off the Orders list once the goods have
gone out. Nothing is deleted: the bill, its lines and its figures stay exactly
as they were.

- **Orders → Completed** lists them, and **Reopen** puts one back on the open
  list if it was marked too early.
- **Settings → Lifetime orders** shows every order ever raised, open and
  completed together, by the day it was raised.
- Opening any completed bill and pressing **Print / share** gives you the same
  PDF, receipt, Word file and share options as the day it was made.

### Products

**Products → + Add new** — a photo, a name, an ID, a cost, the stock and what is
in the box. Tap any card to edit it. **Edit** puts a *del* badge on every card.

Deleting a product does not touch bills already raised: each bill line keeps its
own copy of the name and the rate it sold at, so old totals never move.

### Settings

- **Shop name, phone, address** — printed at the top of every bill.
- **Thermal paper** — 58mm, 80mm or a width you type. Getting this wrong is what
  cuts the totals off the right of the roll. At 80mm the receipt prints all six
  columns, with a long product name wrapping onto a second line. Below 70mm the
  numbers alone need more room than the paper has, so the name moves onto its
  own line above them instead.
- **Lifetime orders** — a calendar. Days with orders are filled in and carry a
  count; tap one to see that day's bills and open any of them.
- **Customers** — every customer the shop has billed, with their total, what is
  still pending and when they last came. Built from the orders themselves.
- **Back up now** — writes a copy of the database into `backend/backups/`.
- **Clear data** — wipes every order and product. You must type `CONFIRM` in
  capitals. Your shop details and paper size are kept, and a copy of the
  database is written to `backend/backups/` first. **That copy is the only way
  back** — the app cannot restore it for you; swap the file in by hand.

## Backing up

Everything lives in `backend/orders.db`. Copy that file somewhere safe often —
a USB stick, another folder, anywhere.

Use **Settings → Back up now** rather than copying the file in a file manager.
The database runs in WAL mode, which means a bill saved a minute ago can still
be sitting in `orders.db-wal` and not in `orders.db` at all. The button folds
that in first; a plain copy would quietly be missing the most recent trading.

## Setting up the thermal printer

See **[THERMAL-PRINTER.md](THERMAL-PRINTER.md)**.

## Putting it on another machine

- **Linux** — [INSTALL-ON-A-NEW-DEVICE.md](INSTALL-ON-A-NEW-DEVICE.md).
  `./install-shortcut.sh` builds the desktop icon for whichever machine it is
  run on.
- **Windows, from nothing** — [Installation-on-windows.md](Installation-on-windows.md).
  Installs Node and npm from the terminal, then runs `start-windows.bat`.

Both leave the new machine with the same software and a fresh empty book; the
shop's own details are typed into Settings once.
