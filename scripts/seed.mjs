// Seeds SERRU LAB with categories, policy pages, the first admin account and starter products.
// Safe to run more than once: existing data is never overwritten.
//   npm run seed
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';
import sharp from 'sharp';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dataDir = path.resolve(process.env.DATA_DIR || path.join(root, 'storage'));
const uploads = path.join(dataDir, 'uploads');
fs.mkdirSync(uploads, { recursive: true });

const db = new DatabaseSync(path.join(dataDir, 'serru.db'));
db.exec('PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 5000; PRAGMA foreign_keys = ON;');
db.exec(fs.readFileSync(path.join(root, 'lib', 'schema.sql'), 'utf8'));

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
const insertCategory = db.prepare('INSERT OR IGNORE INTO categories (slug, name, description, position) VALUES (?, ?, ?, ?)');
categories.forEach(([slug, name, description], i) => insertCategory.run(slug, name, description, i));
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
const insertPage = db.prepare('INSERT OR IGNORE INTO pages (slug, title, body) VALUES (?, ?, ?)');
for (const [slug, [title, body]] of Object.entries(pages)) insertPage.run(slug, title, body);
log('pages ready');

// ───────────── First admin ─────────────
const adminCount = db.prepare('SELECT COUNT(*) AS n FROM admins').get().n;
if (adminCount === 0) {
  const email = (process.env.ADMIN_EMAIL || '').trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD || '';
  if (!email || password.length < 8) {
    console.warn('! No admin created: set ADMIN_EMAIL and ADMIN_PASSWORD (8+ characters) in .env.local, then run `npm run seed` again.');
  } else {
    const salt = crypto.randomBytes(16);
    const hash = crypto.scryptSync(password, salt, 64, { N: 16384, r: 8, p: 1 });
    const stored = ['scrypt', 16384, 8, 1, salt.toString('base64'), hash.toString('base64')].join('$');
    db.prepare("INSERT INTO admins (email, name, password_hash, role) VALUES (?, 'Store Owner', ?, 'owner')").run(email, stored);
    log(`owner admin created for ${email} (password from .env.local)`);
  }
} else {
  log('admin already exists — skipped');
}

// ───────────── Starter products (from _source photos) ─────────────
async function saveImage(input, region, alt) {
  let pipeline = sharp(input);
  if (region) pipeline = pipeline.extract(region);
  const buffer = await pipeline.toBuffer();
  const now = new Date();
  const sub = `${now.getUTCFullYear()}/${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
  fs.mkdirSync(path.join(uploads, sub), { recursive: true });
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
  const file = `${sub}/${name}.webp`;
  const thumbFile = `${sub}/${name}-t.webp`;
  fs.writeFileSync(path.join(uploads, file), large.data);
  fs.writeFileSync(path.join(uploads, thumbFile), thumb);
  const r = db
    .prepare('INSERT INTO media (file, thumb, width, height, alt) VALUES (?, ?, ?, ?, ?)')
    .run(file, thumbFile, large.info.width, large.info.height, alt);
  return Number(r.lastInsertRowid);
}

const productCount = db.prepare('SELECT COUNT(*) AS n FROM products').get().n;
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
  const cat = (slug) => db.prepare('SELECT id FROM categories WHERE slug = ?').get(slug).id;

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

  const insertProduct = db.prepare(`INSERT INTO products
    (slug, title, category_id, description, materials, status, is_hot, is_one_of_one, made_to_order, lead_time, sales_count)
    VALUES (?, ?, ?, ?, ?, 'active', ?, ?, ?, ?, ?)`);
  const insertVariant = db.prepare(
    'INSERT INTO variants (product_id, label, price_cents, compare_at_cents, stock, position) VALUES (?, ?, ?, ?, ?, ?)',
  );
  const insertImage = db.prepare('INSERT INTO product_images (product_id, media_id, position) VALUES (?, ?, ?)');
  db.exec('BEGIN');
  for (const p of products) {
    const id = Number(
      insertProduct.run(p.slug, p.title, cat(p.category), p.description, p.materials, p.hot, p.oneOfOne, p.madeToOrder, p.leadTime, p.sales)
        .lastInsertRowid,
    );
    p.variants.forEach(([label, price, compare, stock], i) => insertVariant.run(id, label, price, compare, stock, i));
    p.images.forEach((mediaId, i) => insertImage.run(id, mediaId, i));
  }
  db.prepare("INSERT OR IGNORE INTO settings (key, value) VALUES ('hero_media_id', ?)").run(String(img.faceRoom));
  db.exec('COMMIT');
  log(`${products.length} starter products created from your photos`);
}

db.close();
console.log('\nSeed complete.');
