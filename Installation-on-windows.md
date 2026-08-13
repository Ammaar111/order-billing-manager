# Installing Order Bill Manager on Windows

For putting the system on a Windows machine that has **nothing installed on it
yet** — no Node.js, no npm, no developer tools. Everything below is typed into a
terminal window; nothing has to be hunted for on a website.

The end state is the same as the Linux install: same software, same settings,
and a **fresh empty book** — no orders, no products, no customers carried
across. The shop's own details get typed in once, in Settings.

Works on Windows 10 (version 1809 or newer) and Windows 11.

---

## The one thing to get right

**Install Node.js 22, not the newest one.**

The database library this app uses (`better-sqlite3`) ships ready-made Windows
files for particular Node versions only. When there is no file for the version
you have, npm tries to *compile* it instead, which needs Visual Studio build
tools — a several-gigabyte download that then usually fails anyway on a machine
set up for a shop.

At the version this app pins (`better-sqlite3` 11.10.0) the ready-made Windows
files cover **Node 18, 20, 22 and 23**. Step 1 installs **22**, the current
long-term-support release. Don't "upgrade" it later.

> **If you set this up before 2026-08-13, re-copy `backend\package.json` and
> `backend\package-lock.json` from the Linux machine before installing.** The
> earlier version of the app pinned `better-sqlite3` 9.6.0, whose Windows files
> stop at Node 21 — so following this guide's "install Node 22" instruction gave
> exactly the compile error it was meant to avoid. The pin has been moved to
> 11.10.0, which does cover Node 22.

---

## 1. Install Node.js and npm

Open **PowerShell as Administrator**: press `Win`, type `powershell`, then
right-click **Windows PowerShell** → **Run as administrator**.

### The short way

```powershell
winget install -e --id OpenJS.NodeJS.LTS --version 22.20.0 --accept-package-agreements --accept-source-agreements
```

If winget says the version is not available, or says it does not know `winget`
at all, use the way below instead — it always works.

### The way that always works

This downloads the official Node.js 22 installer straight from nodejs.org and
runs it silently. npm comes with it; there is nothing separate to install.

```powershell
curl.exe -L -o "$env:TEMP\node22.msi" https://nodejs.org/dist/v22.20.0/node-v22.20.0-x64.msi
```

```powershell
Start-Process msiexec.exe -Wait -ArgumentList '/i', "$env:TEMP\node22.msi", '/quiet', '/norestart'
```

> On an older 32-bit machine, replace `x64` with `x86` in the download line.

### Check it worked

**Close PowerShell completely and open a new one** — a terminal only learns
about newly installed programs when it starts. Then:

```powershell
node -v
```

```powershell
npm -v
```

You want `v22.something` and a number. If `node` is "not recognised", you did
not open a *new* window — close it and try again.

---

## 2. Get the app onto the machine

Copy the whole **ORDER BILL MANAGER** folder over, and put it somewhere with a
simple path. The Desktop is easiest:

```
C:\Users\YourName\Desktop\ORDER BILL MANAGER
```

**Send it as one zip file, never as loose files.** A USB stick is fine. If you
are sending it over the network instead — a `python3 -m http.server` on the
Linux machine, say — zip it first, on the Linux side:

```bash
cd ~/Desktop && zip -r obm.zip "ORDER BILL MANAGER" -x '*/node_modules/*' '*/dist/*' '*/backups/*' '*orders.db*'
```

Then serve and download that **one file**, and right-click → *Extract All* on
Windows.

