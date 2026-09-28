import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { deletePageAction } from '@/app/admin/actions';
import { ConfirmButton } from '@/components/admin/ConfirmButton';
import { PageForm } from '@/components/admin/PageForm';
import { PageHead } from '@/components/admin/parts';
import { Icon } from '@/components/Icon';
import { Alert } from '@/components/ui';
import { requireAdminPage } from '@/lib/admin-auth';
import { storeUrl } from '@/lib/hosts';
import { getPage } from '@/lib/pages';

export const metadata: Metadata = { title: 'Edit page' };

// Pages linked from the footer and checkout; deleting them would break those links.
const CORE = new Set(['about', 'shipping', 'returns', 'privacy', 'terms']);

export default async function EditPagePage(props: PageProps<'/admin/pages/[slug]'>) {
  const admin = await requireAdminPage();
  const { slug } = await props.params;
  const { created } = (await props.searchParams) as { created?: string };
  const page = await getPage(slug);
  if (!page) notFound();
  return (
    <>
      <PageHead
        title={page.title}
        back={{ href: '/pages', label: 'Pages' }}
        actions={
          admin.role === 'owner' && !CORE.has(page.slug) ? (
            <ConfirmButton action={deletePageAction.bind(null, page.slug)} confirmText={`Delete the page “${page.title}”?`}>
              <Icon name="trash" size={14} /> Delete
            </ConfirmButton>
          ) : undefined
        }
      />
      {created && (
        <div style={{ marginBottom: 16 }}>
          <Alert tone="success">Page created.</Alert>
        </div>
      )}
      <PageForm page={{ slug: page.slug, title: page.title, body: page.body }} storeUrl={storeUrl()} />
    </>
  );
}
