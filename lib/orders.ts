import 'server-only';
import crypto from 'node:crypto';
import { all, get, run, tx } from './db';
import { mediaUrl } from './media';
import { getSettings, shippingRules } from './settings';
import { shippingFor } from './shipping';

export const MAX_LINE_QUANTITY = 20;
export const RESERVATION_MS = 30 * 60 * 1000;

export type PaymentStatus = 'pending' | 'paid' | 'failed' | 'expired' | 'refunded';
export type FulfillmentStatus = 'unfulfilled' | 'processing' | 'shipped' | 'delivered' | 'cancelled';
export const FULFILLMENT_STATUSES: FulfillmentStatus[] = ['unfulfilled', 'processing', 'shipped', 'delivered', 'cancelled'];
export const PAYMENT_STATUSES: PaymentStatus[] = ['pending', 'paid', 'failed', 'expired', 'refunded'];

// ───────────────────────── Cart pricing ─────────────────────────

export type CartLineInput = { variantId: number; quantity: number };

export type PricedLine = {
  variantId: number;
  productId: number;
  slug: string;
  title: string;
  variantLabel: string;
  image: string | null;
  unitPriceCents: number;
  compareAtCents: number | null;
  quantity: number;
  lineTotalCents: number;
  stock: number | null;
  maxQuantity: number;
};

export type CartProblem = { variantId: number; message: string };

export type PricedCart = {
  lines: PricedLine[];
  problems: CartProblem[];
  subtotalCents: number;
  shippingCents: number;
  totalCents: number;
  currency: string;
};

type VariantLookupRow = {
  variant_id: number;
  label: string;
  price_cents: number;
  compare_at_cents: number | null;
  stock: number | null;
  product_id: number;
  slug: string;
  title: string;
  status: string;
  thumb: string | null;
};

/** Prices a cart from the database. Client-supplied prices are never trusted. */
export function priceCart(input: CartLineInput[]): PricedCart {
  const settings = getSettings();
  const merged = new Map<number, number>();
  for (const line of input) {
    if (!Number.isInteger(line.variantId) || line.variantId <= 0) continue;
    const qty = Math.floor(Number(line.quantity));
    if (!Number.isFinite(qty) || qty <= 0) continue;
    merged.set(line.variantId, (merged.get(line.variantId) ?? 0) + qty);
  }

  const ids = [...merged.keys()].slice(0, 100);
  const rows = ids.length
    ? all<VariantLookupRow>(
        `SELECT v.id AS variant_id, v.label, v.price_cents, v.compare_at_cents, v.stock,
                p.id AS product_id, p.slug, p.title, p.status,
                (SELECT m.thumb FROM product_images pi JOIN media m ON m.id = pi.media_id
                 WHERE pi.product_id = p.id ORDER BY pi.position, m.id LIMIT 1) AS thumb
         FROM variants v JOIN products p ON p.id = v.product_id
         WHERE v.id IN (${ids.map(() => '?').join(',')})`,
        ...ids,
      )
    : [];
  const byId = new Map(rows.map((r) => [r.variant_id, r]));

  const lines: PricedLine[] = [];
  const problems: CartProblem[] = [];
  for (const id of ids) {
    const r = byId.get(id);
    const requested = merged.get(id) ?? 0;
    if (!r || r.status !== 'active') {
      problems.push({ variantId: id, message: 'An item in your cart is no longer available and was removed.' });
      continue;
    }
    const maxQuantity = Math.min(MAX_LINE_QUANTITY, r.stock ?? MAX_LINE_QUANTITY);
    if (maxQuantity <= 0) {
      problems.push({ variantId: id, message: `${r.title} (${r.label}) just sold out and was removed.` });
      continue;
    }
    let quantity = requested;
    if (quantity > maxQuantity) {
      quantity = maxQuantity;
      problems.push({
        variantId: id,
        message:
          r.stock !== null && r.stock < MAX_LINE_QUANTITY
            ? `Only ${r.stock} left of ${r.title} (${r.label}). Quantity updated.`
            : `Maximum ${MAX_LINE_QUANTITY} per size. Quantity updated.`,
      });
    }
    lines.push({
      variantId: id,
      productId: r.product_id,
      slug: r.slug,
      title: r.title,
      variantLabel: r.label,
      image: r.thumb ? mediaUrl(r.thumb) : null,
      unitPriceCents: r.price_cents,
      compareAtCents: r.compare_at_cents && r.compare_at_cents > r.price_cents ? r.compare_at_cents : null,
      quantity,
      lineTotalCents: r.price_cents * quantity,
      stock: r.stock,
      maxQuantity,
    });
  }

  const subtotalCents = lines.reduce((sum, l) => sum + l.lineTotalCents, 0);
  const shippingCents = shippingFor(subtotalCents, shippingRules(settings));
  return {
    lines,
    problems,
    subtotalCents,
    shippingCents,
    totalCents: subtotalCents + shippingCents,
    currency: settings.currency,
  };
}

