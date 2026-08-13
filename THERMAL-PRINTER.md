# Setting up the thermal printer

Written for Linux Mint / Ubuntu, which is what the shop machine runs. Windows
notes are at the bottom.

The app prints through the browser's own print window, so once the printer works
for *anything* on this machine it works for the app. Almost every problem people
hit is one of three things: the wrong driver, the wrong paper size, or Chrome
adding margins. This guide does them in that order.

> These steps have not been run against a physical printer here — no printer was
> attached to this machine. The output itself is verified: printing a receipt
> through Chrome produces a single page measuring **227.04 × 371.04 pt, which is
> exactly 80mm wide**, with all six columns and nothing hanging off the edge.

## "There is no thermal paper size in the print menu"

There will not be one until step 3 and 4 are done. Chrome's **Paper size** list is
read from the printer you have selected — it is not something a web page can add
to. With no thermal printer installed, the only destinations are *Save as PDF*
and whatever else is set up, and those offer A4 and Letter.

Two things follow:

- **The receipt itself is already the right size.** The app sets the page to
  80mm wide and exactly as long as the bill, so *Save as PDF* on **Print
  receipt** gives you an 80mm-wide PDF file today, before any driver exists. You
  can carry that file to any machine that has the printer.
- **To print straight onto the roll**, the printer has to exist in CUPS with a
  matching media size. That is steps 3 and 4 below, and once done the roll size
  appears in Chrome's paper list by itself.

---

## 1. Plug it in and check the machine sees it

```bash
lsusb
```

The printer shows up as something like `POS-80`, `Xprinter`, `ZJ-58`,
`Seiko Epson`, or a bare `Prolific`/`WCH` USB-serial chip. Write down the name.

```bash
ls -l /dev/usb/lp*
```

A `/dev/usb/lp0` means the kernel has claimed it and you are in good shape. If
nothing appears, try a different USB cable — a lot of till printers ship with a
charge-only cable — and a port straight on the machine rather than a hub.

## 2. Install the printing system

```bash
sudo apt update && sudo apt install cups printer-driver-all system-config-printer
```

Then add yourself to the printer admin group and log out and back in once:

```bash
sudo usermod -aG lpadmin "$USER"
```

## 3. Add the printer

Open **http://localhost:631** in the browser → **Administration** → **Add
Printer**. It asks for your Linux username and password.

1. Pick the printer under **Local Printers**. If it is listed twice, prefer the
   USB entry over the serial one.
2. Give it a short name with no spaces — `thermal` is a good choice, because you
   will type it later.
3. Tick **Share this printer** only if another machine needs it.
4. On the driver screen, try these in order and stop at the first that prints:
   - the manufacturer's own entry, if your printer's name is in the list
   - **Generic → Generic ESC/P Dot Matrix Printer**
   - **Generic → Raw Queue** *(last resort — see the note below)*

For the very common 58mm ESC/POS printers, the `zj-58` driver is more reliable
than anything in the stock list:

```bash
sudo apt install git cmake libcups2-dev libcupsimage2-dev
git clone https://github.com/klirichek/zj-58
cd zj-58 && make && sudo ./install.sh
```

Then add the printer again and choose **ZJ-58** as the driver.

> **About Raw Queue** — a raw queue passes bytes straight through untouched. It
> is right for a program that speaks ESC/POS itself, and wrong here: the browser
> sends a rendered page, and a raw queue will spit out pages of nonsense. Only
> use it if you know why.

## 4. Set the paper size

This is the step everyone skips and it is the one that cuts the totals off the
right-hand edge.

In **http://localhost:631** → **Printers** → your printer → **Set Default
Options** → **Media Size**.

- Choose **80 x 297mm** (or **58 x 297mm**) if it is offered.
- If only `Letter` and `A4` are offered, make a custom size:

```bash
lpadmin -p thermal -o media=Custom.80x297mm    # 80mm roll
lpadmin -p thermal -o media=Custom.58x297mm    # 58mm roll
```

Set it as the machine's default printer while you are there:

```bash
lpoptions -d thermal
```

Print the test page from the CUPS **Maintenance** menu. Do not carry on until
something comes out of the printer.

## 5. Tell the app the width

In the app: **Settings → Thermal paper → 58mm or 80mm**.

This has to match the roll physically in the machine. The app lays the receipt
out to that exact width — product names wrap inside their own column and the
amounts sit hard against the right edge — so a mismatch is what pushes the
totals off the paper.

If your roll is an odd width, press **Other** and type the millimetres.

## 6. Set the browser up once

Open a bill, press Save, choose **Print receipt**, and in the print window:

| Setting | Set it to |
|---|---|
| Destination | your thermal printer |
| Paper size | the 80mm (or 58mm) size from step 4 |
| Margins | **None** |
| Scale | **Default**, or 100 — never "Fit to page" |
| Headers and footers | **off** |
| Background graphics | off |

Chrome remembers these per printer, so this is a one-time job.

The receipt itself asks for `@page { size: 80mm auto; margin: 0 }`, which most
browsers honour — but the printer's own paper size wins where the two disagree,
which is why step 4 matters.

### Optional: printing without the dialog

If the counter should print the moment the button is pressed, start the browser
with kiosk printing:

```bash
google-chrome --kiosk-printing http://localhost:4100
```

Everything then goes straight to the default printer. **Save as PDF stops
working in that mode**, since there is no dialog left in which to choose it — so
only do this if the shop prints receipts and never files PDFs.

---

## When it goes wrong

| What you see | What it is |
|---|---|
| Pages of random characters and symbols | Raw queue, or a driver that is not for this printer. Go back to step 3. |
| Totals cut off the right edge | Paper size is still A4 or Letter. Step 4. Then check the app's width matches the roll. |
| Everything tiny in the middle of the roll | Scale is on "Fit to page". Set it to Default. |
| A wide blank margin down the left | Margins are not set to None. Step 6. |
| Feeds a lot of blank paper after each bill | Normal on many models — that is the printer's cut/feed setting, not the app. Look for a DIP switch or the vendor's utility. |
| Prints once then never again | Usually the USB cable or a hub. Plug straight into the machine. `sudo systemctl restart cups` after replugging. |
| Nothing at all, no error | Check it is not paused: `lpstat -p thermal`. Resume with `cupsenable thermal`. |
| Faint or patchy print | The roll is in upside down. Thermal paper only prints on one side — flip it. |

Check the queue at any time:

```bash
lpstat -t
```

---

## On Windows

1. Install the driver from the disc or the maker's site. Most 58/80mm printers
   ship a Windows driver that works straight away.
2. **Settings → Printers & scanners → your printer → Printing preferences** and
   set the paper to the 80mm (or 58mm) roll size.
3. Make it the default printer.
4. In the app's print window set **Margins: None** and **Scale: 100**, exactly
   as above.

Everything else — the app's Settings → Thermal paper, the troubleshooting
table — is the same.
