import { getCurrentAdmin } from '@/lib/admin-auth';
import { listCustomers, listSubscribers } from '@/lib/admin-data';
import { countryName } from '@/lib/countries';
import { orderLabel } from '@/lib/format';
import { listOrders, listTransactions } from '@/lib/orders';

// Cells beginning with these characters could be run as formulas by spreadsheet apps.
function cell(value: unknown): string {
  let s = value === null || value === undefined ? '' : String(value);
  if (/^[=+\-@\t\r]/.test(s) && !/^-?\d+(\.\d+)?$/.test(s)) s = "'" + s;
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function csv(rows: unknown[][]): string {
  return '﻿' + rows.map((r) => r.map(cell).join(',')).join('\r\n') + '\r\n';
}

const money = (cents: number) => (cents / 100).toFixed(2);

export async function GET(request: Request) {
  if (!(await getCurrentAdmin())) return new Response('Unauthorized', { status: 401 });
  const type = new URL(request.url).searchParams.get('type');
  let rows: unknown[][];

  switch (type) {
    case 'orders': {
      const { items } = listOrders({ limit: 500 });
      rows = [
        ['Order', 'Date', 'Email', 'Name', 'Phone', 'Country', 'City', 'Payment', 'Fulfillment', 'Subtotal', 'Delivery', 'Total', 'Currency', 'Tracking'],
        ...items.map((o) => [
          orderLabel(o.number),
          o.createdAt,
          o.email,
          o.shipName,
          o.phone,
          countryName(o.country),
          o.city,
          o.paymentStatus,
          o.fulfillmentStatus,
          money(o.subtotalCents),
          money(o.shippingCents),
          money(o.totalCents),
          o.currency,
          o.trackingNumber,
        ]),
      ];
      break;
    }
    case 'transactions': {
      const { items } = listTransactions({ limit: 500 });
      rows = [
        ['Date', 'Order', 'Type', 'Status', 'Amount', 'Currency', 'Card', 'Provider', 'Reference', 'Email', 'Message'],
        ...items.map((t) => [
          t.createdAt,
          orderLabel(t.orderNumber),
          t.kind,
          t.status,
          money(t.kind === 'refund' ? -t.amountCents : t.amountCents),
          t.currency,
          t.cardLast4 ? `${t.cardBrand} •••• ${t.cardLast4}` : '',
          t.provider,
          t.providerRef ?? '',
          t.email,
          t.message,
        ]),
      ];
      break;
    }
    case 'customers': {
      const { items } = listCustomers('', 5000, 0);
      rows = [
        ['Name', 'Email', 'Phone', 'Paid orders', 'Total spent', 'Accepts marketing', 'Joined'],
        ...items.map((c) => [c.name, c.email, c.phone, c.orders, money(c.spentCents), c.acceptsMarketing ? 'yes' : 'no', c.createdAt]),
      ];
      break;
    }
    case 'subscribers': {
      rows = [['Email', 'Subscribed'], ...listSubscribers().map((s) => [s.email, s.createdAt])];
      break;
    }
    default:
      return new Response('Unknown export', { status: 400 });
  }

  const date = new Date().toISOString().slice(0, 10);
  return new Response(csv(rows), {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="serru-${type}-${date}.csv"`,
      'Cache-Control': 'no-store',
    },
  });
}
