import type { Metadata } from 'next';
import Link from 'next/link';
import { PageHead } from '@/components/admin/parts';
import { Icon } from '@/components/Icon';
import { Alert } from '@/components/ui';
import { formatDate } from '@/lib/format';
import { listPages } from '@/lib/pages';

export const metadata: Metadata = { title: 'Pages' };

export default async function PagesPage(props: PageProps<'/admin/pages'>) {
  const { deleted } = (await props.searchParams) as { deleted?: string };
  const pages = await listPages();
  return (
    <>
      <PageHead
        title="Pages"
        description="About us and your store policies. Footer links point to these pages."
        actions={
          <Link href="/pages/new" className="btn">
            <Icon name="plus" size={16} /> New page
          </Link>
        }
      />
      {deleted && (
        <div style={{ marginBottom: 16 }}>
          <Alert tone="success">Page deleted.</Alert>
        </div>
      )}
      <div className="adm-card">
        <div className="adm-table-wrap">
          <table className="adm-table">
            <thead>
              <tr>
                <th>Title</th>
                <th>URL</th>
                <th>Last updated</th>
              </tr>
            </thead>
            <tbody>
              {pages.map((p) => (
                <tr key={p.slug}>
                  <td>
                    <Link href={`/pages/${p.slug}`} className="row-link">
                      {p.title}
                    </Link>
                  </td>
                  <td className="small muted">/pages/{p.slug}</td>
                  <td className="small">{formatDate(p.updatedAt, true)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
