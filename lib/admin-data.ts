import 'server-only';
import { all, get } from './db';

export type Overview = {
  activeProducts: number;
  hiddenProducts: number;
  categories: number;
  unreadMessages: number;
  subscribers: number;
};

/** Counts for the admin dashboard. */
export async function overview(): Promise<Overview> {
  const [products, categories, unread, subscribers] = await Promise.all([
    get<{ active: number; hidden: number }>(
      "SELECT COALESCE(SUM(status = 'active'), 0) AS active, COALESCE(SUM(status <> 'active'), 0) AS hidden FROM products",
    ),
    get<{ n: number }>('SELECT COUNT(*) AS n FROM categories'),
    unreadMessages(),
    get<{ n: number }>('SELECT COUNT(*) AS n FROM subscribers'),
  ]);
  return {
    activeProducts: products?.active ?? 0,
    hiddenProducts: products?.hidden ?? 0,
    categories: categories?.n ?? 0,
    unreadMessages: unread,
    subscribers: subscribers?.n ?? 0,
  };
}

export async function lowStock(threshold = 2): Promise<{ productId: number; title: string; label: string; stock: number }[]> {
  const rows = await all<{ product_id: number; title: string; label: string; stock: number }>(
    `SELECT p.id AS product_id, p.title, v.label, v.stock FROM variants v JOIN products p ON p.id = v.product_id
     WHERE p.status = 'active' AND v.stock IS NOT NULL AND v.stock <= ? ORDER BY v.stock, p.title LIMIT 8`,
    threshold,
  );
  return rows.map((r) => ({ productId: r.product_id, title: r.title, label: r.label, stock: r.stock }));
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
