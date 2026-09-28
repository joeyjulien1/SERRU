'use server';

// Admin actions never call redirect(): see FormState.redirectTo in lib/validation.ts.
import { refresh } from 'next/cache';
import { z } from 'zod';
import { requireAdmin } from '@/lib/admin-auth';
import { isCountryCode } from '@/lib/countries';
import { all, get, run, tx } from '@/lib/db';
import { CURRENCIES, formatMoney, orderLabel, parseMoneyToCents, slugify } from '@/lib/format';
import { storeUrl } from '@/lib/hosts';
import { sendMail } from '@/lib/mailer';
import { getOrder, markOrderPaid, recordRefund, updateFulfillment, FULFILLMENT_STATUSES, type FulfillmentStatus } from '@/lib/orders';
import { savePage } from '@/lib/pages';
import { dummyPasswordHash, hashPassword, PASSWORD_MIN, verifyPassword } from '@/lib/password';
import { createTapRefund } from '@/lib/payments';
import { clientIp, rateLimit } from '@/lib/rate-limit';
import { createSession, destroyAllSessions, destroySession } from '@/lib/session';
import { getSettings, saveSettings, SETTING_DEFAULTS, type SettingKey } from '@/lib/settings';
import { EMAIL_PATTERN, fieldErrors, formValues, type ActionResult, type FormState } from '@/lib/validation';

const str = (v: FormDataEntryValue | null) => (typeof v === 'string' ? v.trim() : '');
const bool = (v: FormDataEntryValue | null) => v === 'on' || v === 'true' || v === '1';

// ───────────── Authentication ─────────────

export async function adminLoginAction(_: FormState, data: FormData): Promise<FormState> {
  const email = str(data.get('email')).toLowerCase();
  const password = typeof data.get('password') === 'string' ? String(data.get('password')) : '';
  const values = { email };
  if (!EMAIL_PATTERN.test(email) || !password) return { ok: false, message: 'Enter your email and password.', values };

  const ip = await clientIp();
  if (!rateLimit(`admin-login:${ip}`, 8, 15 * 60_000) || !rateLimit(`admin-login:${email}`, 8, 15 * 60_000)) {
    return { ok: false, message: 'Too many attempts. Please wait 15 minutes and try again.', values };
  }
  const row = await get<{ id: number; password_hash: string }>('SELECT id, password_hash FROM admins WHERE email = ?', email);
  const valid = await verifyPassword(password, row?.password_hash ?? (await dummyPasswordHash()));
  if (!row || !valid) return { ok: false, message: 'Incorrect email or password.', values };

  await run("UPDATE admins SET last_login_at = datetime('now') WHERE id = ?", row.id);
  await createSession('admin', row.id);
  return { ok: true, redirectTo: '/' };
}

export async function adminLogoutAction(): Promise<ActionResult> {
  await destroySession('admin');
  return { redirectTo: '/login' };
}

// ───────────── Products ─────────────

const variantInput = z.object({
  id: z.number().int().positive().optional(),
  label: z.string().trim().min(1, 'Every size needs a name (e.g. 60 × 90 cm)').max(80),
  sku: z.string().trim().max(60).default(''),
  price: z.string(),
  compareAt: z.string().default(''),
  stock: z.string().default(''),
});

