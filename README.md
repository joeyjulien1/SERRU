# SERRU LAB — online store + admin panel

A complete, mobile-first art store for **SERRU LAB — Luxury Perfected**, with a separate admin panel on its own domain.

| Site | Development | Production (example) |
| --- | --- | --- |
| Storefront | http://localhost:3000 | https://serrulab.com |
| Admin panel | http://admin.localhost:3000 | https://admin.serrulab.com |

The admin panel does not exist on the store domain (every `/admin` URL there returns 404), and the two sites use separate logins.

---

## What's included

**Storefront**
- Home page: hero, scrolling banner, *Hot right now*, the 7 collections (Plexi Art, Metal Art, Wood Art, Parametric, Mirrors Art, 3D Arts, Sculpture) with live piece counts, *One of one* originals, custom commissions, animated stats, newsletter
- Shop and collection pages with filters (Hot, 1 of 1, category), sorting and pagination
- Product pages: swipeable photo gallery, **sizes with their own price and stock**, sale ("compare at") prices, low-stock badges, made-to-order lead times, sticky mobile "Add to cart" bar, related pieces, Google product data (SEO)
- Cart drawer + cart page with a free-delivery progress bar; prices and stock are re-checked with the server
- Shopify-style **one-page checkout** with two payment methods: **card (Visa / Mastercard) via Tap Payments** and **cash on delivery**; order confirmation page and emails
- Shopify-style **customer accounts**: sign in, create account, forgot/reset password, order history, saved address, profile, password change
- Contact & commissions form, search, About and policy pages, sitemap and robots.txt

**Admin panel** (`admin.` domain)
- Dashboard: 30-day revenue chart, paid orders, average order, orders to fulfil, top sellers, low stock
- **Products**: upload photos (drag & drop, reorder, choose cover — auto-resized to WebP), sizes with price / compare-at price / stock / SKU, status (active / draft / archived), category, Hot, One of one, Made to order
- **Orders**: filter & search, *To fulfil* and *Cash to collect* views, fulfilment status, tracking number (emails the customer), internal notes, cancel with restock, **mark cash-on-delivery orders as paid**, **refunds**
- **Transactions**: every card charge, decline, cash collection and refund, with card brand and last 4 digits; CSV export
- Categories (with cover images), Customers (CSV export), Inbox (messages + newsletter subscribers, CSV export), Pages editor
- Settings: store name, currency, delivery fee & free-delivery threshold, cash on delivery on/off, homepage texts and hero image, contact details, payment status, team members (owner / staff), password

---

## Run it on your computer

Requirements: **Node.js 22.13 or newer** (Node 24 recommended).

```bash
npm install
npm run seed      # first time only: categories, pages, your admin account and the starter products
npm run dev
```

Then open http://localhost:3000 (store) and http://admin.localhost:3000 (admin).

**Admin login:** the email and password are in `.env.local` (`ADMIN_EMAIL`, `ADMIN_PASSWORD`). Change the password after your first sign-in (Admin → Settings → Your password).

Forgot the admin password? Reset it from the project folder:

```bash
npm run create-admin -- admin@serrulab.com "a-new-long-password"
```

---

## Payments

Customers choose one of two methods at checkout.

### Card (Visa / Mastercard) — Tap Payments

At **Pay**, the customer is taken to **Tap's secure payment page** (3-D Secure included), then sent back to the order
confirmation page. Card numbers are entered on Tap's page and never reach this server. Every payment is confirmed by
fetching the charge from Tap's API with your secret key — the return link and webhooks are never trusted on their own.

- **Without a Tap key (development)** the checkout runs in **TEST MODE**: it only accepts test cards such as
  `4242 4242 4242 4242` (any future date, any CVC; `4000 0000 0000 0002` simulates a decline). Nothing is charged.
- **In production without a key**, card payments are hidden (cash on delivery keeps working) — it never fakes payments.

To take real card payments:

