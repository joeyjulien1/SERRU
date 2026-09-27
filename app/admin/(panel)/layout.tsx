import { AdminShell } from '@/components/admin/AdminShell';
import { requireAdminPage } from '@/lib/admin-auth';
import { unreadMessages } from '@/lib/admin-data';
import { get } from '@/lib/db';
import { storeUrl } from '@/lib/hosts';

export default async function PanelLayout({ children }: { children: React.ReactNode }) {
  const admin = await requireAdminPage();
  const toFulfil =
    get<{ n: number }>(
      "SELECT COUNT(*) AS n FROM orders WHERE payment_status = 'paid' AND fulfillment_status IN ('unfulfilled', 'processing')",
    )?.n ?? 0;
  return (
    <AdminShell
      admin={{ name: admin.name, email: admin.email, role: admin.role }}
      counts={{ orders: toFulfil, inbox: unreadMessages() }}
      storeUrl={storeUrl()}
    >
      {children}
    </AdminShell>
  );
}