export async function saveProductAction(_: FormState, data: FormData): Promise<FormState> {
  await requireAdmin();
  const values = formValues(data);
  const id = Number(str(data.get('id'))) || null;

  let variantsRaw: unknown;
  let imageIdsRaw: unknown;
  try {
    variantsRaw = JSON.parse(str(data.get('variants')) || '[]');
    imageIdsRaw = JSON.parse(str(data.get('imageIds')) || '[]');
  } catch {
    return { ok: false, message: 'The form data was malformed. Please reload the page.', values };
  }

  const base = z
    .object({
      title: z.string().trim().min(1, 'Enter a title').max(160),
      slug: z.string().trim().max(90),
      categoryId: z.string(),
      description: z.string().trim().max(10_000),
      materials: z.string().trim().max(2_000),
      status: z.enum(['active', 'draft', 'archived']),
      leadTime: z.string().trim().max(60),
    })
    .safeParse({
      title: str(data.get('title')),
      slug: str(data.get('slug')),
      categoryId: str(data.get('categoryId')),
      description: str(data.get('description')),
      materials: str(data.get('materials')),
      status: str(data.get('status')) || 'active',
      leadTime: str(data.get('leadTime')),
    });
  if (!base.success) return { ok: false, errors: fieldErrors(base.error), message: 'Please fix the highlighted fields.', values };

  const variantsParsed = z.array(variantInput).min(1, 'Add at least one size').max(50).safeParse(variantsRaw);
  if (!variantsParsed.success) {
    return { ok: false, errors: { variants: variantsParsed.error.issues[0].message }, message: 'Please check the sizes.', values };
  }
  const variants: { id?: number; label: string; sku: string; price: number; compareAt: number | null; stock: number | null }[] = [];
  for (const [i, v] of variantsParsed.data.entries()) {
    const price = parseMoneyToCents(v.price);
    if (price === null || price <= 0) return { ok: false, errors: { variants: `Size ${i + 1}: enter a valid price` }, message: 'Please check the sizes.', values };
    const compareAt = v.compareAt.trim() ? parseMoneyToCents(v.compareAt) : null;
    if (v.compareAt.trim() && compareAt === null) {
      return { ok: false, errors: { variants: `Size ${i + 1}: enter a valid "compare at" price` }, message: 'Please check the sizes.', values };
    }
    if (compareAt !== null && compareAt <= price) {
      return {
        ok: false,
        errors: { variants: `Size ${i + 1}: "compare at" must be higher than the price (it shows as the crossed-out price)` },
        message: 'Please check the sizes.',
        values,
      };
    }
    const stockText = v.stock.trim();
    const stock = stockText === '' ? null : Number(stockText);
    if (stock !== null && (!Number.isInteger(stock) || stock < 0 || stock > 1_000_000)) {
      return { ok: false, errors: { variants: `Size ${i + 1}: stock must be a whole number (or empty for unlimited)` }, message: 'Please check the sizes.', values };
    }
    variants.push({ id: v.id, label: v.label, sku: v.sku, price, compareAt, stock });
  }

  const imageIds = z.array(z.number().int().positive()).max(30).safeParse(imageIdsRaw);
  if (!imageIds.success) return { ok: false, message: 'Invalid images.', values };
  const validImageIds = imageIds.data.length
    ? (await all<{ id: number }>(`SELECT id FROM media WHERE id IN (${imageIds.data.map(() => '?').join(',')})`, ...imageIds.data)).map((r) => r.id)
    : [];
  const orderedImages = imageIds.data.filter((m) => validImageIds.includes(m));

  const categoryId = Number(base.data.categoryId) || null;
  if (categoryId && !(await get('SELECT id FROM categories WHERE id = ?', categoryId))) {
    return { ok: false, errors: { categoryId: 'Choose a category' }, values };
  }

  // Unique slug
  let slug = slugify(base.data.slug || base.data.title);
  for (let n = 2; await get('SELECT id FROM products WHERE slug = ? AND id != ?', slug, id ?? 0); n++) {
    slug = `${slugify(base.data.slug || base.data.title)}-${n}`;
  }

  const flags = {
    hot: bool(data.get('isHot')) ? 1 : 0,
    ooo: bool(data.get('isOneOfOne')) ? 1 : 0,
    mto: bool(data.get('madeToOrder')) ? 1 : 0,
  };

  const productId = await tx(async () => {
    let pid = id;
    if (pid) {
      const res = await run(
        `UPDATE products SET title = ?, slug = ?, category_id = ?, description = ?, materials = ?, status = ?,
           is_hot = ?, is_one_of_one = ?, made_to_order = ?, lead_time = ?, updated_at = datetime('now') WHERE id = ?`,
        base.data.title,
        slug,
        categoryId,
        base.data.description,
        base.data.materials,
        base.data.status,
        flags.hot,
        flags.ooo,
        flags.mto,
        base.data.leadTime,
        pid,
      );
      if (res.changes === 0) throw new Error('Product not found');
    } else {
      pid = (
        await run(
          `INSERT INTO products (title, slug, category_id, description, materials, status, is_hot, is_one_of_one, made_to_order, lead_time)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          base.data.title,
          slug,
          categoryId,
          base.data.description,
          base.data.materials,
          base.data.status,
          flags.hot,
          flags.ooo,
          flags.mto,
          base.data.leadTime,
        )
      ).lastId;
    }

    const existing = new Set((await all<{ id: number }>('SELECT id FROM variants WHERE product_id = ?', pid)).map((r) => r.id));
    const kept = new Set<number>();
    for (const [position, v] of variants.entries()) {
      if (v.id && existing.has(v.id)) {
        kept.add(v.id);
        await run(
          'UPDATE variants SET label = ?, sku = ?, price_cents = ?, compare_at_cents = ?, stock = ?, position = ? WHERE id = ? AND product_id = ?',
          v.label,
          v.sku,
          v.price,
          v.compareAt,
          v.stock,
          position,
          v.id,
          pid,
        );
      } else {
        await run(
          'INSERT INTO variants (product_id, label, sku, price_cents, compare_at_cents, stock, position) VALUES (?, ?, ?, ?, ?, ?, ?)',
          pid,
          v.label,
          v.sku,
          v.price,
          v.compareAt,
          v.stock,
          position,
        );
      }
    }
    for (const vid of existing) {
      if (kept.has(vid)) continue;
      // References are cleared explicitly: foreign-key enforcement is not guaranteed on the hosted database.
      await run('UPDATE order_items SET variant_id = NULL WHERE variant_id = ?', vid);
      await run('DELETE FROM variants WHERE id = ?', vid);
    }

    await run('DELETE FROM product_images WHERE product_id = ?', pid);
    for (const [position, mid] of orderedImages.entries()) {
      await run('INSERT INTO product_images (product_id, media_id, position) VALUES (?, ?, ?)', pid, mid, position);
    }
    return pid;
  });

  if (!id) return { ok: true, message: 'Product created.', redirectTo: `/products/${productId}?created=1` };
  refresh();
  return { ok: true, message: 'Product saved.' };
}

export async function deleteProductAction(id: number): Promise<ActionResult> {
  await requireAdmin();
  // Same effect as the schema's ON DELETE rules, without relying on foreign-key enforcement.
  await tx(async () => {
    await run('UPDATE order_items SET product_id = NULL, variant_id = NULL WHERE product_id = ?', id);
    await run('DELETE FROM product_images WHERE product_id = ?', id);
    await run('DELETE FROM variants WHERE product_id = ?', id);
    await run('DELETE FROM products WHERE id = ?', id);
  });
  return { redirectTo: '/products?deleted=1' };
}

export async function toggleHotAction(id: number): Promise<void> {
  await requireAdmin();
  await run("UPDATE products SET is_hot = 1 - is_hot, updated_at = datetime('now') WHERE id = ?", id);
  refresh();
}

// ───────────── Categories ─────────────

export async function saveCategoryAction(_: FormState, data: FormData): Promise<FormState> {
  await requireAdmin();
  const values = formValues(data);
  const id = Number(str(data.get('id'))) || null;
  const parsed = z
    .object({
      name: z.string().trim().min(1, 'Enter a name').max(60),
      slug: z.string().trim().max(70),
      description: z.string().trim().max(400),
      position: z.coerce.number().int().min(0).max(999),
      mediaId: z.string(),
    })
    .safeParse({
      name: str(data.get('name')),
      slug: str(data.get('slug')),
      description: str(data.get('description')),
      position: str(data.get('position')) || '0',
      mediaId: str(data.get('mediaId')),
    });
  if (!parsed.success) return { ok: false, errors: fieldErrors(parsed.error), values };
  const slug = slugify(parsed.data.slug || parsed.data.name);
  if (await get('SELECT id FROM categories WHERE slug = ? AND id != ?', slug, id ?? 0)) {
    return { ok: false, errors: { slug: 'Another category already uses this URL' }, values };
  }
  const mediaId = Number(parsed.data.mediaId) || null;
  if (mediaId && !(await get('SELECT id FROM media WHERE id = ?', mediaId))) return { ok: false, message: 'Image not found', values };

  if (id) {
    await run(
      'UPDATE categories SET name = ?, slug = ?, description = ?, position = ?, media_id = ? WHERE id = ?',
      parsed.data.name,
      slug,
      parsed.data.description,
      parsed.data.position,
      mediaId,
      id,
    );
    refresh();
    return { ok: true, message: `${parsed.data.name} saved.` };
  }
  await run(
    'INSERT INTO categories (name, slug, description, position, media_id) VALUES (?, ?, ?, ?, ?)',
    parsed.data.name,
    slug,
    parsed.data.description,
    parsed.data.position,
    mediaId,
  );
  refresh();
  return { ok: true, message: `${parsed.data.name} created.` };
}

export async function deleteCategoryAction(id: number): Promise<ActionResult> {
  await requireAdmin();
  await tx(async () => {
    await run('UPDATE products SET category_id = NULL WHERE category_id = ?', id);
    await run('DELETE FROM categories WHERE id = ?', id);
  });
  return { redirectTo: '/categories?deleted=1' };
}

// ───────────── Orders ─────────────

export async function updateOrderAction(_: FormState, data: FormData): Promise<FormState> {
  await requireAdmin();
  const id = Number(str(data.get('id')));
  const order = await getOrder(id);
  if (!order) return { ok: false, message: 'Order not found.' };
  const status = str(data.get('fulfillment')) as FulfillmentStatus;
  if (!FULFILLMENT_STATUSES.includes(status)) return { ok: false, message: 'Choose a status.' };
  const tracking = str(data.get('tracking')).slice(0, 120);
  const note = str(data.get('note')).slice(0, 2000);
  const restock = bool(data.get('restock'));
  const codDue = order.paymentProvider === 'cod' && order.paymentStatus === 'pending';
  if ((status === 'shipped' || status === 'delivered') && order.paymentStatus !== 'paid' && !codDue) {
    return { ok: false, message: 'Only paid or cash-on-delivery orders can be shipped.' };
  }

  await updateFulfillment(id, status, tracking, note, restock);

  const notify = bool(data.get('notify'));
  if (notify && status !== order.fulfillmentStatus && (status === 'shipped' || status === 'delivered')) {
    const settings = await getSettings();
    await sendMail({
      to: order.email,
      subject:
        status === 'shipped'
          ? `Your ${settings.store_name} order ${orderLabel(order.number)} is on its way`
          : `Your ${settings.store_name} order ${orderLabel(order.number)} was delivered`,
      text: `Hi ${order.shipName.split(' ')[0]},\n\n${
        status === 'shipped'
          ? `Good news — your order ${orderLabel(order.number)} has shipped.${tracking ? `\nTracking number: ${tracking}` : ''}`
          : `Your order ${orderLabel(order.number)} has been delivered. We hope you love it.`
      }\n\nView your order: ${storeUrl()}/checkout/success/${order.number}?token=${order.token}\n\n${settings.store_name}`,
    });
  }
  refresh();
  return { ok: true, message: 'Order updated.' };
}

export async function refundOrderAction(_: FormState, data: FormData): Promise<FormState> {
  await requireAdmin('owner');
  const id = Number(str(data.get('id')));
  const order = await getOrder(id);
  if (!order || order.paymentStatus !== 'paid') return { ok: false, message: 'Only paid orders can be refunded.' };
  const restock = bool(data.get('restock'));

  let ref: string;
  let message = 'Refunded from admin';
  if (order.paymentProvider === 'tap') {
    if (!order.paymentRef) return { ok: false, message: 'This order has no Tap payment to refund.' };
    try {
      const refund = await createTapRefund({
        chargeId: order.paymentRef,
        amountCents: order.totalCents,
        currency: order.currency,
        orderNumber: order.number,
      });
      const status = String(refund.status).toUpperCase();
      if (status !== 'REFUNDED' && status !== 'PENDING') {
        return { ok: false, message: `Tap did not accept the refund (${status}${refund.response?.message ? `: ${refund.response.message}` : ''}).` };
      }
      ref = refund.id;
      if (status === 'PENDING') message = 'Refund submitted to Tap (processing)';
    } catch (err) {
      console.error('[admin] refund failed', err);
      return { ok: false, message: err instanceof Error ? `Tap refused the refund: ${err.message}` : 'Refund failed.' };
    }
  } else if (order.paymentProvider === 'cod') {
    ref = `cash_refund_${order.number}`;
    message = 'Cash refund recorded';
  } else {
    ref = `test_refund_${order.number}`;
  }

  await recordRefund(
    order.id,
    { provider: order.paymentProvider, ref, amountCents: order.totalCents, currency: order.currency, message },
    restock,
  );
  const settings = await getSettings();
  await sendMail({
    to: order.email,
    subject: `Refund for ${settings.store_name} order ${orderLabel(order.number)}`,
    text:
      `Hi ${order.shipName.split(' ')[0]},\n\n` +
      (order.paymentProvider === 'cod'
        ? `We've refunded ${formatMoney(order.totalCents, order.currency)} for order ${orderLabel(order.number)}.`
        : `We've refunded ${formatMoney(order.totalCents, order.currency)} for order ${orderLabel(order.number)} to your original payment card. Depending on your bank it can take 5–10 business days to appear.`) +
      `\n\n${settings.store_name}`,
  });
  refresh();
  return { ok: true, message: order.paymentProvider === 'cod' ? 'Refund recorded.' : 'Refund issued.' };
}

/** Cash-on-delivery order: the courier collected the cash. */
export async function markCodPaidAction(orderId: number): Promise<ActionResult> {
  await requireAdmin();
  const order = await getOrder(orderId);
  if (!order || order.paymentProvider !== 'cod') return { error: 'This is not a cash-on-delivery order.' };
  if (order.paymentStatus !== 'pending') return { error: 'This order is not awaiting payment.' };
  if (order.fulfillmentStatus === 'cancelled') return { error: 'This order was cancelled.' };
  await markOrderPaid(order.id, {
    provider: 'cod',
    ref: `cash_${order.number}`,
    amountCents: order.totalCents,
    currency: order.currency,
    message: 'Cash collected on delivery',
  });
  refresh();
  return undefined;
}

// ───────────── Inbox ─────────────

export async function setMessageReadAction(id: number, read: boolean): Promise<void> {
  await requireAdmin();
  await run('UPDATE messages SET is_read = ? WHERE id = ?', read ? 1 : 0, id);
  refresh();
}

export async function deleteMessageAction(id: number): Promise<void> {
  await requireAdmin();
  await run('DELETE FROM messages WHERE id = ?', id);
  refresh();
}

export async function deleteSubscriberAction(id: number): Promise<void> {
  await requireAdmin();
  await run('DELETE FROM subscribers WHERE id = ?', id);
  refresh();
}

// ───────────── Pages ─────────────

export async function savePageAction(_: FormState, data: FormData): Promise<FormState> {
  await requireAdmin();
  const parsed = z
    .object({
      slug: z.string().trim().min(1).max(60),
      title: z.string().trim().min(1, 'Enter a title').max(120),
      body: z.string().max(50_000),
    })
    .safeParse({ slug: str(data.get('slug')), title: str(data.get('title')), body: String(data.get('body') ?? '') });
  if (!parsed.success) return { ok: false, errors: fieldErrors(parsed.error), values: formValues(data) };
  const slug = slugify(parsed.data.slug);
  const isNew = str(data.get('isNew')) === '1';
  if (isNew && (await get('SELECT slug FROM pages WHERE slug = ?', slug))) {
    return { ok: false, errors: { slug: 'A page with this URL already exists' }, values: formValues(data) };
  }
  await savePage(slug, parsed.data.title, parsed.data.body.trim());
  if (isNew) return { ok: true, message: 'Page created.', redirectTo: `/pages/${slug}?created=1` };
  refresh();
  return { ok: true, message: 'Page saved.' };
}

export async function deletePageAction(slug: string): Promise<ActionResult> {
  await requireAdmin('owner');
  await run('DELETE FROM pages WHERE slug = ?', slug);
  return { redirectTo: '/pages?deleted=1' };
}

// ───────────── Settings ─────────────

export async function saveSettingsAction(_: FormState, data: FormData): Promise<FormState> {
  await requireAdmin('owner');
  const values = formValues(data);
  const errors: Record<string, string> = {};
  const next: Partial<Record<SettingKey, string>> = {};

  const text = (key: SettingKey, max: number) => {
    if (!data.has(key)) return;
    const v = String(data.get(key) ?? '').trim();
    if (v.length > max) errors[key] = `Keep this under ${max} characters`;
    else next[key] = v;
  };
  text('store_name', 60);
  text('tagline', 80);
  text('announcement', 140);
  text('hero_eyebrow', 120);
  text('hero_title', 80);
  text('hero_subtitle', 300);
  text('marquee', 600);
  text('contact_email', 120);
  text('contact_phone', 40);
  text('whatsapp', 40);
  text('instagram', 120);
  text('address', 300);
  text('stat_crafted', 9);
  text('stat_collectors', 9);

  // Checkbox: absent from the form data when unticked, so a hidden marker tells us it was on the page.
  if (data.has('cod_enabled_present')) next.cod_enabled = bool(data.get('cod_enabled')) ? '1' : '0';

  if (next.contact_email && !EMAIL_PATTERN.test(next.contact_email)) errors.contact_email = 'Enter a valid email address';
  for (const k of ['stat_crafted', 'stat_collectors'] as const) {
    if (next[k] && !/^\d+$/.test(next[k]!)) errors[k] = 'Numbers only (leave empty to hide)';
  }

  if (data.has('currency')) {
    const c = str(data.get('currency'));
    if (!(CURRENCIES as readonly string[]).includes(c)) errors.currency = 'Choose a currency';
    else next.currency = c;
  }
  if (data.has('default_country')) {
    const c = str(data.get('default_country'));
    if (!isCountryCode(c)) errors.default_country = 'Choose a country';
    else next.default_country = c;
  }
  for (const [field, key] of [
    ['shipping_flat', 'shipping_flat_cents'],
    ['free_threshold', 'free_shipping_threshold_cents'],
  ] as const) {
    if (!data.has(field)) continue;
    const raw = str(data.get(field));
    const cents = raw === '' ? 0 : parseMoneyToCents(raw);
    if (cents === null) errors[field] = 'Enter an amount like 25 or 25.50';
    else next[key] = String(cents);
  }
  if (data.has('hero_media_id')) {
    const raw = str(data.get('hero_media_id'));
    if (raw && !(await get('SELECT id FROM media WHERE id = ?', Number(raw)))) errors.hero_media_id = 'Image not found';
    else next.hero_media_id = raw;
  }

  if (Object.keys(errors).length) return { ok: false, errors, message: 'Please fix the highlighted fields.', values };
  // Ignore anything that isn't a known setting.
  await saveSettings(Object.fromEntries(Object.entries(next).filter(([k]) => k in SETTING_DEFAULTS)));
  refresh();
  return { ok: true, message: 'Settings saved.' };
}

// ───────────── Admin users ─────────────

export async function changeAdminPasswordAction(_: FormState, data: FormData): Promise<FormState> {
  const admin = await requireAdmin();
  const current = String(data.get('current') ?? '');
  const password = String(data.get('password') ?? '');
  const confirm = String(data.get('confirm') ?? '');
  const errors: Record<string, string> = {};
  if (password.length < 10) errors.password = 'Use at least 10 characters for admin accounts';
  if (password !== confirm) errors.confirm = 'Passwords do not match';
  if (Object.keys(errors).length) return { ok: false, errors };
  const row = await get<{ password_hash: string }>('SELECT password_hash FROM admins WHERE id = ?', admin.id);
  if (!row || !(await verifyPassword(current, row.password_hash))) return { ok: false, errors: { current: 'Current password is incorrect' } };
  await run('UPDATE admins SET password_hash = ? WHERE id = ?', await hashPassword(password), admin.id);
  await destroyAllSessions('admin', admin.id, true);
  refresh();
  return { ok: true, message: 'Password changed. Other devices were signed out.' };
}

export async function addAdminAction(_: FormState, data: FormData): Promise<FormState> {
  await requireAdmin('owner');
  const values = formValues(data);
  const email = str(data.get('email')).toLowerCase();
  const name = str(data.get('name')).slice(0, 60);
  const password = String(data.get('password') ?? '');
  const role = str(data.get('role')) === 'owner' ? 'owner' : 'staff';
  const errors: Record<string, string> = {};
  if (!name) errors.name = 'Enter a name';
  if (!EMAIL_PATTERN.test(email)) errors.email = 'Enter a valid email address';
  if (password.length < Math.max(PASSWORD_MIN, 10)) errors.password = 'Use at least 10 characters';
  if (!errors.email && (await get('SELECT id FROM admins WHERE email = ?', email))) errors.email = 'This email already has admin access';
  if (Object.keys(errors).length) return { ok: false, errors, values };
  await run('INSERT INTO admins (email, name, password_hash, role) VALUES (?, ?, ?, ?)', email, name, await hashPassword(password), role);
  refresh();
  return { ok: true, message: `${name} can now sign in to the admin panel.` };
}

export async function removeAdminAction(id: number): Promise<ActionResult> {
  const me = await requireAdmin('owner');
  if (id === me.id) return { error: 'You cannot remove your own account.' };
  const target = await get<{ role: string }>('SELECT role FROM admins WHERE id = ?', id);
  if (!target) return undefined;
  if (target.role === 'owner' && ((await get<{ n: number }>("SELECT COUNT(*) AS n FROM admins WHERE role = 'owner'"))?.n ?? 0) <= 1) {
    return { error: 'The store needs at least one owner.' };
  }
  await run('DELETE FROM admins WHERE id = ?', id);
  await run("DELETE FROM sessions WHERE kind = 'admin' AND user_id = ?", id);
  refresh();
  return undefined;
}
