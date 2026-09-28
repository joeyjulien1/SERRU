-- SERRU LAB database schema (SQLite).
-- Every statement is idempotent; this file runs each time the database is opened.

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS media (
  id          INTEGER PRIMARY KEY,
  file        TEXT    NOT NULL UNIQUE,          -- relative path of the large rendition
  thumb       TEXT    NOT NULL,                 -- relative path of the thumbnail rendition
  width       INTEGER NOT NULL DEFAULT 0,
  height      INTEGER NOT NULL DEFAULT 0,
  alt         TEXT    NOT NULL DEFAULT '',
  created_at  TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS categories (
  id           INTEGER PRIMARY KEY,
  slug         TEXT    NOT NULL UNIQUE,
  name         TEXT    NOT NULL,
  description  TEXT    NOT NULL DEFAULT '',
  media_id     INTEGER REFERENCES media(id) ON DELETE SET NULL,
  position     INTEGER NOT NULL DEFAULT 0,
  created_at   TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS products (
  id             INTEGER PRIMARY KEY,
  slug           TEXT    NOT NULL UNIQUE,
  title          TEXT    NOT NULL,
  category_id    INTEGER REFERENCES categories(id) ON DELETE SET NULL,
  description    TEXT    NOT NULL DEFAULT '',
  materials      TEXT    NOT NULL DEFAULT '',
  status         TEXT    NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'draft', 'archived')),
  is_hot         INTEGER NOT NULL DEFAULT 0,
  is_one_of_one  INTEGER NOT NULL DEFAULT 0,
  made_to_order  INTEGER NOT NULL DEFAULT 0,
  lead_time      TEXT    NOT NULL DEFAULT '',
  sales_count    INTEGER NOT NULL DEFAULT 0,
  created_at     TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at     TEXT    NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category_id);
CREATE INDEX IF NOT EXISTS idx_products_status ON products(status);

CREATE TABLE IF NOT EXISTS product_images (
  product_id  INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  media_id    INTEGER NOT NULL REFERENCES media(id) ON DELETE CASCADE,
  position    INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (product_id, media_id)
);

