const path = require('path');
const fs = require('fs');
const express = require('express');
const multer = require('multer');

const { db, getSettings, setSetting, backup } = require('./db');
const { todayStr, nowStr } = require('./dates');

const app = express();
const PORT = process.env.PORT || 4100;
const UPLOADS = path.join(__dirname, 'uploads');
fs.mkdirSync(UPLOADS, { recursive: true });

app.use(express.json({ limit: '2mb' }));
// The app posts products as multipart (there is a photo) and everything else as
// JSON. Form-encoded is accepted too so a plain HTML form or a curl one-liner
// is not silently read as an empty body.
app.use(express.urlencoded({ extended: false, limit: '2mb' }));

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOADS),
  filename: (req, file, cb) => {
    const safe = file.originalname.replace(/[^a-zA-Z0-9.\-_]/g, '_');
    cb(null, `${Date.now()}-${safe}`);
  },
});
const upload = multer({
  storage,
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: (req, file, cb) => cb(null, /^image\//.test(file.mimetype)),
});

// Rupees are stored as REAL. Round at every boundary so a bill never shows
// 1234.5600000000001.
const money = (n) => Math.round((Number(n) || 0) * 100) / 100;
const num = (n) => (Number.isFinite(Number(n)) ? Number(n) : 0);
const str = (s) => (s === undefined || s === null ? '' : String(s).trim());

/* ---------------------------------------------------------------- products */

app.get('/api/products', (req, res) => {
  const q = str(req.query.q);
  let rows;
  if (q) {
    const like = `%${q}%`;
    rows = db
      .prepare(
        `SELECT * FROM products
          WHERE product_id LIKE ? OR name LIKE ?
          ORDER BY
            CASE WHEN product_id LIKE ? THEN 0 ELSE 1 END,
            product_id, name
          LIMIT 50`
      )
      .all(like, like, `${q}%`);
  } else {
    rows = db.prepare('SELECT * FROM products ORDER BY product_id, name').all();
  }
  res.json(rows);
});

app.post('/api/products', upload.single('image'), (req, res) => {
  const b = req.body || {};
  const name = str(b.name);
  const productId = str(b.product_id);
  if (!name) return res.status(400).json({ error: 'Product name is required' });
  if (!productId) return res.status(400).json({ error: 'Product ID is required' });

  const image = req.file ? `/uploads/${req.file.filename}` : '';
  const info = db
    .prepare(
      `INSERT INTO products (product_id, name, cost, stock, contents, image)
       VALUES (?, ?, ?, ?, ?, ?)`
    )
    .run(productId, name, money(b.cost), Math.trunc(num(b.stock)), str(b.contents), image);
  res.json(db.prepare('SELECT * FROM products WHERE id = ?').get(info.lastInsertRowid));
});

app.put('/api/products/:id', upload.single('image'), (req, res) => {
  const id = Number(req.params.id);
  const existing = db.prepare('SELECT * FROM products WHERE id = ?').get(id);
  if (!existing) return res.status(404).json({ error: 'Product not found' });

  const b = req.body || {};
  const name = str(b.name) || existing.name;
  const productId = str(b.product_id) || existing.product_id;
  // A product edited without touching the picture keeps the one it had.
  const image = req.file ? `/uploads/${req.file.filename}` : existing.image;

  db.prepare(
    `UPDATE products SET product_id = ?, name = ?, cost = ?, stock = ?, contents = ?, image = ?
      WHERE id = ?`
  ).run(
    productId,
    name,
    b.cost === undefined ? existing.cost : money(b.cost),
    b.stock === undefined ? existing.stock : Math.trunc(num(b.stock)),
    b.contents === undefined ? existing.contents : str(b.contents),
    image,
    id
  );
  res.json(db.prepare('SELECT * FROM products WHERE id = ?').get(id));
});

app.delete('/api/products/:id', (req, res) => {
  const id = Number(req.params.id);
  const existing = db.prepare('SELECT * FROM products WHERE id = ?').get(id);
  if (!existing) return res.status(404).json({ error: 'Product not found' });
  db.prepare('DELETE FROM products WHERE id = ?').run(id);
  // order_items keep their own product_name and rate, so past bills are
  // unaffected by a product leaving the catalogue.
  res.json({ ok: true });
});

/* ------------------------------------------------------------------ orders */

function itemsOf(orderId) {
  return db
    .prepare('SELECT * FROM order_items WHERE order_id = ? ORDER BY sr_no')
    .all(orderId);
}

function nextOrderNo() {
  const row = db.prepare('SELECT MAX(order_no) AS n FROM orders').get();
  return (row && row.n ? row.n : 0) + 1;
}

app.get('/api/orders/next-no', (req, res) => {
  res.json({ order_no: nextOrderNo() });
});

app.get('/api/orders', (req, res) => {
  const q = str(req.query.q);
  const date = str(req.query.date);
  // The counter's list is open orders only. History asks for the rest by name,
  // so a completed bill can never quietly reappear on the working list.
  const scope = str(req.query.scope) || 'active';
  let sql = 'SELECT * FROM orders';
  const args = [];
  const where = [];
  if (scope === 'active') where.push("IFNULL(completed_at,'') = ''");
  else if (scope === 'completed') where.push("IFNULL(completed_at,'') <> ''");
  if (q) {
    where.push(
      '(customer_name LIKE ? OR customer_phone LIKE ? OR address LIKE ? OR CAST(order_no AS TEXT) LIKE ?)'
    );
    const like = `%${q}%`;
    args.push(like, like, like, like);
  }
  if (date) {
    where.push('order_date = ?');
    args.push(date);
  }
  if (where.length) sql += ` WHERE ${where.join(' AND ')}`;
  sql += ' ORDER BY order_no DESC LIMIT 300';
  res.json(db.prepare(sql).all(...args));
});

// Every day that has orders, with a count and a day total — this is what the
// lifetime-orders calendar colours in.
app.get('/api/orders/by-date', (req, res) => {
  res.json(
    db
      .prepare(
        `SELECT order_date, COUNT(*) AS orders, SUM(grand_total) AS total
           FROM orders GROUP BY order_date ORDER BY order_date DESC`
      )
      .all()
  );
});

app.get('/api/customers', (req, res) => {
  res.json(
    db
      .prepare(
        `SELECT customer_name AS name,
                MAX(customer_phone) AS phone,
                MAX(address) AS address,
                COUNT(*) AS orders,
                SUM(grand_total) AS spent,
                SUM(pending) AS pending,
                MAX(order_date) AS last_order
           FROM orders
          GROUP BY LOWER(customer_name)
          ORDER BY last_order DESC, name`
      )
      .all()
  );
});

app.get('/api/orders/:id', (req, res) => {
  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(Number(req.params.id));
  if (!order) return res.status(404).json({ error: 'Order not found' });
  res.json({ ...order, items: itemsOf(order.id) });
});

// One place computes a bill's figures. The browser sends what was typed; every
// total on the saved order is worked out here, so an edited page cannot make
// a bill add up to something it does not.
function totalsFor(rawItems, packing, roundOff, oldBalance) {
  const items = [];
  let itemsTotal = 0;
  let totalQty = 0;
  let discountTotal = 0;

  rawItems.forEach((it, i) => {
    const name = str(it.product_name);
    const qty = num(it.qty);
    const rate = money(it.rate);
    // Cost defaults to qty x rate but is stored as sent, so a shopkeeper can
    // round a line off by hand without the app arguing.
    const cost = it.cost === '' || it.cost === undefined || it.cost === null
      ? money(qty * rate)
      : money(it.cost);
    const discount = num(it.discount);
    if (!name && !qty && !cost) return; // a blank trailing row is not an item
    const lineDiscount = money((cost * discount) / 100);
    const lineTotal = money(cost - lineDiscount);
    itemsTotal += lineTotal;
    discountTotal += lineDiscount;
    totalQty += qty;
    items.push({
      sr_no: i + 1,
      product_id: str(it.product_id),
      product_name: name,
      qty,
      rate,
      cost,
      discount,
      line_total: lineTotal,
    });
  });

  const pack = money(packing);
  const roundOffAmt = money(roundOff);
  const oldBal = money(oldBalance);
  const grand = money(itemsTotal + pack + oldBal + roundOffAmt);
  return {
    items,
    itemsTotal: money(itemsTotal),
    totalQty: money(totalQty),
    discountTotal: money(discountTotal),
    packing: pack,
    roundOff: roundOffAmt,
    oldBalance: oldBal,
    grand,
  };
}

function writeOrder(body, existing) {
  // A counter sale has no name attached to it and the biller should not have to
  // invent one. Blank becomes "Cash", so every bill still has something to file
  // it under and the customer list does not fill up with empty rows.
  const name = str(body.customer_name) || 'Cash';

  const t = totalsFor(Array.isArray(body.items) ? body.items : [], body.packing, body.round_off, body.old_balance);
  const paid = money(body.amount_paid);
  const pending = money(t.grand - paid);
  const now = nowStr();

  return db.transaction(() => {
    let id;
    if (existing) {
      db.prepare(
        `UPDATE orders SET customer_name = ?, customer_phone = ?, address = ?,
                packing = ?, amount_paid = ?, items_total = ?, grand_total = ?,
                pending = ?, total_qty = ?, total_discount = ?, round_off = ?, old_balance = ?,
                bill_type = ?, note = ?, updated_at = ?
          WHERE id = ?`
      ).run(
        name,
        str(body.customer_phone),
        str(body.address),
        t.packing,
        paid,
        t.itemsTotal,
        t.grand,
        pending,
        t.totalQty,
        t.discountTotal,
        t.roundOff,
        t.oldBalance,
        str(body.bill_type) || 'full',
        str(body.note),
        now,
        existing.id
      );
      db.prepare('DELETE FROM order_items WHERE order_id = ?').run(existing.id);
      id = existing.id;
    } else {
      // The number is taken inside the transaction, so two bills saved at the
      // same moment cannot both become #7.
      const info = db
        .prepare(
          `INSERT INTO orders (order_no, customer_name, customer_phone, address, packing,
                               amount_paid, items_total, grand_total, pending, total_qty,
                               total_discount, round_off, old_balance, bill_type, note, order_date, created_at, updated_at)
           VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
        )
        .run(
          nextOrderNo(),
          name,
          str(body.customer_phone),
          str(body.address),
          t.packing,
          paid,
          t.itemsTotal,
          t.grand,
          pending,
          t.totalQty,
          t.discountTotal,
          t.roundOff,
          t.oldBalance,
          str(body.bill_type) || 'full',
          str(body.note),
          str(body.order_date) || todayStr(),
          now,
          now
        );
      id = info.lastInsertRowid;
    }

    const insertItem = db.prepare(
      `INSERT INTO order_items (order_id, sr_no, product_id, product_name, qty, rate, cost, discount, line_total)
       VALUES (?,?,?,?,?,?,?,?,?)`
    );
    for (const it of t.items) {
      insertItem.run(
        id,
        it.sr_no,
        it.product_id,
        it.product_name,
        it.qty,
        it.rate,
        it.cost,
        it.discount,
        it.line_total
      );
    }

    // A product typed into a bill that the catalogue has never heard of is
    // added to it at the rate on that line, so it is there next time. Matched
    // by name, case-blind, so re-saving or editing a bill never duplicates it.
    if (str(body.bill_type) !== 'qty-rate') {
      const known = db.prepare('SELECT 1 FROM products WHERE LOWER(name) = LOWER(?)');
      const addProduct = db.prepare(
        'INSERT INTO products (product_id, name, cost, stock, contents, image) VALUES (?, ?, ?, 0, ?, ?)'
      );
      for (const it of t.items) {
        if (!it.product_name || it.product_id || known.get(it.product_name)) continue;
        // ID = first two letters of the name + the rate, e.g. "Kitchen set" at
        // 250 becomes KI250.
        const letters = it.product_name.replace(/[^\p{L}\p{N}]/gu, '').slice(0, 2).toUpperCase();
        addProduct.run(`${letters || 'PR'}${it.rate}`, it.product_name, it.rate, '', '');
      }
    }
    const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(id);
    return { ...order, items: itemsOf(id) };
  })();
}

app.post('/api/orders', (req, res) => {
  try {
    res.json(writeOrder(req.body || {}, null));
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

app.put('/api/orders/:id', (req, res) => {
  const existing = db.prepare('SELECT * FROM orders WHERE id = ?').get(Number(req.params.id));
  if (!existing) return res.status(404).json({ error: 'Order not found' });
  try {
    res.json(writeOrder(req.body || {}, existing));
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// Completing is a flag and a timestamp, never a delete: the bill, its lines and
// its figures stay exactly as they were so it can still be opened, printed and
// shared months later.
app.post('/api/orders/:id/complete', (req, res) => {
  const id = Number(req.params.id);
  const existing = db.prepare('SELECT * FROM orders WHERE id = ?').get(id);
  if (!existing) return res.status(404).json({ error: 'Order not found' });
  const done = (req.body || {}).completed !== false;
  db.prepare('UPDATE orders SET completed_at = ?, updated_at = ? WHERE id = ?').run(
    done ? nowStr() : '',
    nowStr(),
    id
  );
  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(id);
  res.json({ ...order, items: itemsOf(id) });
});

app.delete('/api/orders/:id', (req, res) => {
  const id = Number(req.params.id);
  const existing = db.prepare('SELECT * FROM orders WHERE id = ?').get(id);
  if (!existing) return res.status(404).json({ error: 'Order not found' });
  db.prepare('DELETE FROM order_items WHERE order_id = ?').run(id);
  db.prepare('DELETE FROM orders WHERE id = ?').run(id);
  res.json({ ok: true });
});

/* ---------------------------------------------------------------- settings */

// Settings and the shop's running totals travel together. Saving a setting used
// to reply with the settings alone, and the browser — which replaces its whole
// settings object with the reply — lost every figure in Records the moment a
// field was touched. One builder for both routes, so they cannot drift again.
function settingsPayload() {
  const stats = db
    .prepare(
      `SELECT COUNT(*) AS orders, COALESCE(SUM(grand_total),0) AS revenue,
              COALESCE(SUM(pending),0) AS pending,
              COALESCE(SUM(amount_paid),0) AS collected,
              -- COALESCE, because SUM over no rows at all is NULL, and a brand
              -- new shop with an empty book is exactly that case.
              COALESCE(SUM(CASE WHEN IFNULL(completed_at,'') = '' THEN 1 ELSE 0 END),0) AS open,
              COALESCE(SUM(CASE WHEN pending > 0 THEN 1 ELSE 0 END),0) AS unpaid_orders
         FROM orders`
    )
    .get();
  // How many people owe, not how many bills are unpaid — one wholesaler with
  // four open bills is one person to chase.
  const owing = db
    .prepare(
      `SELECT COUNT(*) AS n FROM (
         SELECT customer_name FROM orders
          GROUP BY LOWER(customer_name)
         HAVING SUM(pending) > 0
       )`
    )
    .get();
  const products = db.prepare('SELECT COUNT(*) AS n FROM products').get();
  return {
    ...getSettings(),
    _stats: { ...stats, products: products.n, customers_owing: owing.n },
  };
}

app.get('/api/settings', (req, res) => {
  res.json(settingsPayload());
});

app.put('/api/settings', (req, res) => {
  const allowed = ['shop_name', 'shop_phone', 'shop_address', 'thermal_width', 'currency'];
  for (const [k, v] of Object.entries(req.body || {})) {
    if (allowed.includes(k)) setSetting(k, v);
  }
  res.json(settingsPayload());
});

// Clear data wipes orders and products but never settings — that is the shop's
// own name, phone and paper size, and losing it means setting the app up again.
app.post('/api/settings/clear-data', (req, res) => {
  if (str((req.body || {}).confirm) !== 'CONFIRM') {
    return res.status(400).json({ error: 'Type CONFIRM to clear all data' });
  }
  const file = backup('before-clear');
  db.transaction(() => {
    db.prepare('DELETE FROM order_items').run();
    db.prepare('DELETE FROM orders').run();
    db.prepare('DELETE FROM products').run();
    db.prepare("DELETE FROM sqlite_sequence WHERE name IN ('orders','order_items','products')").run();
  })();
  res.json({ ok: true, backup: path.basename(file) });
});

app.post('/api/settings/backup', (req, res) => {
  res.json({ ok: true, backup: path.basename(backup('manual')) });
});

/* ----------------------------------------------------------------- static */

app.use('/uploads', express.static(UPLOADS));

const DIST = path.join(__dirname, '..', 'frontend', 'dist');
// index.html, not the folder: an interrupted build leaves the folder behind with
// nothing useful in it, and that looked identical to a working install.
const BUILT = fs.existsSync(path.join(DIST, 'index.html'));

if (BUILT) {
  app.use(express.static(DIST));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api/')) return next();
    res.sendFile(path.join(DIST, 'index.html'));
  });
} else {
  // Without this the API answers perfectly and every other address returns
  // Express's bare "Cannot GET /", which reads as a broken server rather than
  // as an unbuilt one. It cost a whole install to work that out once.
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api/')) return next();
    res.status(503).type('html').send(
      `<!doctype html><meta charset="utf-8">
<title>Not built yet</title>
<style>body{font-family:system-ui,-apple-system,Segoe UI,sans-serif;max-width:34rem;
margin:12vh auto;padding:0 1.5rem;color:#1d1d1f;line-height:1.55}
code{background:#f5f5f7;padding:.15rem .4rem;border-radius:4px;font-size:.95em}
p{color:#6e6e73}</style>
<h2>The server is running. The interface has not been built.</h2>
<p>The server is fine — this page came from it. What is missing is
<code>frontend/dist</code>, which is made once, on this machine.</p>
<p>In the project folder run:</p>
<pre><code>npm --prefix frontend install
npm --prefix frontend run build</code></pre>
<p>On Windows, closing this and running <code>start-windows.bat</code> again does
both by itself. Then reload this page.</p>`
    );
  });
}

app.listen(PORT, () => {
  console.log(`Order Bill Manager running on http://localhost:${PORT}`);
  if (!BUILT) {
    console.log('');
    console.log('  WARNING: frontend/dist/index.html is missing, so only the API');
    console.log('  is being served. Build the interface with:');
    console.log('      npm --prefix frontend install');
    console.log('      npm --prefix frontend run build');
    console.log('');
  }
});
