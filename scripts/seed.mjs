// Seeds SERRU LAB with categories, policy pages, the first admin account and starter products.
// Safe to run more than once: existing data is never overwritten.
//   npm run seed                (also runs on every Vercel build, see "vercel-build" in package.json)
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { dataDir, openDb, root } from './db.mjs';

// Vercel keeps no files between requests: without these the deployed site could not store anything.
const missing = ['TURSO_DATABASE_URL', 'BLOB_READ_WRITE_TOKEN'].filter((k) => !process.env[k]);
if (process.env.VERCEL && missing.length) {
  console.error(`✗ Build stopped: ${missing.join(' and ')} not set. Connect a Turso database and a Blob store to this project (Vercel → Storage), then redeploy.`);
  process.exit(1);
}

const uploads = path.join(dataDir, 'uploads');
const db = await openDb();
const one = async (sql, ...args) => (await db.execute({ sql, args })).rows[0];

const log = (...a) => console.log('•', ...a);

// ───────────── Categories ─────────────
const categories = [
  ['plexi-art', 'Plexi Art', 'Luminous acrylic and plexiglass pieces — layered colour, light and depth.'],
  ['metal-art', 'Metal Art', 'Cut, brushed and finished metal wall art, built to last a lifetime.'],
  ['wood-art', 'Wood Art', 'Warm, tactile wood compositions, shaped and finished by hand.'],
  ['parametric', 'Parametric', 'Precision-cut layered forms that shift and move as you walk past.'],
  ['mirrors-art', 'Mirrors Art', 'Sculpted mirrors that open up a room and double as statement art.'],
  ['3d-arts', '3D Arts', 'Relief and dimensional wall pieces with texture you can feel.'],
  ['sculpture', 'Sculpture', 'Free-standing and wall-mounted sculpture for considered interiors.'],
];
await db.batch(
  categories.map(([slug, name, description], i) => ({
    sql: 'INSERT OR IGNORE INTO categories (slug, name, description, position) VALUES (?, ?, ?, ?)',
    args: [slug, name, description, i],
  })),
  'write',
);
log('categories ready');

// ───────────── Pages ─────────────
const pages = {
  about: [
    'About SERRU LAB',
    `SERRU LAB is an art studio and workshop creating statement pieces for homes, offices and hospitality spaces.

## What we make
We work across seven disciplines: plexi art, metal art, wood art, parametric design, mirror art, 3D relief and sculpture. Every piece is designed in-house and produced in our lab.

## Made for your space
Most of our pieces can be produced in custom sizes and finishes. Tell us about your wall, your light and your palette — we will propose a piece that belongs there.

## Luxury, perfected
We obsess over the details you notice up close: clean edges, even finishes, secure hanging hardware and careful packaging.`,
  ],
  shipping: [
    'Shipping Policy',
    `## Processing time
In-stock pieces are prepared for dispatch within 3–5 business days. Made-to-order pieces show their production time on the product page.

## Delivery
Delivery fees are calculated at checkout. Orders above the free-delivery threshold shown on the site ship free of charge.

## Packaging
Every piece is wrapped, corner-protected and crated or boxed according to its size and material.

## Tracking
You will receive an email with tracking details as soon as your order ships. You can also see your order status in your account.`,
  ],
  returns: [
    'Refund Policy',
    `## Ready-made pieces
If a ready-made piece is not right for you, contact us within 14 days of delivery. Items must be returned unused and in their original packaging. Return shipping is the customer's responsibility unless the item arrived damaged.

## Made-to-order and custom pieces
Pieces made to order or produced to custom specifications cannot be returned unless they arrive damaged or defective.

## Damaged items
Inspect your delivery on arrival. If anything is damaged, email us photos within 48 hours and we will repair, replace or refund it.

## Refunds
Approved refunds are issued to the original payment card. Depending on your bank, it can take 5–10 business days to appear.`,
  ],
  privacy: [
    'Privacy Policy',
    `## What we collect
When you place an order or create an account we collect your name, email, phone number and delivery address. Card details are entered directly into our payment processor's secure form and never touch our servers.

## How we use it
We use your information to process and deliver orders, provide customer support and — only if you opt in — send news about new pieces.

## Sharing
We share information only with the services needed to run the store, such as our payment processor and delivery partners.

## Your rights
You can ask us to access, correct or delete your personal data at any time by contacting us.`,
  ],
  terms: [
    'Terms of Service',
    `## Overview
By using this website and purchasing from SERRU LAB you agree to these terms.

## Products
Handmade pieces can vary slightly in colour, grain and finish from the photographs. These variations are part of each piece's character.

## Pricing and payment
Prices are shown in the store currency and include all applicable charges except delivery, which is shown at checkout. Payment is taken in full when you place your order.

## Intellectual property
All designs, images and content on this site belong to SERRU LAB and may not be reproduced without permission.

## Contact
Questions about these terms can be sent through our contact page.`,
  ],
};
await db.batch(
  Object.entries(pages).map(([slug, [title, body]]) => ({
    sql: 'INSERT OR IGNORE INTO pages (slug, title, body) VALUES (?, ?, ?)',
    args: [slug, title, body],
  })),
  'write',
);
log('pages ready');