1. Open a merchant account at https://www.tap.company and copy your **secret key** into `.env.local`
   (or your server's environment):
   ```
   TAP_SECRET_KEY=sk_test_...     # sandbox first, then sk_live_...
   ```
2. Restart the site. Admin → Settings → *Card payments — Tap* shows whether the key is set.
3. Once the site runs on **HTTPS**, every charge tells Tap to post updates to `https://YOUR-STORE-DOMAIN/api/tap/webhook`
   automatically — nothing to configure in Tap's dashboard.
4. Refunds are issued from Admin → Orders → (order) → *Refund*.

> **Check eligibility first.** Tap's support page (updated April 2025) says Tap does not currently accept new merchants
> from Egypt, Jordan or Lebanon — confirm with Tap before you rely on it. The payment code is isolated in
> `lib/payments.ts`, `lib/checkout.ts`, `app/api/checkout/*`, `app/api/tap/*` and `components/checkout/*`, so switching
> to another hosted-page gateway (for example Areeba) is a contained change.

### Cash on delivery

On by default (Admin → Settings → *Delivery & payment*). The order is confirmed straight away and its stock is held.
When the courier brings back the cash, open the order and press **Mark as paid (cash collected)** — it then counts in
revenue and appears in Transactions. The *Cash to collect* tab lists every order still waiting for cash.

---

## Email

Without SMTP settings, emails (order confirmations, shipping updates, password resets, contact-form notifications) are written to `storage/outbox.log`. To send real email, fill in `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `MAIL_FROM` and `NOTIFY_EMAIL` (where new-order and contact notifications go).

---

## Put it online on Vercel (recommended)

One Vercel project serves both sites — the app picks the store or the admin panel from the address (`proxy.ts`).
Vercel keeps no files between requests, so in production the database lives in **Turso** (hosted SQLite, same SQL)
and uploaded photos in **Vercel Blob**. On your computer nothing changes: without those settings the app keeps using `storage/`.

1. **Import** the GitHub repository in Vercel (framework: Next.js). `vercel.json` makes every build run `scripts/seed.mjs`
   first, which creates the tables and — on an empty database — the categories, pages, starter products and your admin.
2. **Storage** (project → Storage): connect a **Turso** database and a **Blob** store (public access). They add
   `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN` and `BLOB_READ_WRITE_TOKEN` to the project. Builds stop with a clear
   message while either is missing.
3. **Domains** (project → Settings → Domains): the store domain (e.g. `serrulab.com`) and the admin domain
   (e.g. `admin.serrulab.com`), both on the same project.
4. **Environment variables**: `STORE_URL` and `ADMIN_URL` (full `https://` addresses of those two domains),
   `ADMIN_EMAIL` + `ADMIN_PASSWORD` (the first admin, created by the seed), `TAP_SECRET_KEY`, and the SMTP settings.
5. **Redeploy.** Every push to `main` deploys again; data in Turso and Blob is kept.

Put the Vercel functions in the same region as the Turso database (Settings → Functions → Region) — every page reads the database.

To reset the production admin password from your computer, put the three storage values in `.env.local` and run
`npm run create-admin -- you@example.com "a-new-long-password"`.

## Put it online on your own server (two domains)

Alternatively, run it on a server that keeps files (the database and uploaded photos live in `storage/`) — for example a small VPS (Ubuntu) from Hetzner, DigitalOcean, Hostinger, etc.

1. **DNS:** point both `serrulab.com` and `admin.serrulab.com` (A records) to the server's IP.
2. **Install:** Node.js 24, then copy the project (without `node_modules`, `.next`), and run:
   ```bash
   npm ci
   npm run build
   ```
3. **Environment:** create `.env.local` on the server with
   ```
   STORE_URL=https://serrulab.com
   ADMIN_URL=https://admin.serrulab.com
   ADMIN_EMAIL=...        ADMIN_PASSWORD=...   (then: npm run seed)
   TAP_SECRET_KEY=sk_live_...
   ```
4. **Run it permanently** with PM2: `npm i -g pm2 && pm2 start "npm start" --name serru && pm2 save && pm2 startup`
5. **Nginx + HTTPS** — one server block for both domains, passing the host through:
   ```nginx
   server {
     server_name serrulab.com www.serrulab.com admin.serrulab.com;
     client_max_body_size 25m;                 # product photo uploads
     location / {
       proxy_pass http://127.0.0.1:3000;
       proxy_set_header Host $host;
       proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
       proxy_set_header X-Forwarded-Proto $scheme;
     }
   }
   ```
   then `sudo certbot --nginx -d serrulab.com -d www.serrulab.com -d admin.serrulab.com`.
6. **Backups:** copy the `storage/` folder regularly — it contains the database and all uploaded photos.

---

## Project layout

```
app/(store)/…        storefront pages (home, shop, product, cart, checkout, account, contact, pages)
app/admin/…          admin panel pages (served on the admin domain only)
app/api/…            cart validation, checkout, Tap webhook, admin upload & CSV export
app/media/…          serves uploaded images from storage/uploads
proxy.ts             splits the store and admin domains
lib/                 database, catalogue, orders & stock, payments, auth, settings, email
components/          UI (store, cart, checkout, admin)
scripts/seed.mjs     first-run data (also runs on every Vercel build); scripts/create-admin.mjs to add/reset admins
storage/             local database + uploads (created automatically, never commit it; Turso + Vercel Blob in production)
_source/             your original logo PDF and photos used by the seed
public/brand/        logo files generated from your PDF (SVG)
```

## Useful commands

```bash
npm run dev          # development server
npm run build        # production build
npm start            # run the production build
npm run typecheck    # TypeScript check
npm run lint         # ESLint
```