> Why it matters: clicking through a directory listing in a browser saves files
> one at a time and flattens the folders. The app is roughly 40 nested files —
> miss `frontend\src\` or a `package-lock.json` and the install fails much later,
> with an error that points nowhere near the real cause. The zip carries the
> structure. The `-x` flags leave out exactly what step 2 tells you to delete
> anyway, so the transfer is a few hundred kilobytes instead of ninety megabytes.

> Avoid OneDrive-synced folders. OneDrive locks files while it uploads them, and
> the database is written to constantly — that combination corrupts data.
> If your Desktop is synced to OneDrive, use `C:\ShopApp` instead and use that
> path everywhere below.

### Then empty the old shop's data out of the copy

This is the step that makes it a fresh install rather than a clone of the Linux
machine. In PowerShell:

```powershell
cd "$env:USERPROFILE\Desktop\ORDER BILL MANAGER"
```

```powershell
Remove-Item backend\orders.db*, backend\uploads\* -Force -ErrorAction SilentlyContinue
Remove-Item backend\backups, backend\node_modules, frontend\node_modules, frontend\dist -Recurse -Force -ErrorAction SilentlyContinue
```

What that removes and why:

| Removed | Why |
|---|---|
| `backend\orders.db*` | The entire book — orders, bill lines, products, settings. Deleting it is what gives the new machine an empty database. It is recreated on first run with the default settings. |
| `backend\backups` | Copies of the *old* shop's book. Nothing to do with this one. |
| `backend\uploads\*` | The old shop's product photographs. |
| `node_modules` | **Must go.** These are compiled for Linux and will not load on Windows. |
| `frontend\dist` | The built interface, rebuilt on first run. |

Everything else stays exactly as it is.

---

## 3. Start it

Open PowerShell **normally — not "Run as administrator".** The app writes only
inside its own folder, so it needs nothing special, and an elevated window
installs the packages as a different user, which causes permission errors later.

```powershell
cd "$env:USERPROFILE\Desktop\ORDER BILL MANAGER"
```

```powershell
.\start-windows.bat
```

The `.\` is required. PowerShell will not run a script in the current folder
without it.

The first run installs the packages and builds the interface, so give it a few
minutes. When it prints

```
Order Bill Manager - http://localhost:4100
```

your browser opens by itself. **Leave that black window open** — closing it
stops the shop.

You should see **Orders** with nothing in it. That is correct: this is a new
book.

To stop the shop, click the black window and press `Ctrl+C`, or just close it.

---

## 4. Put an icon on the desktop

In the same PowerShell window (or a new one):

```powershell
$app = "$env:USERPROFILE\Desktop\ORDER BILL MANAGER"
$s = (New-Object -ComObject WScript.Shell).CreateShortcut("$env:USERPROFILE\Desktop\Order Bill Manager.lnk")
$s.TargetPath = "$app\start-windows.bat"
$s.WorkingDirectory = $app
$s.IconLocation = "$app\assets\icon.png"
$s.Description = "Start the billing system"
$s.Save()
```

If Windows refuses the `.png` as an icon, drop the `IconLocation` line — the
shortcut works either way, it just gets a plain icon.

From then on the shop starts by double-clicking **Order Bill Manager** on the
desktop.

### Starting automatically when the machine turns on

Optional, worth it on a machine that only runs the shop. Press
`Win+R`, type `shell:startup`, press Enter, and copy the shortcut you just made
into the folder that opens.

---

## 5. Fill in the shop's own details

This is the only data the new install starts with, and it is typed in by hand.
Nothing is carried over from the old machine.

Go to **Settings** and set:

| Setting | What it is |
|---|---|
| **Shop name** | Printed at the top of every bill and receipt |
| **Phone** | Printed under the name |
| **Address** | Printed under the phone |
| **Thermal paper** | The width of the roll in *this* machine's printer — 58mm, 80mm, or type your own |

Each field saves as you click away from it. **Records** stays at zero until the
first bill is raised, which is what you want.

Settings are the one thing **Clear data** never wipes.

---

## 6. Add the products

**Products → + Add new** (or press `Ctrl+D`), one at a time: a photo, a name, a
product ID, the cost, the stock, and what is in the box.

Give related things a shared prefix — `KS-01`, `KS-02`, `KS-03` for kitchen sets
— because typing `KS` while billing brings all of them up in one list.

---

## 7. The printer

Windows setup, in short:

1. Install the driver that came with the thermal printer, or from the maker's
   website. Most 58/80mm printers ship a working Windows driver.
2. **Settings → Bluetooth & devices → Printers & scanners →** your printer **→
   Printing preferences**, and set the paper to the 80mm (or 58mm) roll size.
3. Make it the default printer.
4. In the app's print window set **Margins: None** and **Scale: 100**.

The rest — what goes wrong and why — is in
[THERMAL-PRINTER.md](THERMAL-PRINTER.md); the troubleshooting table there
applies to Windows just as much as Linux.

Until a thermal printer is installed, Windows only offers A4 and Letter in the
paper list. **Print receipt → Save as PDF** still produces a correctly sized
80mm-wide PDF, so you are not blocked.

---

## 8. Editing the files on Windows

You will not normally need to. If you do:

**Use a proper editor, not Notepad.** Notepad can rewrite line endings and save
files in an encoding Node will not read. Install one:

```powershell
winget install -e --id Microsoft.VisualStudioCode
```

Then right-click the **ORDER BILL MANAGER** folder → **Open with Code**.

The files worth knowing about:

| File | What is in it |
|---|---|
| `backend\server.js` | Every web address the app answers on, and the bill arithmetic |
| `backend\db.js` | The database shape, and the default settings |
| `frontend\src\screens\BillForm.jsx` | The bill screen and every key it responds to |
| `frontend\src\components\BillPrint.jsx` | What the bill looks like on paper |
| `frontend\src\styles.css` | All the styling, including both print layouts |
| `start-windows.bat` | What the desktop icon runs |

**After changing anything under `frontend\`, rebuild it** — the server hands out
the built copy, so an edited source file changes nothing until you do:

```powershell
npm --prefix frontend run build
```

Then reload the page with `Ctrl+Shift+R`.

Changes under `backend\` need the black window closed and `start-windows.bat`
run again.

---

## 9. Moving files between the two machines afterwards

Once both machines exist, the usual job is carrying an edited file across.

**Just the code, keeping the Windows machine's own book:** copy the changed
files over the top, then rebuild as above. Never copy `backend\orders.db` unless
you actually mean to replace the Windows machine's records with the Linux one's.

**A whole shop, records and all:** copy `backend\orders.db` too. Take it from
**Settings → Back up now** and use the file that appears in `backend\backups\`,
not the live `orders.db`. The database runs in WAL mode, so a bill saved a
minute ago can still be sitting in `orders.db-wal` and not in `orders.db` at
all; the backup button folds that in first and a plain file copy does not.

**Over the network instead of a USB stick:** with both machines on the same
wi-fi, from the Windows machine:

```powershell
scp -r username@LINUX-IP:"'/home/username/Desktop/ORDER BILL MANAGER'" .
```

`scp` is built into Windows 10 and 11. Find the Linux machine's address by
running `hostname -I` on it.

---

## 10. Check it works before the shop opens

Raise one throwaway bill and take it all the way through:

1. Press `Ctrl+N`
2. Leave the customer name blank — it should file as **Cash**
3. Type a product name, press `Enter` along the row
4. Check a product comes up when you type its ID
5. Press `Esc` — the cursor should jump to Packing
6. `Ctrl+S` to save, then **Save as PDF** and **Print receipt**
7. **✓ Mark completed** — it should leave the Orders list
8. **Orders → Completed** — it should be there, and **Print / share** should
   still produce the whole bill

Then clear it: **Settings → Clear data**, type `CONFIRM`. That empties orders
and products but keeps the shop details and paper size from step 5, leaving a
clean book that is already set up.

Press `?` at any time for the full list of keyboard shortcuts.

---

## Using it from a phone in the shop

The Windows machine serves the whole shop over wi-fi. Find its address:

```powershell
ipconfig | Select-String IPv4
```

Then on any phone on the same wi-fi, open `http://THAT-ADDRESS:4100`. Nothing to
install on the phone.