// ───────────── Owner admin (ADMIN_EMAIL / ADMIN_PASSWORD) ─────────────
// Creates the owner, and whenever ADMIN_PASSWORD changes, sets that admin's password to it — so changing
// it (in .env.local or Vercel) and re-running the seed / redeploying is also how to regain access.
// A password changed later in Admin → Settings is kept until ADMIN_PASSWORD itself changes.
// Same format as lib/password.ts: scrypt$N$r$p$saltBase64$hashBase64
function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(password, salt, 64, { N: 16384, r: 8, p: 1 });
  return ['scrypt', 16384, 8, 1, salt.toString('base64'), hash.toString('base64')].join('$');
}
function passwordMatches(password, stored) {
  const [kind, n, r, p, salt, hash] = String(stored ?? '').split('$');
  if (kind !== 'scrypt' || !hash) return false;
  const expected = Buffer.from(hash, 'base64');
  const actual = crypto.scryptSync(password, Buffer.from(salt, 'base64'), expected.length, { N: Number(n), r: Number(r), p: Number(p) });
  return crypto.timingSafeEqual(actual, expected);
}

const adminEmail = (process.env.ADMIN_EMAIL || '').trim().toLowerCase();
// Trimmed: a pasted value easily carries a trailing space or line break that nobody types at sign-in.
const adminPassword = (process.env.ADMIN_PASSWORD || '').trim();
const adminProblem = !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(adminEmail)
  ? 'ADMIN_EMAIL is missing or not an email address'
  : adminPassword.length < 8
    ? 'ADMIN_PASSWORD is missing or shorter than 8 characters'
    : process.env.VERCEL && adminPassword === 'change-me-to-a-long-random-password'
      ? 'ADMIN_PASSWORD is still the public example value from .env.example'
      : null;

if (adminProblem) {
  const adminCount = (await one('SELECT COUNT(*) AS n FROM admins')).n;
  if (process.env.VERCEL && adminCount === 0) {
    console.error(`✗ Build stopped: no admin account can be created — ${adminProblem}. Fix it in Vercel → Settings → Environment Variables, then redeploy.`);
    process.exit(1);
  }
  console.warn(`! Admin not created or updated: ${adminProblem}.`);
} else {
  const marker = (await one("SELECT value FROM settings WHERE key = 'seed_admin_password'"))?.value;
  const existing = await one('SELECT id FROM admins WHERE email = ?', adminEmail);
  if (existing && passwordMatches(adminPassword, marker)) {
    log(`admin ${adminEmail} ready`);
  } else {
    const writes = existing
      ? [
          { sql: 'UPDATE admins SET password_hash = ? WHERE id = ?', args: [hashPassword(adminPassword), existing.id] },
          { sql: "DELETE FROM sessions WHERE kind = 'admin' AND user_id = ?", args: [existing.id] },
        ]
      : [{ sql: "INSERT INTO admins (email, name, password_hash, role) VALUES (?, 'Store Owner', ?, 'owner')", args: [adminEmail, hashPassword(adminPassword)] }];
    writes.push({
      sql: "INSERT INTO settings (key, value) VALUES ('seed_admin_password', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
      args: [hashPassword(adminPassword)],
    });
    await db.batch(writes, 'write');
    log(existing ? `password of ${adminEmail} set from ADMIN_PASSWORD` : `owner admin created for ${adminEmail}`);
  }
}

