import type { Metadata } from 'next';
import Link from 'next/link';
import { AuthCard } from '@/components/store/AuthCard';
import { ForgotForm } from '@/components/store/AuthForms';

export const metadata: Metadata = { title: 'Reset password', robots: { index: false } };

export default function ForgotPage() {
  return (
    <AuthCard
      title="Reset your password"
      subtitle="We will email you a link to choose a new password."
      footer={
        <>
          Remembered it? <Link href="/account/login">Back to sign in</Link>
        </>
      }
    >
      <ForgotForm />
    </AuthCard>
  );
}
