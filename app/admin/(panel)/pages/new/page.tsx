import type { Metadata } from 'next';
import { PageForm } from '@/components/admin/PageForm';
import { PageHead } from '@/components/admin/parts';
import { storeUrl } from '@/lib/hosts';

export const metadata: Metadata = { title: 'New page' };

export default function NewPagePage() {
  return (
    <>
      <PageHead title="New page" back={{ href: '/pages', label: 'Pages' }} />
      <PageForm page={null} storeUrl={storeUrl()} />
    </>
  );
}
