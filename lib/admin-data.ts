import 'server-only';
import { all, get } from './db';
import { countToFulfil } from './orders';

export type DailyRevenue = { date: string; cents: number; orders: number };

/** Paid revenue per UTC day for the last `days` days (including today), zero-filled. */
export async function revenueByDay(days = 30): Promise<DailyRevenue[]> {
  const rows = await all<{ day: string; cents: number; orders: number }>(
    `SELECT date(paid_at) AS day, SUM(total_cents) AS cents, COUNT(*) AS orders
     FROM orders
     WHERE payment_status IN ('paid', 'refunded') AND paid_at >= date('now', ?)
     GROUP BY day`,
    `-${days - 1} days`,
  );
  const byDay = new Map(rows.map((r) => [r.day, r]));
  const out: DailyRevenue[] = [];
  const today = new Date();
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() - i));
    const key = d.toISOString().slice(0, 10);
    const r = byDay.get(key);
    out.push({ date: key, cents: r?.cents ?? 0, orders: r?.orders ?? 0 });
  }
  return out;
}

export type DashboardStats = {
  revenue30: number;
  revenuePrev30: number;
  orders30: number;
  ordersPrev30: number;
  toFulfil: number;
  customers: number;
  newCustomers30: number;
  refunds30: number;
};

export async function dashboardStats(): Promise<DashboardStats> {
  const period = async (from: string, to: string) =>
    (await get<{ cents: number; n: number }>(
      `SELECT COALESCE(SUM(total_cents), 0) AS cents, COUNT(*) AS n FROM orders
       WHERE payment_status = 'paid' AND paid_at >= datetime('now', ?) AND paid_at < datetime('now', ?)`,
      from,
      to,
    )) ?? { cents: 0, n: 0 };
  const [cur, prev, toFulfil, customers, newCustomers, refunds] = await Promise.all([
    period('-30 days', '+1 day'),
    period('-60 days', '-30 days'),
    countToFulfil(),
    get<{ n: number }>('SELECT COUNT(*) AS n FROM customers'),
    get<{ n: number }>("SELECT COUNT(*) AS n FROM customers WHERE created_at >= datetime('now', '-30 days')"),
    get<{ cents: number }>(
      "SELECT COALESCE(SUM(amount_cents), 0) AS cents FROM transactions WHERE kind = 'refund' AND created_at >= datetime('now', '-30 days')",
    ),
  ]);
  return {
    revenue30: cur.cents,
    revenuePrev30: prev.cents,
    orders30: cur.n,
    ordersPrev30: prev.n,
    toFulfil,
    customers: customers?.n ?? 0,
    newCustomers30: newCustomers?.n ?? 0,
    refunds30: refunds?.cents ?? 0,
  };
}

export async function topProducts(limit = 5): Promise<{ productId: number | null; title: string; units: number; cents: number }[]> {
  const rows = await all<{ product_id: number | null; title: string; units: number; cents: number }>(
    `SELECT oi.product_id, oi.title, SUM(oi.quantity) AS units, SUM(oi.quantity * oi.unit_price_cents) AS cents
     FROM order_items oi JOIN orders o ON o.id = oi.order_id
     WHERE o.payment_status = 'paid' AND o.paid_at >= datetime('now', '-90 days')
     GROUP BY COALESCE(oi.product_id, oi.title) ORDER BY units DESC, cents DESC LIMIT ?`,
    limit,
  );
  return rows.map((r) => ({ productId: r.product_id, title: r.title, units: r.units, cents: r.cents }));
}

export async function lowStock(threshold = 2): Promise<{ productId: number; title: string; label: string; stock: number }[]> {
  const rows = await all<{ product_id: number; title: string; label: string; stock: number }>(
    `SELECT p.id AS product_id, p.title, v.label, v.stock FROM variants v JOIN products p ON p.id = v.product_id
     WHERE p.status = 'active' AND v.stock IS NOT NULL AND v.stock <= ? ORDER BY v.stock, p.title LIMIT 8`,
    threshold,
  );
  return rows.map((r) => ({ productId: r.product_id, title: r.title, label: r.label, stock: r.stock }));
}

