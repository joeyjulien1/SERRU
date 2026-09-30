import { getCurrentAdmin } from '@/lib/admin-auth';
import { listSubscribers } from '@/lib/admin-data';

// Cells beginning with these characters could be run as formulas by spreadsheet apps.
function cell(value: unknown): string {
  let s = value === null || value === undefined ? '' : String(value);
  if (/^[=+\-@\t\r]/.test(s) && !/^-?\d+(\.\d+)?$/.test(s)) s = "'" + s;
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function csv(rows: unknown[][]): string {
  return '﻿' + rows.map((r) => r.map(cell).join(',')).join('\r\n') + '\r\n';
}

export async function GET(request: Request) {
  if (!(await getCurrentAdmin())) return new Response('Unauthorized', { status: 401 });
  const type = new URL(request.url).searchParams.get('type');
  if (type !== 'subscribers') return new Response('Unknown export', { status: 400 });

  const rows = [['Email', 'Subscribed'], ...(await listSubscribers()).map((s) => [s.email, s.createdAt])];
  const date = new Date().toISOString().slice(0, 10);
  return new Response(csv(rows), {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="serru-${type}-${date}.csv"`,
      'Cache-Control': 'no-store',
    },
  });
}
