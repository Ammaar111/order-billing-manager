# Installing Order Bill Manager on another device

For putting the system on a second shop machine — same software, same setup, but
a **fresh empty book**. No orders, no products, no customers carried across. The
only things the new machine gets are the app itself and, once, the shop's own
details typed into Settings.

If instead you want to *move* an existing shop with its records intact, this is
the wrong document — copy `backend/orders.db` across as well, and read
[README.md](README.md) under *Backing up*.

---

## Before you start

The new machine needs:

| | |
|---|---|
| **Node.js 18, 20, 22 or 23** | `node -v`. These are the versions `better-sqlite3` 11.10.0 ships ready-made binaries for. Newer ones work too, but npm has to compile the database library first, which needs `build-essential` and several minutes. **22** is the safe pick. |
| **npm** | comes with Node |
| **About 300 MB free** | mostly the npm packages |
| **A browser** | Chrome or Chromium is what the printing was tuned against |

Installing Node on Linux Mint / Ubuntu:

```bash
sudo apt update && sudo apt install nodejs npm
```

If that gives you something older than 18, use NodeSource instead:

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash - && sudo apt install -y nodejs
```

Check it:

```bash
node -v
```

---

## 1. Copy the app across

Put the whole `ORDER BILL MANAGER` folder on the new machine — a USB stick is
fine. Anywhere works; the Desktop is easiest to find later.

**Then delete the old shop's data from the copy.** This is the step that makes it
a fresh install rather than a clone:

```bash
cd "$HOME/Desktop/ORDER BILL MANAGER"
rm -f  backend/orders.db backend/orders.db-wal backend/orders.db-shm
rm -rf backend/backups backend/node_modules frontend/node_modules frontend/dist
rm -f  backend/uploads/*
```

What each line does:

- **`orders.db*`** — the entire book: orders, bill lines, products, settings.
  Removing it is what gives the new machine an empty database. It is recreated
  automatically on first run, with the default settings only.
- **`backups/`** — copies of the old shop's book. Nothing to do with this one.
- **`node_modules/`** — packages built for the old machine's processor. These
  **must** be removed; `better-sqlite3` is compiled native code and a copied
  folder will fail to load on a different machine.
- **`frontend/dist/`** — the built interface, rebuilt in the next step.
- **`backend/uploads/*`** — the old shop's product photographs.

Keep everything else exactly as it is.

> Copying by hand instead? Take these and nothing else:
> `backend/*.js`, `backend/package.json`, `frontend/`(without `node_modules` and
> `dist`), `*.sh`, `assets/`, and the `.md` files.

## 2. Install and start

```bash
cd "$HOME/Desktop/ORDER BILL MANAGER"
./start.sh
```

The first run installs the packages and builds the interface, so give it a few
minutes. When it prints

```
Order Bill Manager → http://localhost:4100
```

the browser opens by itself. Leave that terminal window open — closing it stops
the shop.

You should see **Orders** with nothing in it. That is correct: this is a new book.

## 3. Put the icon on the desktop

In a second terminal:

```bash
cd "$HOME/Desktop/ORDER BILL MANAGER"
./install-shortcut.sh
```

That works out this machine's paths on its own, writes the launcher, marks it
trusted so Cinnamon will run it, and adds it to the applications menu. From then
on the shop starts by double-clicking **Order Bill Manager**.

## 4. Fill in the shop's own details

This is the only data the new install starts with, and it is typed in by hand —
nothing is carried over from the old machine.

Go to **Settings** and set:

| Setting | What it is |
|---|---|
| **Shop name** | Printed at the top of every bill and receipt |
| **Phone** | Printed under the name |
| **Address** | Printed under the phone |
| **Thermal paper** | The width of the roll in this machine's printer — 58mm, 80mm, or type your own |

Each field saves as you click away from it. The figures in **Records** stay at
zero until the first bill is raised, which is what you want.

Settings are the one thing **Clear data** never wipes, so once these are right
they stay right.

## 5. Add the products

**Products → + Add new**, one at a time: a photo, a name, a product ID, the cost,
the stock and what is in the box.

The product ID is worth thinking about, because it is what the biller types.
Give related things a shared prefix — `KS-01`, `KS-02`, `KS-03` for kitchen sets
— and typing `KS` in a bill brings all of them up in one list.

## 6. Set up the printer

Follow [THERMAL-PRINTER.md](THERMAL-PRINTER.md) on the new machine. The driver
and the paper size are per-machine settings and do not travel with the app.

Make sure the width in **Settings → Thermal paper** matches the roll physically
loaded in *this* machine's printer.

## 7. Check it works before the shop opens

Raise one throwaway bill and take it all the way through:

1. **Orders → + New order**
2. Type a name, press **Enter** all the way along a row
3. Check a product comes up when you type its ID
4. Press **Esc** — the cursor should jump to Packing
5. **Save**, then **Save as PDF** and **Print receipt**
6. **✓ Mark completed** — it should leave the Orders list
7. **Orders → Completed** — it should be there, and **Print / share** should
   still produce the whole bill

Then get rid of it: **Settings → Clear data**, type `CONFIRM`. That empties
orders and products but keeps the shop details and paper size you set in step 4,
so you are left with a clean book that is already configured.

---

## Using it from a phone or tablet in the shop

The new machine serves the whole shop over wi-fi. Find its address:

```bash
hostname -I | awk '{print $1}'
```

Then on any phone on the same wi-fi, open `http://THAT-ADDRESS:4100`. Nothing to
install on the phone.

## Starting automatically when the machine turns on

Optional, but worth it on a machine that only ever runs the shop:

```bash
mkdir -p "$HOME/.config/autostart"
cp "$HOME/.local/share/applications/order-bill-manager.desktop" "$HOME/.config/autostart/"
```

## Back the new machine up from day one

Everything the shop has is one file: `backend/orders.db`.

Use **Settings → Back up now** rather than copying it in a file manager. The
database runs in WAL mode, so a bill saved a minute ago can still be sitting in
`orders.db-wal` and not in `orders.db` at all — the button folds that in first.
Copy the resulting file out of `backend/backups/` onto a USB stick regularly.

---

## If something goes wrong

| Symptom | Cause and fix |
|---|---|
| `Error: Cannot find module 'better-sqlite3'` | Packages not installed. `npm --prefix backend install` |
| `invalid ELF header` or a `better-sqlite3` crash on start | `node_modules` was copied from the old machine. `rm -rf backend/node_modules frontend/node_modules` then `./start.sh` |
| `EADDRINUSE` on port 4100 | It is already running. Look for the other terminal window, or `./start.sh` again — it detects a running shop and just opens the browser |
| Page loads but every figure is zero and saving fails | The backend stopped. Check the terminal window for the error |
| Changes to the code do not appear | The served copy is stale. `npm --prefix frontend run build`, then `Ctrl+Shift+R` |
| The desktop icon does nothing | It is not trusted. Run `./install-shortcut.sh` again |
| Old orders showed up on the new machine | `backend/orders.db` was copied across. Stop the app, delete it and the `-wal`/`-shm` files, start again |

## Running on a different port

If 4100 is taken by something else:

```bash
PORT=4200 ./start.sh
```

To make that permanent, edit the `PORT` line near the top of `start.sh`.