// ───────────────────────── Orders ─────────────────────────

export class CheckoutError extends Error {
  constructor(
    message: string,
    public readonly problems: CartProblem[] = [],
  ) {
    super(message);
  }
}

export type NewOrderInput = {
  lines: CartLineInput[];
  customerId: number | null;
  email: string;
  phone: string;
  shipName: string;
  address1: string;
  address2: string;
  city: string;
  region: string;
  postal: string;
  country: string;
  notes: string;
  provider: 'stripe' | 'test';
};

export type CreatedOrder = { id: number; number: number; token: string; totalCents: number; currency: string };

/** Creates a pending order and reserves stock for it atomically. */
export function createOrder(input: NewOrderInput): CreatedOrder {
  return tx(() => {
    const cart = priceCart(input.lines);
    if (cart.problems.length) throw new CheckoutError('Your cart has changed. Please review it and try again.', cart.problems);
    if (!cart.lines.length) throw new CheckoutError('Your cart is empty.');

    const reserved = new Map<number, number>();
    for (const line of cart.lines) {
      if (line.stock === null) continue;
      const res = run(
        'UPDATE variants SET stock = stock - ? WHERE id = ? AND stock IS NOT NULL AND stock >= ?',
        line.quantity,
        line.variantId,
        line.quantity,
      );
      if (res.changes !== 1) {
        throw new CheckoutError(`${line.title} (${line.variantLabel}) just sold out.`, [
          { variantId: line.variantId, message: `${line.title} (${line.variantLabel}) just sold out.` },
        ]);
      }
      reserved.set(line.variantId, line.quantity);
    }

    const number = (get<{ n: number }>('SELECT COALESCE(MAX(number), 1000) + 1 AS n FROM orders')?.n ?? 1001) as number;
    const token = crypto.randomBytes(24).toString('base64url');
    const { lastId: orderId } = run(
      `INSERT INTO orders (number, public_token, customer_id, email, phone, ship_name, ship_address1, ship_address2,
         ship_city, ship_region, ship_postal, ship_country, notes, currency, subtotal_cents, shipping_cents, total_cents,
         payment_provider, stock_reserved, reserved_until)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)`,
      number,
      token,
      input.customerId,
      input.email,
      input.phone,
      input.shipName,
      input.address1,
      input.address2,
      input.city,
      input.region,
      input.postal,
      input.country,
      input.notes,
      cart.currency,
      cart.subtotalCents,
      cart.shippingCents,
      cart.totalCents,
      input.provider,
      Date.now() + RESERVATION_MS,
    );
    for (const line of cart.lines) {
      run(
        `INSERT INTO order_items (order_id, product_id, variant_id, title, variant_label, image, unit_price_cents, quantity, reserved_qty)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        orderId,
        line.productId,
        line.variantId,
        line.title,
        line.variantLabel,
        line.image,
        line.unitPriceCents,
        line.quantity,
        reserved.get(line.variantId) ?? 0,
      );
    }
    return { id: orderId, number, token, totalCents: cart.totalCents, currency: cart.currency };
  });
}

export function setPaymentRef(orderId: number, ref: string): void {
  run("UPDATE orders SET payment_ref = ?, updated_at = datetime('now') WHERE id = ?", ref, orderId);
}

type OrderStateRow = {
  id: number;
  payment_status: PaymentStatus;
  stock_reserved: number;
  total_cents: number;
  currency: string;
  payment_provider: string;
};

function orderState(orderId: number): OrderStateRow | undefined {
  return get<OrderStateRow>(
    'SELECT id, payment_status, stock_reserved, total_cents, currency, payment_provider FROM orders WHERE id = ?',
    orderId,
  );
}

/** Returns reserved stock to inventory. Must run inside a transaction. */
function releaseStock(orderId: number): void {
  const items = all<{ variant_id: number | null; reserved_qty: number }>(
    'SELECT variant_id, reserved_qty FROM order_items WHERE order_id = ? AND reserved_qty > 0',
    orderId,
  );
  for (const it of items) {
    if (it.variant_id) run('UPDATE variants SET stock = stock + ? WHERE id = ? AND stock IS NOT NULL', it.reserved_qty, it.variant_id);
  }
  run('UPDATE orders SET stock_reserved = 0 WHERE id = ?', orderId);
}

/** Re-takes stock for an order whose reservation had lapsed. Returns labels that could not be reserved. */
function reacquireStock(orderId: number): string[] {
  const conflicts: string[] = [];
  const items = all<{ variant_id: number | null; reserved_qty: number; title: string; variant_label: string }>(
    'SELECT variant_id, reserved_qty, title, variant_label FROM order_items WHERE order_id = ? AND reserved_qty > 0',
    orderId,
  );
  for (const it of items) {
    if (!it.variant_id) continue;
    const res = run(
      'UPDATE variants SET stock = stock - ? WHERE id = ? AND stock IS NOT NULL AND stock >= ?',
      it.reserved_qty,
      it.variant_id,
      it.reserved_qty,
    );
    if (res.changes !== 1) conflicts.push(`${it.title} (${it.variant_label})`);
  }
  run('UPDATE orders SET stock_reserved = 1 WHERE id = ?', orderId);
  return conflicts;
}

export type ChargeInfo = {
  provider: 'stripe' | 'test';
  ref: string | null;
  amountCents: number;
  currency: string;
  brand?: string;
  last4?: string;
  message?: string;
};

/** Marks an order paid. Idempotent: returns true only the first time. */
export function markOrderPaid(orderId: number, charge: ChargeInfo): boolean {
  return tx(() => {
    const order = orderState(orderId);
    if (!order || order.payment_status === 'paid' || order.payment_status === 'refunded') return false;

    let note = '';
    if (order.stock_reserved === 0) {
      const conflicts = reacquireStock(orderId);
      if (conflicts.length) note = `Paid after reservation expired — not enough stock for: ${conflicts.join(', ')}. `;
    }
    run(
      `UPDATE orders SET payment_status = 'paid', paid_at = datetime('now'), payment_ref = COALESCE(?, payment_ref),
         admin_note = admin_note || ?, updated_at = datetime('now') WHERE id = ?`,
      charge.ref,
      note,
      orderId,
    );
    run(
      `UPDATE products SET sales_count = sales_count + COALESCE(
         (SELECT SUM(quantity) FROM order_items oi WHERE oi.order_id = ? AND oi.product_id = products.id), 0)
       WHERE id IN (SELECT product_id FROM order_items WHERE order_id = ? AND product_id IS NOT NULL)`,
      orderId,
      orderId,
    );
    run(
      `INSERT OR IGNORE INTO transactions (order_id, kind, status, provider, provider_ref, amount_cents, currency, card_brand, card_last4, message)
       VALUES (?, 'charge', 'succeeded', ?, ?, ?, ?, ?, ?, ?)`,
      orderId,
      charge.provider,
      charge.ref,
      charge.amountCents,
      charge.currency,
      charge.brand ?? '',
      charge.last4 ?? '',
      charge.message ?? 'Payment captured',
    );
    return true;
  });
}

/** Records a failed payment attempt and releases the order's stock. */
export function markOrderFailed(orderId: number, charge: ChargeInfo): void {
  tx(() => {
    const order = orderState(orderId);
    if (!order || order.payment_status !== 'pending') return;
    releaseStock(orderId);
    run("UPDATE orders SET payment_status = 'failed', updated_at = datetime('now') WHERE id = ?", orderId);
    run(
      `INSERT OR IGNORE INTO transactions (order_id, kind, status, provider, provider_ref, amount_cents, currency, card_brand, card_last4, message)
       VALUES (?, 'charge', 'failed', ?, ?, ?, ?, ?, ?, ?)`,
      orderId,
      charge.provider,
      charge.ref,
      charge.amountCents,
      charge.currency,
      charge.brand ?? '',
      charge.last4 ?? '',
      (charge.message ?? 'Payment failed').slice(0, 300),
    );
  });
}

export function markOrderExpired(orderId: number): void {
  tx(() => {
    const order = orderState(orderId);
    if (!order || order.payment_status !== 'pending') return;
    releaseStock(orderId);
    run("UPDATE orders SET payment_status = 'expired', updated_at = datetime('now') WHERE id = ?", orderId);
  });
}

export function recordRefund(orderId: number, refund: ChargeInfo, restock: boolean): void {
  tx(() => {
    const order = orderState(orderId);
    if (!order || order.payment_status !== 'paid') throw new Error('Only paid orders can be refunded');
    if (restock && order.stock_reserved === 1) releaseStock(orderId);
    run("UPDATE orders SET payment_status = 'refunded', updated_at = datetime('now') WHERE id = ?", orderId);
    run(
      `INSERT OR IGNORE INTO transactions (order_id, kind, status, provider, provider_ref, amount_cents, currency, message)
       VALUES (?, 'refund', 'succeeded', ?, ?, ?, ?, ?)`,
      orderId,
      refund.provider,
      refund.ref,
      refund.amountCents,
      refund.currency,
      refund.message ?? 'Refunded',
    );
  });
}

export function updateFulfillment(orderId: number, status: FulfillmentStatus, tracking: string, note: string, restockOnCancel: boolean): void {
  tx(() => {
    const order = orderState(orderId);
    if (!order) throw new Error('Order not found');
    if (status === 'cancelled' && restockOnCancel && order.stock_reserved === 1) releaseStock(orderId);
    run(
      "UPDATE orders SET fulfillment_status = ?, tracking_number = ?, admin_note = ?, updated_at = datetime('now') WHERE id = ?",
      status,
      tracking,
      note,
      orderId,
    );
  });
}

// ───────────────────────── Reading orders ─────────────────────────

export type OrderItem = {
  id: number;
  productId: number | null;
  title: string;
  variantLabel: string;
  image: string | null;
  unitPriceCents: number;
  quantity: number;
};

export type Transaction = {
  id: number;
  orderId: number;
  orderNumber: number;
  kind: 'charge' | 'refund';
  status: 'succeeded' | 'failed';
  provider: string;
  providerRef: string | null;
  amountCents: number;
  currency: string;
  cardBrand: string;
  cardLast4: string;
  message: string;
  email: string;
  createdAt: string;
};

export type Order = {
  id: number;
  number: number;
  token: string;
  customerId: number | null;
  email: string;
  phone: string;
  shipName: string;
  address1: string;
  address2: string;
  city: string;
  region: string;
  postal: string;
  country: string;
  notes: string;
  currency: string;
  subtotalCents: number;
  shippingCents: number;
  totalCents: number;
  paymentProvider: 'stripe' | 'test';
  paymentRef: string | null;
  paymentStatus: PaymentStatus;
  fulfillmentStatus: FulfillmentStatus;
  reservedUntil: number;
  trackingNumber: string;
  adminNote: string;
  paidAt: string | null;
  createdAt: string;
  itemCount: number;
};

type OrderRow = {
  id: number;
  number: number;
  public_token: string;
  customer_id: number | null;
  email: string;
  phone: string;
  ship_name: string;
  ship_address1: string;
  ship_address2: string;
  ship_city: string;
  ship_region: string;
  ship_postal: string;
  ship_country: string;
  notes: string;
  currency: string;
  subtotal_cents: number;
  shipping_cents: number;
  total_cents: number;
  payment_provider: 'stripe' | 'test';
  payment_ref: string | null;
  payment_status: PaymentStatus;
  fulfillment_status: FulfillmentStatus;
  reserved_until: number;
  tracking_number: string;
  admin_note: string;
  paid_at: string | null;
  created_at: string;
  item_count: number;
};

const ORDER_SELECT = `SELECT o.*, (SELECT COALESCE(SUM(quantity), 0) FROM order_items WHERE order_id = o.id) AS item_count FROM orders o`;

function mapOrder(r: OrderRow): Order {
  return {
    id: r.id,
    number: r.number,
    token: r.public_token,
    customerId: r.customer_id,
    email: r.email,
    phone: r.phone,
    shipName: r.ship_name,
    address1: r.ship_address1,
    address2: r.ship_address2,
    city: r.ship_city,
    region: r.ship_region,
    postal: r.ship_postal,
    country: r.ship_country,
    notes: r.notes,
    currency: r.currency,
    subtotalCents: r.subtotal_cents,
    shippingCents: r.shipping_cents,
    totalCents: r.total_cents,
    paymentProvider: r.payment_provider,
    paymentRef: r.payment_ref,
    paymentStatus: r.payment_status,
    fulfillmentStatus: r.fulfillment_status,
    reservedUntil: r.reserved_until,
    trackingNumber: r.tracking_number,
    adminNote: r.admin_note,
    paidAt: r.paid_at,
    createdAt: r.created_at,
    itemCount: r.item_count,
  };
}

export function getOrder(id: number): Order | null {
  const r = get<OrderRow>(`${ORDER_SELECT} WHERE o.id = ?`, id);
  return r ? mapOrder(r) : null;
}

export function getOrderByNumber(number: number): Order | null {
  const r = get<OrderRow>(`${ORDER_SELECT} WHERE o.number = ?`, number);
  return r ? mapOrder(r) : null;
}

export function getOrderByPaymentRef(ref: string): Order | null {
  const r = get<OrderRow>(`${ORDER_SELECT} WHERE o.payment_ref = ?`, ref);
  return r ? mapOrder(r) : null;
}

export function tokenMatches(order: Order, token: string | null | undefined): boolean {
  if (!token) return false;
  const a = Buffer.from(order.token);
  const b = Buffer.from(token);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export function getOrderItems(orderId: number): OrderItem[] {
  return all<{
    id: number;
    product_id: number | null;
    title: string;
    variant_label: string;
    image: string | null;
    unit_price_cents: number;
    quantity: number;
  }>(
    'SELECT id, product_id, title, variant_label, image, unit_price_cents, quantity FROM order_items WHERE order_id = ? ORDER BY id',
    orderId,
  ).map((r) => ({
    id: r.id,
    productId: r.product_id,
    title: r.title,
    variantLabel: r.variant_label,
    image: r.image,
    unitPriceCents: r.unit_price_cents,
    quantity: r.quantity,
  }));
}

export function listCustomerOrders(customerId: number): Order[] {
  return all<OrderRow>(
    `${ORDER_SELECT} WHERE o.customer_id = ? AND o.payment_status IN ('paid', 'refunded') ORDER BY o.created_at DESC, o.id DESC`,
    customerId,
  ).map(mapOrder);
}

export type OrderFilter = {
  q?: string;
  payment?: PaymentStatus | 'all';
  fulfillment?: FulfillmentStatus | 'all';
  limit?: number;
  offset?: number;
};

export function listOrders(filter: OrderFilter = {}): { items: Order[]; total: number } {
  const where: string[] = [];
  const params: (string | number)[] = [];
  if (filter.payment && filter.payment !== 'all') {
    where.push('o.payment_status = ?');
    params.push(filter.payment);
  }
  if (filter.fulfillment && filter.fulfillment !== 'all') {
    where.push('o.fulfillment_status = ?');
    params.push(filter.fulfillment);
  }
  const q = filter.q?.trim().replace(/^#?(SL)?/i, '');
  if (q) {
    const like = '%' + q.replace(/[\\%_]/g, (m) => '\\' + m) + '%';
    where.push("(CAST(o.number AS TEXT) LIKE ? ESCAPE '\\' OR o.email LIKE ? ESCAPE '\\' OR o.ship_name LIKE ? ESCAPE '\\')");
    params.push(like, like, like);
  }
  const whereSql = where.length ? ' WHERE ' + where.join(' AND ') : '';
  const total = get<{ n: number }>(`SELECT COUNT(*) AS n FROM orders o${whereSql}`, ...params)?.n ?? 0;
  const items = all<OrderRow>(
    `${ORDER_SELECT}${whereSql} ORDER BY o.created_at DESC, o.id DESC LIMIT ? OFFSET ?`,
    ...params,
    Math.min(filter.limit ?? 25, 500),
    Math.max(filter.offset ?? 0, 0),
  ).map(mapOrder);
  return { items, total };
}

type TransactionRow = {
  id: number;
  order_id: number;
  order_number: number;
  kind: 'charge' | 'refund';
  status: 'succeeded' | 'failed';
  provider: string;
  provider_ref: string | null;
  amount_cents: number;
  currency: string;
  card_brand: string;
  card_last4: string;
  message: string;
  email: string;
  created_at: string;
};

function mapTransaction(r: TransactionRow): Transaction {
  return {
    id: r.id,
    orderId: r.order_id,
    orderNumber: r.order_number,
    kind: r.kind,
    status: r.status,
    provider: r.provider,
    providerRef: r.provider_ref,
    amountCents: r.amount_cents,
    currency: r.currency,
    cardBrand: r.card_brand,
    cardLast4: r.card_last4,
    message: r.message,
    email: r.email,
    createdAt: r.created_at,
  };
}

const TX_SELECT = `SELECT t.*, o.number AS order_number, o.email FROM transactions t JOIN orders o ON o.id = t.order_id`;

export function listTransactions(filter: { kind?: string; status?: string; limit?: number; offset?: number } = {}): {
  items: Transaction[];
  total: number;
} {
  const where: string[] = [];
  const params: (string | number)[] = [];
  if (filter.kind === 'charge' || filter.kind === 'refund') {
    where.push('t.kind = ?');
    params.push(filter.kind);
  }
  if (filter.status === 'succeeded' || filter.status === 'failed') {
    where.push('t.status = ?');
    params.push(filter.status);
  }
  const whereSql = where.length ? ' WHERE ' + where.join(' AND ') : '';
  const total = get<{ n: number }>(`SELECT COUNT(*) AS n FROM transactions t${whereSql}`, ...params)?.n ?? 0;
  const items = all<TransactionRow>(
    `${TX_SELECT}${whereSql} ORDER BY t.created_at DESC, t.id DESC LIMIT ? OFFSET ?`,
    ...params,
    Math.min(filter.limit ?? 50, 500),
    Math.max(filter.offset ?? 0, 0),
  ).map(mapTransaction);
  return { items, total };
}

export function orderTransactions(orderId: number): Transaction[] {
  return all<TransactionRow>(`${TX_SELECT} WHERE t.order_id = ? ORDER BY t.created_at, t.id`, orderId).map(mapTransaction);
}

/** Pending orders whose stock hold has lapsed. */
export function staleOrders(limit = 25): Order[] {
  return all<OrderRow>(
    `${ORDER_SELECT} WHERE o.payment_status = 'pending' AND o.reserved_until < ? ORDER BY o.id LIMIT ?`,
    Date.now(),
    limit,
  ).map(mapOrder);
}
