import type { Metadata } from 'next';
import Link from 'next/link';
import { AuthCard } from '@/components/store/AuthCard';
import { ResetForm } from '@/components/store/AuthForms';

export const metadata: Metadata = { title: 'Choose a new password', robots: { index: false } };

export default async function ResetPage(props: PageProps<'/account/reset/[token]'>) {
  const { token } = await props.params;
  return (
    <AuthCard
      title="Choose a new password"
      footer={
        <>
          <Link href="/account/login">Back to sign in</Link>
        </>
      }
    >
      <ResetForm token={token} />
    </AuthCard>
  );
}
