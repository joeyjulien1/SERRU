import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { AuthCard } from '@/components/store/AuthCard';
import { RegisterForm } from '@/components/store/AuthForms';
import { getCurrentCustomer } from '@/lib/customers';
import { safeNextPath } from '@/lib/validation';

export const metadata: Metadata = { title: 'Create account', robots: { index: false } };

export default async function RegisterPage(props: PageProps<'/account/register'>) {
  const { next } = (await props.searchParams) as { next?: string };
  const target = safeNextPath(next, '/account');
  if (await getCurrentCustomer()) redirect(target);
  return (
    <AuthCard
      title="Create account"
      subtitle="Track orders, save your details and hear about new pieces first."
      footer={
        <>
          Already have an account? <Link href={`/account/login${next ? `?next=${encodeURIComponent(target)}` : ''}`}>Sign in</Link>
        </>
      }
    >
      <RegisterForm next={target} />
    </AuthCard>
  );
}
