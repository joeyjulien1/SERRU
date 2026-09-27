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
- Shopify-style **one-page checkout**, card payment (Visa / Mastercard), order confirmation page and emails
- Shopify-style **customer accounts**: sign in, create account, forgot/reset password, order history, saved address, profile, password change
- Contact & commissions form, search, About and policy pages, sitemap and robots.txt

**Admin panel** (`admin.` domain)
- Dashboard: 30-day revenue chart, paid orders, average order, orders to fulfil, top sellers, low stock
- **Products**: upload photos (drag & drop, reorder, choose cover — auto-resized to WebP), sizes with price / compare-at price / stock / SKU, status (active / draft / archived), category, Hot, One of one, Made to order
- **Orders**: filter & search, fulfilment status, tracking number (emails the customer), internal notes, cancel with restock, **refunds**
- **Transactions**: every card charge, decline and refund, with card brand and last 4 digits; CSV export
- Categories (with cover images), Customers (CSV export), Inbox (messages + newsletter subscribers, CSV export), Pages editor
- Settings: store name, currency, delivery fee & free-delivery threshold, homepage texts and hero image, contact details, payment status, team members (owner / staff), password

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

## Card payments (Visa / Mastercard)

Card payments go through **Stripe**. Card numbers are typed into Stripe's secure field and never reach this server.

- **Without Stripe keys (development)** the checkout runs in **TEST MODE**: it only accepts test cards such as `4242 4242 4242 4242` (any future date, any CVC; `4000 0000 0000 0002` simulates a decline). Nothing is charged.
- **In production without keys**, checkout is closed with a "contact us to order" message — it never fakes payments.

To take real payments:

1. Create a Stripe account and copy your keys from https://dashboard.stripe.com/apikeys into `.env.local` (or your server's environment):
   ```
   STRIPE_SECRET_KEY=sk_live_...
   STRIPE_PUBLISHABLE_KEY=pk_live_...
   ```
   Use `sk_test_` / `pk_test_` keys first to try it with Stripe's test cards.
2. In Stripe → Developers → Webhooks, add the endpoint `https://YOUR-STORE-DOMAIN/api/stripe/webhook` with the events
   `payment_intent.succeeded`, `payment_intent.payment_failed`, `payment_intent.canceled`, `charge.refunded`,
   and put its signing secret in `STRIPE_WEBHOOK_SECRET`.
3. Restart the site. Admin → Settings → Card payments shows whether everything is connected.

> Stripe only onboards businesses registered in its supported countries (https://stripe.com/global).
> If your company is registered elsewhere, you need a company in a supported country or a local card gateway.
> All payment code lives in `lib/payments.ts`, `lib/checkout.ts`, `app/api/checkout/*` and `components/checkout/*`,
> so switching provider is a contained change.

---

## Email

Without SMTP settings, emails (order confirmations, shipping updates, password resets, contact-form notifications) are written to `storage/outbox.log`. To send real email, fill in `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `MAIL_FROM` and `NOTIFY_EMAIL` (where new-order and contact notifications go).

---

## Put it online (two domains)

The site needs a server that keeps files (the database and uploaded photos live in `storage/`) — for example a small VPS (Ubuntu) from Hetzner, DigitalOcean, Hostinger, etc.

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
   STRIPE_SECRET_KEY=...  STRIPE_PUBLISHABLE_KEY=...  STRIPE_WEBHOOK_SECRET=...
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
app/api/…            cart validation, checkout, Stripe webhook, admin upload & CSV export
app/media/…          serves uploaded images from storage/uploads
proxy.ts             splits the store and admin domains
lib/                 database, catalogue, orders & stock, payments, auth, settings, email
components/          UI (store, cart, checkout, admin)
scripts/seed.mjs     first-run data; scripts/create-admin.mjs to add/reset admins
storage/             database + uploads (created automatically, never commit it)
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
