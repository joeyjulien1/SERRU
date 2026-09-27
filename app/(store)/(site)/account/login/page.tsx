import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { AuthCard } from '@/components/store/AuthCard';
import { LoginForm } from '@/components/store/AuthForms';
import { getCurrentCustomer } from '@/lib/customers';
import { safeNextPath } from '@/lib/validation';

export const metadata: Metadata = { title: 'Sign in', robots: { index: false } };

export default async function LoginPage(props: PageProps<'/account/login'>) {
  const { next } = (await props.searchParams) as { next?: string };
  const target = safeNextPath(next, '/account');
  if (await getCurrentCustomer()) redirect(target);
  return (
    <AuthCard
      title="Sign in"
      subtitle="Welcome back. Sign in to view orders and check out faster."
      footer={
        <>
          New to SERRU LAB? <Link href={`/account/register${next ? `?next=${encodeURIComponent(target)}` : ''}`}>Create an account</Link>
        </>
      }
    >
      <LoginForm next={target} />
    </AuthCard>
  );
}
