import { AdminShell } from '@/components/admin/AdminShell';
import { requireAdminPage } from '@/lib/admin-auth';
import { unreadMessages } from '@/lib/admin-data';
import { storeUrl } from '@/lib/hosts';

export default async function PanelLayout({ children }: { children: React.ReactNode }) {
  const admin = await requireAdminPage();
  return (
    <AdminShell
      admin={{ name: admin.name, email: admin.email, role: admin.role }}
      counts={{ inbox: await unreadMessages() }}
      storeUrl={storeUrl()}
    >
      {children}
    </AdminShell>
  );
}
