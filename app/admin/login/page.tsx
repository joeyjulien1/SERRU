import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { AdminLoginForm } from '@/components/admin/AdminLoginForm';
import { getCurrentAdmin } from '@/lib/admin-auth';

export const metadata: Metadata = { title: 'Sign in' };

export default async function AdminLoginPage() {
  if (await getCurrentAdmin()) redirect('/');
  return (
    <main className="adm-login">
      <div className="auth-card">
        <div style={{ display: 'grid', justifyItems: 'center', gap: 10, marginBottom: 24 }}>
          <img src="/brand/logo.svg" alt="SERRU LAB" width={140} height={34} />
          <h1>Admin sign in</h1>
          <p>Store management for authorized staff only.</p>
        </div>
        <AdminLoginForm />
      </div>
    </main>
  );
}