// ───────────── Starter products (from _source photos) ─────────────
/** Same storage rules as lib/media.ts: Vercel Blob when BLOB_READ_WRITE_TOKEN is set, else storage/uploads. */
async function storeFile(file, data) {
  if (process.env.BLOB_READ_WRITE_TOKEN) {
    const { put } = await import('@vercel/blob');
    const blob = await put(`uploads/${file}`, data, {
      access: 'public',
      contentType: 'image/webp',
      addRandomSuffix: false,
      cacheControlMaxAge: 31536000,
    });
    return blob.url;
  }
  fs.mkdirSync(path.dirname(path.join(uploads, file)), { recursive: true });
  fs.writeFileSync(path.join(uploads, file), data);
  return file;
}

async function saveImage(input, region, alt) {
  let pipeline = sharp(input);
  if (region) pipeline = pipeline.extract(region);
  const buffer = await pipeline.toBuffer();
  const now = new Date();
  const sub = `${now.getUTCFullYear()}/${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
  const name = crypto.randomBytes(12).toString('hex');
  const large = await sharp(buffer)
    .rotate()
    .resize({ width: 2000, height: 2000, fit: 'inside', withoutEnlargement: true })
    .webp({ quality: 82 })
    .toBuffer({ resolveWithObject: true });
  const thumb = await sharp(buffer)
    .rotate()
    .resize({ width: 720, height: 960, fit: 'inside', withoutEnlargement: true })
    .webp({ quality: 78 })
    .toBuffer();
  const file = await storeFile(`${sub}/${name}.webp`, large.data);
  const thumbFile = await storeFile(`${sub}/${name}-t.webp`, thumb);
  const r = await db.execute({
    sql: 'INSERT INTO media (file, thumb, width, height, alt) VALUES (?, ?, ?, ?, ?)',
    args: [file, thumbFile, large.info.width, large.info.height, alt],
  });
  return Number(r.lastInsertRowid);
}

const productCount = (await one('SELECT COUNT(*) AS n FROM products')).n;
const src = (f) => path.join(root, '_source', f);
if (productCount > 0) {
  log('products already exist — skipped');
} else if (!['1.jpg', '2.jpg', '3.jpg'].every((f) => fs.existsSync(src(f)))) {
  log('no starter photos in _source/ — skipped products');
} else {
  const img = {
    faceCrop: await saveImage(src('1.jpg'), { left: 250, top: 170, width: 540, height: 720 }, 'Teal Muse parametric face sculpture'),
    faceRoom: await saveImage(src('1.jpg'), null, 'Teal Muse installed above a lounge seating area'),
    dune: await saveImage(src('2.jpg'), { left: 10, top: 352, width: 540, height: 720 }, 'Solar Dune in a fluorescent frame'),
    bloom: await saveImage(src('2.jpg'), { left: 540, top: 236, width: 540, height: 720 }, 'Bloom Horizon original artwork'),
    pair: await saveImage(src('2.jpg'), null, 'Solar Dune and Bloom Horizon displayed together'),
    capsules: await saveImage(src('3.jpg'), { left: 185, top: 95, width: 780, height: 1040 }, 'Chroma Capsules textile relief'),
    capsulesWall: await saveImage(src('3.jpg'), null, 'Chroma Capsules on a gallery wall'),
  };
  const categoryIds = new Map((await db.execute('SELECT slug, id FROM categories')).rows.map((r) => [r.slug, r.id]));
  const cat = (slug) => categoryIds.get(slug);

  const products = [
    {
      slug: 'teal-muse',
      title: 'Teal Muse',
      category: 'parametric',
      hot: 1,
      oneOfOne: 0,
      madeToOrder: 1,
      leadTime: '3–4 weeks',
      description:
        'A face emerges from dozens of precision-cut layers, its contours shifting as you move through the room. Finished in a deep lagoon teal, Teal Muse brings calm, sculptural presence to lounges, lobbies and statement walls.',
      materials: 'Precision-cut layered panels, hand-sanded and finished in satin teal. Supplied with concealed wall-mounting hardware.',
      images: [img.faceCrop, img.faceRoom],
      variants: [
        ['80 × 100 cm', 145000, null, null],
        ['100 × 120 cm', 185000, 210000, null],
        ['120 × 150 cm', 245000, null, null],
      ],
      sales: 0,
    },
    {
      slug: 'solar-dune',
      title: 'Solar Dune',
      category: 'plexi-art',
      hot: 1,
      oneOfOne: 0,
      madeToOrder: 0,
      leadTime: '',
      description:
        'A molten sun sinks behind a violet dune. Solar Dune pairs saturated colour with a fluorescent frame that glows as daylight moves across it.',
      materials: 'Hand-painted panel in a fluorescent plexiglass frame. Ready to hang.',
      images: [img.dune, img.pair],
      variants: [
        ['60 × 90 cm', 52000, 62000, 3],
        ['80 × 120 cm', 78000, 92000, 2],
      ],
      sales: 0,
    },
    {
      slug: 'bloom-horizon',
      title: 'Bloom Horizon',
      category: 'plexi-art',
      hot: 0,
      oneOfOne: 1,
      madeToOrder: 0,
      leadTime: '',
      description:
        'Clouds, blossoms and a setting sun rendered in layered lilac tones, with raised textured details you can feel. An original — once it finds a home, it will not be made again.',
      materials: 'Original mixed-media work with raised texture, framed. Signed on the reverse.',
      images: [img.bloom, img.pair],
      variants: [['80 × 120 cm — Original', 115000, null, 1]],
      sales: 0,
    },
    {
      slug: 'solar-diptych',
      title: 'Solar Diptych — Set of Two',
      category: 'plexi-art',
      hot: 0,
      oneOfOne: 0,
      madeToOrder: 0,
      leadTime: '',
      description:
        'Solar Dune and a companion bloom piece, composed to hang side by side. Two sunsets in conversation — made for long walls, entrances and double-height spaces.',
      materials: 'Two hand-painted panels in plexiglass frames. Ready to hang.',
      images: [img.pair, img.dune, img.bloom],
      variants: [
        ['2 × (60 × 90 cm)', 99000, 114000, 2],
        ['2 × (80 × 120 cm)', 165000, 193000, 1],
      ],
      sales: 0,
    },
    {
      slug: 'chroma-capsules',
      title: 'Chroma Capsules',
      category: '3d-arts',
      hot: 1,
      oneOfOne: 0,
      madeToOrder: 1,
      leadTime: '2–3 weeks',
      description:
        'Hand-wrapped capsules arranged in a full-spectrum gradient, from sunflower yellow to deep ultramarine. A soft, sculptural wall piece that adds colour, texture and acoustic warmth.',
      materials: 'Hand-wrapped cord over shaped forms, mounted on a hidden rigid backing.',
      images: [img.capsules, img.capsulesWall],
      variants: [
        ['90 × 110 cm', 128000, null, null],
        ['120 × 145 cm', 169000, null, null],
      ],
      sales: 0,
    },
  ];

  const t = await db.transaction('write');
  try {
    for (const p of products) {
      const res = await t.execute({
        sql: `INSERT INTO products
          (slug, title, category_id, description, materials, status, is_hot, is_one_of_one, made_to_order, lead_time, sales_count)
          VALUES (?, ?, ?, ?, ?, 'active', ?, ?, ?, ?, ?)`,
        args: [p.slug, p.title, cat(p.category), p.description, p.materials, p.hot, p.oneOfOne, p.madeToOrder, p.leadTime, p.sales],
      });
      const id = Number(res.lastInsertRowid);
      for (const [i, [label, price, compare, stock]] of p.variants.entries()) {
        await t.execute({
          sql: 'INSERT INTO variants (product_id, label, price_cents, compare_at_cents, stock, position) VALUES (?, ?, ?, ?, ?, ?)',
          args: [id, label, price, compare, stock, i],
        });
      }
      for (const [i, mediaId] of p.images.entries()) {
        await t.execute({ sql: 'INSERT INTO product_images (product_id, media_id, position) VALUES (?, ?, ?)', args: [id, mediaId, i] });
      }
    }
    await t.execute({ sql: "INSERT OR IGNORE INTO settings (key, value) VALUES ('hero_media_id', ?)", args: [String(img.faceRoom)] });
    await t.commit();
  } finally {
    t.close();
  }
  log(`${products.length} starter products created from your photos`);
}

db.close();
console.log('\nSeed complete.');