// ───────────── Customers ─────────────

export type CustomerRow = {
  id: number;
  email: string;
  name: string;
  phone: string;
  acceptsMarketing: boolean;
  orders: number;
  spentCents: number;
  createdAt: string;
};

export async function listCustomers(q = '', limit = 25, offset = 0): Promise<{ items: CustomerRow[]; total: number }> {
  const like = '%' + q.trim().replace(/[\\%_]/g, (m) => '\\' + m) + '%';
  const where = q.trim()
    ? "WHERE c.email LIKE ? ESCAPE '\\' OR c.first_name LIKE ? ESCAPE '\\' OR c.last_name LIKE ? ESCAPE '\\' OR c.phone LIKE ? ESCAPE '\\'"
    : '';
  const params = q.trim() ? [like, like, like, like] : [];
  const [count, rows] = await Promise.all([
    get<{ n: number }>(`SELECT COUNT(*) AS n FROM customers c ${where}`, ...params),
    all<{
      id: number;
      email: string;
      first_name: string;
      last_name: string;
      phone: string;
      accepts_marketing: number;
      orders: number;
      spent: number;
      created_at: string;
    }>(
      `SELECT c.id, c.email, c.first_name, c.last_name, c.phone, c.accepts_marketing, c.created_at,
         (SELECT COUNT(*) FROM orders o WHERE o.customer_id = c.id AND o.payment_status = 'paid') AS orders,
         (SELECT COALESCE(SUM(total_cents), 0) FROM orders o WHERE o.customer_id = c.id AND o.payment_status = 'paid') AS spent
       FROM customers c ${where} ORDER BY c.created_at DESC, c.id DESC LIMIT ? OFFSET ?`,
      ...params,
      limit,
      offset,
    ),
  ]);
  const items = rows.map((r) => ({
    id: r.id,
    email: r.email,
    name: `${r.first_name} ${r.last_name}`.trim(),
    phone: r.phone,
    acceptsMarketing: r.accepts_marketing === 1,
    orders: r.orders,
    spentCents: r.spent,
    createdAt: r.created_at,
  }));
  return { items, total: count?.n ?? 0 };
}

// ───────────── Inbox ─────────────

export type Message = {
  id: number;
  name: string;
  email: string;
  phone: string;
  subject: string;
  body: string;
  isRead: boolean;
  createdAt: string;
};

export async function listMessages(): Promise<Message[]> {
  const rows = await all<{ id: number; name: string; email: string; phone: string; subject: string; body: string; is_read: number; created_at: string }>(
    'SELECT * FROM messages ORDER BY created_at DESC, id DESC LIMIT 200',
  );
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    email: r.email,
    phone: r.phone,
    subject: r.subject,
    body: r.body,
    isRead: r.is_read === 1,
    createdAt: r.created_at,
  }));
}

export async function unreadMessages(): Promise<number> {
  return (await get<{ n: number }>('SELECT COUNT(*) AS n FROM messages WHERE is_read = 0'))?.n ?? 0;
}

export async function listSubscribers(): Promise<{ id: number; email: string; createdAt: string }[]> {
  const rows = await all<{ id: number; email: string; created_at: string }>('SELECT id, email, created_at FROM subscribers ORDER BY created_at DESC, id DESC');
  return rows.map((r) => ({ id: r.id, email: r.email, createdAt: r.created_at }));
}

export async function listAdmins(): Promise<{ id: number; email: string; name: string; role: 'owner' | 'staff'; lastLoginAt: string | null }[]> {
  const rows = await all<{ id: number; email: string; name: string; role: 'owner' | 'staff'; last_login_at: string | null }>(
    'SELECT id, email, name, role, last_login_at FROM admins ORDER BY role, id',
  );
  return rows.map((r) => ({ id: r.id, email: r.email, name: r.name, role: r.role, lastLoginAt: r.last_login_at }));
}
