const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');

const DB_PATH = process.env.DB_PATH || path.join(__dirname, 'orders.db');

const db = new Database(DB_PATH);
// WAL keeps writes fast on a single shop machine. It also means a committed
// order can live only in orders.db-wal, so anything that copies the file must
// checkpoint first (see backup() below).
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS products (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    product_id    TEXT NOT NULL,
    name          TEXT NOT NULL,
    cost          REAL DEFAULT 0,
    stock         INTEGER DEFAULT 0,
    contents      TEXT DEFAULT '',
    image         TEXT DEFAULT '',
    created_at    TEXT DEFAULT (datetime('now','localtime'))
  );

  CREATE TABLE IF NOT EXISTS orders (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    order_no       INTEGER NOT NULL,
    customer_name  TEXT NOT NULL,
    customer_phone TEXT DEFAULT '',
    address        TEXT DEFAULT '',
    packing        REAL DEFAULT 0,
    amount_paid    REAL DEFAULT 0,
    items_total    REAL DEFAULT 0,
    grand_total    REAL DEFAULT 0,
    pending        REAL DEFAULT 0,
    total_qty      REAL DEFAULT 0,
    bill_type      TEXT DEFAULT 'full',
    note           TEXT DEFAULT '',
    order_date     TEXT NOT NULL,
    created_at     TEXT NOT NULL,
    updated_at     TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS order_items (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id     INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    sr_no        INTEGER NOT NULL,
    product_id   TEXT DEFAULT '',
    product_name TEXT DEFAULT '',
    qty          REAL DEFAULT 0,
    rate         REAL DEFAULT 0,
    cost         REAL DEFAULT 0,
    discount     REAL DEFAULT 0,
    line_total   REAL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS settings (
    key   TEXT PRIMARY KEY,
    value TEXT
  );

  CREATE INDEX IF NOT EXISTS idx_items_order ON order_items(order_id);
  CREATE INDEX IF NOT EXISTS idx_orders_date ON orders(order_date);
  CREATE INDEX IF NOT EXISTS idx_orders_no   ON orders(order_no);
  CREATE INDEX IF NOT EXISTS idx_products_pid ON products(product_id);
`);

// Adding a column later must migrate a shop's existing database in place,
// never ask for a wipe.
function ensureColumn(table, column, definition) {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all();
  if (!cols.some((c) => c.name === column)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
}

ensureColumn('products', 'contents', "TEXT DEFAULT ''");
ensureColumn('orders', 'bill_type', "TEXT DEFAULT 'full'");
ensureColumn('orders', 'note', "TEXT DEFAULT ''");
// When the order was marked done. Empty means it is still open and still on the
// counter's list. Nothing is ever deleted — completing only moves it out of the
// way, and the bill stays whole and printable.
ensureColumn('orders', 'completed_at', "TEXT DEFAULT ''");
// What the discounts came to in rupees. Derivable from the lines, but stored so
// an old bill still shows the figure it was printed with even if the rounding
// rules ever change.
ensureColumn('orders', 'total_discount', 'REAL DEFAULT 0');
// The adjustment applied when the biller rounds an odd total off to a whole
// rupee — positive when it rounded up, negative down. grand_total already has
// this folded in (it is what was actually charged); this is kept separately,
// the same way total_discount is, purely so an old bill can still explain
// itself later ("why is this ₹142 and not ₹141.80").
ensureColumn('orders', 'round_off', 'REAL DEFAULT 0');

const DEFAULT_SETTINGS = {
  shop_name: 'Order Bill Manager',
  shop_phone: '',
  shop_address: '',
  thermal_width: '80', // mm
  currency: '₹',
};

const insertSetting = db.prepare(
  'INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)'
);
for (const [k, v] of Object.entries(DEFAULT_SETTINGS)) insertSetting.run(k, v);

function getSettings() {
  const rows = db.prepare('SELECT key, value FROM settings').all();
  const out = { ...DEFAULT_SETTINGS };
  for (const r of rows) out[r.key] = r.value;
  return out;
}

function setSetting(key, value) {
  db.prepare(
    'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value'
  ).run(key, String(value));
}

// A copy of the database written before anything destructive. This is the only
// undo the app has — the owner swaps the file back by hand.
function backup(label = 'backup') {
  const dir = path.join(__dirname, 'backups');
  fs.mkdirSync(dir, { recursive: true });
  const stamp = new Date()
    .toLocaleString('sv-SE')
    .replace(/[: ]/g, '-');
  const target = path.join(dir, `${label}-${stamp}.db`);
  // VACUUM INTO folds the WAL in, so the copy holds the most recent trading.
  // A plain file copy would silently miss it.
  db.exec(`VACUUM INTO '${target.replace(/'/g, "''")}'`);
  return target;
}

module.exports = { db, getSettings, setSetting, backup, DB_PATH };