-- Sizes. Each product has at least one; stock NULL means unlimited / made to order.
CREATE TABLE IF NOT EXISTS variants (
  id                INTEGER PRIMARY KEY,
  product_id        INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  label             TEXT    NOT NULL,
  sku               TEXT    NOT NULL DEFAULT '',
  price_cents       INTEGER NOT NULL CHECK (price_cents >= 0),
  compare_at_cents  INTEGER CHECK (compare_at_cents IS NULL OR compare_at_cents >= 0),
  stock             INTEGER CHECK (stock IS NULL OR stock >= 0),
  position          INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_variants_product ON variants(product_id);

CREATE TABLE IF NOT EXISTS customers (
  id                 INTEGER PRIMARY KEY,
  email              TEXT    NOT NULL UNIQUE COLLATE NOCASE,
  password_hash      TEXT    NOT NULL,
  first_name         TEXT    NOT NULL DEFAULT '',
  last_name          TEXT    NOT NULL DEFAULT '',
  phone              TEXT    NOT NULL DEFAULT '',
  accepts_marketing  INTEGER NOT NULL DEFAULT 0,
  default_address    TEXT,                       -- JSON snapshot of the last saved shipping address
  created_at         TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS admins (
  id             INTEGER PRIMARY KEY,
  email          TEXT    NOT NULL UNIQUE COLLATE NOCASE,
  name           TEXT    NOT NULL,
  password_hash  TEXT    NOT NULL,
  role           TEXT    NOT NULL DEFAULT 'staff' CHECK (role IN ('owner', 'staff')),
  last_login_at  TEXT,
  created_at     TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- Session ids are stored as SHA-256 hashes of the cookie token.
CREATE TABLE IF NOT EXISTS sessions (
  id          TEXT    PRIMARY KEY,
  kind        TEXT    NOT NULL CHECK (kind IN ('customer', 'admin')),
  user_id     INTEGER NOT NULL,
  expires_at  INTEGER NOT NULL,
  created_at  TEXT    NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(kind, user_id);

CREATE TABLE IF NOT EXISTS password_resets (
  token_hash   TEXT    PRIMARY KEY,
  customer_id  INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  expires_at   INTEGER NOT NULL,
  used         INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS orders (
  id                  INTEGER PRIMARY KEY,
  number              INTEGER NOT NULL UNIQUE,
  public_token        TEXT    NOT NULL UNIQUE,
  customer_id         INTEGER REFERENCES customers(id) ON DELETE SET NULL,
  email               TEXT    NOT NULL,
  phone               TEXT    NOT NULL DEFAULT '',
  ship_name           TEXT    NOT NULL,
  ship_address1       TEXT    NOT NULL,
  ship_address2       TEXT    NOT NULL DEFAULT '',
  ship_city           TEXT    NOT NULL,
  ship_region         TEXT    NOT NULL DEFAULT '',
  ship_postal         TEXT    NOT NULL DEFAULT '',
  ship_country        TEXT    NOT NULL,
  notes               TEXT    NOT NULL DEFAULT '',
  currency            TEXT    NOT NULL,
  subtotal_cents      INTEGER NOT NULL,
  shipping_cents      INTEGER NOT NULL,
  total_cents         INTEGER NOT NULL,
  -- tap: card via Tap Payments · cod: cash on delivery · test: built-in test checkout (development)
  payment_provider    TEXT    NOT NULL CHECK (payment_provider IN ('tap', 'cod', 'test')),
  payment_ref         TEXT,
  payment_status      TEXT    NOT NULL DEFAULT 'pending'
                        CHECK (payment_status IN ('pending', 'paid', 'failed', 'expired', 'refunded')),
  fulfillment_status  TEXT    NOT NULL DEFAULT 'unfulfilled'
                        CHECK (fulfillment_status IN ('unfulfilled', 'processing', 'shipped', 'delivered', 'cancelled')),
  stock_reserved      INTEGER NOT NULL DEFAULT 1,
  reserved_until      INTEGER NOT NULL DEFAULT 0,
  tracking_number     TEXT    NOT NULL DEFAULT '',
  admin_note          TEXT    NOT NULL DEFAULT '',
  paid_at             TEXT,
  created_at          TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at          TEXT    NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_orders_customer ON orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_orders_payment ON orders(payment_status);
CREATE INDEX IF NOT EXISTS idx_orders_created ON orders(created_at);

CREATE TABLE IF NOT EXISTS order_items (
  id                INTEGER PRIMARY KEY,
  order_id          INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id        INTEGER REFERENCES products(id) ON DELETE SET NULL,
  variant_id        INTEGER REFERENCES variants(id) ON DELETE SET NULL,
  title             TEXT    NOT NULL,
  variant_label     TEXT    NOT NULL,
  image             TEXT,
  unit_price_cents  INTEGER NOT NULL,
  quantity          INTEGER NOT NULL CHECK (quantity > 0),
  reserved_qty      INTEGER NOT NULL DEFAULT 0      -- units taken from a stock-limited size
);
CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items(order_id);

CREATE TABLE IF NOT EXISTS transactions (
  id            INTEGER PRIMARY KEY,
  order_id      INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  kind          TEXT    NOT NULL CHECK (kind IN ('charge', 'refund')),
  status        TEXT    NOT NULL CHECK (status IN ('succeeded', 'failed')),
  provider      TEXT    NOT NULL,
  provider_ref  TEXT,
  amount_cents  INTEGER NOT NULL,
  currency      TEXT    NOT NULL,
  card_brand    TEXT    NOT NULL DEFAULT '',
  card_last4    TEXT    NOT NULL DEFAULT '',
  message       TEXT    NOT NULL DEFAULT '',
  created_at    TEXT    NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_transactions_order ON transactions(order_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_transactions_ref
  ON transactions(provider, provider_ref, kind, status) WHERE provider_ref IS NOT NULL;

CREATE TABLE IF NOT EXISTS settings (
  key    TEXT PRIMARY KEY,
  value  TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS pages (
  slug        TEXT PRIMARY KEY,
  title       TEXT NOT NULL,
  body        TEXT NOT NULL DEFAULT '',
  updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS subscribers (
  id          INTEGER PRIMARY KEY,
  email       TEXT NOT NULL UNIQUE COLLATE NOCASE,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS messages (
  id          INTEGER PRIMARY KEY,
  name        TEXT    NOT NULL,
  email       TEXT    NOT NULL,
  phone       TEXT    NOT NULL DEFAULT '',
  subject     TEXT    NOT NULL DEFAULT '',
  body        TEXT    NOT NULL,
  is_read     INTEGER NOT NULL DEFAULT 0,
  created_at  TEXT    NOT NULL DEFAULT (datetime('now'))
);