The first time, Windows Firewall will ask whether to allow Node.js — say yes for
**private networks**. If you clicked no by mistake:

```powershell
New-NetFirewallRule -DisplayName "Order Bill Manager" -Direction Inbound -LocalPort 4100 -Protocol TCP -Action Allow -Profile Private
```

---

## When it goes wrong

**Start here.** Instead of reading the error off the screen, run:

```powershell
.\check-windows.bat
```

It writes `check-report.txt` next to the app: Windows and Node versions, which
files arrived, whether the database library actually loads, and what is on port
4100. It changes nothing and is safe to run while the shop is billing. That file
is what to send on when asking for help — it holds no PINs, no customer details
and no prices.

| What you see | What it is |
|---|---|
| **The browser says "This site can't be reached"** | Almost always one of two things. Either the black window shows an error — read the table below — or the interface was never built. Since 2026-08-13 the server answers that case with a page explaining it instead of failing silently; if you get "Cannot GET /" you are on an older copy. Fix: `npm --prefix frontend install` then `npm --prefix frontend run build`. |
| **The page loads blank, or "Cannot GET /", but `http://localhost:4100/api/settings` returns text** | The server is fine; `frontend\dist` is missing. Same fix as above, or just run `start-windows.bat` again — it builds the interface itself. |
| `'node' is not recognized` | The terminal was open before Node was installed. Close it, open a new one. |
| `'npm' is not recognized` | Same cause, same fix. npm comes with Node. |
| `gyp ERR!` or a wall of red about `MSBuild` / `Visual Studio` | No ready-made database file for this Node version, so npm is trying to compile it. Two causes: either `backend\package.json` still says `better-sqlite3` `^9.6.0` (which stops at Node 21 — re-copy it and `package-lock.json` from the Linux machine, delete `backend\node_modules`, run again), or you are on Node 25 or newer (uninstall from **Add or remove programs**, redo step 1 with **22**). |
| `prebuild-install warn install No prebuilt binaries found` | The same thing, one line earlier. It is a warning, not the failure — the compile attempt underneath it is what fails. Same two causes as the row above. |
| `Error: Cannot find module 'better-sqlite3'` | The install did not finish. `npm --prefix backend install` |
| `invalid ELF header` or a `better-sqlite3` crash on start | `node_modules` was copied from the Linux machine. Delete both `node_modules` folders (step 2) and run `start-windows.bat` again. |
| `EADDRINUSE` on port 4100 | It is already running. Look for the other black window — or just run the icon again; it notices and opens the browser. |
| `running scripts is disabled on this system` | PowerShell's script policy. Run `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned` and answer `Y`. |
| The black window flashes and vanishes | Open PowerShell first, `cd` to the folder, then run `.\start-windows.bat` — the error stays on screen that way. |
| Changes to the code do not appear | The served copy is stale. `npm --prefix frontend run build`, then `Ctrl+Shift+R`. |
| Old orders showed up on the new machine | `backend\orders.db` was copied across. Stop the app, delete `orders.db*`, start again. |
| Database errors after a while, or a corrupt file | The folder is inside OneDrive. Move the whole app to `C:\ShopApp` and redo step 4. |
| `This does not look like the project folder` | The transfer arrived incomplete. Redo step 2 as a **zip**, not as loose downloaded files. |
| `Could not read package.json`, or npm complains about a path that stops at `ORDER` | Something ran `npm` against a path with spaces in it without quoting. `start-windows.bat` avoids this by changing directory instead; if you are typing npm by hand, `cd` into `backend` or `frontend` first rather than using `--prefix`. |
| `EPERM` or `operation not permitted` during npm install | Either the folder is in OneDrive, or PowerShell was opened as administrator on one run and normally on another. Delete both `node_modules` folders and reinstall from a normal window. |
| The install seemed to work but the app still will not open | Run `check-windows.bat`. The line to look at is under *Can Node actually load the database library?* — if it says FAILED, it is the Node version (step 1) whatever else looks right. |

### Running on a different port

If something else already uses 4100:

```powershell
$env:PORT=4200; .\start-windows.bat
```

To make it permanent, open `start-windows.bat` in an editor and change the
`set PORT=4100` line near the top.
