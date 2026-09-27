import Link from 'next/link';
import type { ReactNode } from 'react';
import { Icon } from '../Icon';

export function PageHead({
  title,
  description,
  back,
  actions,
}: {
  title: ReactNode;
  description?: ReactNode;
  back?: { href: string; label: string };
  actions?: ReactNode;
}) {
  return (
    <>
      {back && (
        <Link href={back.href} className="adm-back">
          <Icon name="arrowLeft" size={15} /> {back.label}
        </Link>
      )}
      <div className="adm-head">
        <div>
          <h1>{title}</h1>
          {description && <p>{description}</p>}
        </div>
        {actions && <div className="adm-head__actions">{actions}</div>}
      </div>
    </>
  );
}

export function Pager({ page, pageSize, total, href }: { page: number; pageSize: number; total: number; href: (p: number) => string }) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(total, page * pageSize);
  return (
    <div className="adm-pager">
      <span>
        {from}–{to} of {total}
      </span>
      <div>
        {page > 1 ? (
          <Link className="btn btn--outline btn--sm" href={href(page - 1)}>
            <Icon name="chevronLeft" size={14} /> Prev
          </Link>
        ) : null}
        {page < pages ? (
          <Link className="btn btn--outline btn--sm" href={href(page + 1)}>
            Next <Icon name="chevronRight" size={14} />
          </Link>
        ) : null}
      </div>
    </div>
  );
}

export function Empty({ icon = 'box', title, children }: { icon?: Parameters<typeof Icon>[0]['name']; title: string; children?: ReactNode }) {
  return (
    <div className="adm-empty">
      <Icon name={icon} size={36} strokeWidth={1.3} />
      <strong style={{ color: 'var(--ink)', fontWeight: 500 }}>{title}</strong>
      {children}
    </div>
  );
}

export function qs(base: string, params: Record<string, string | number | undefined>): string {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== '' && v !== 'all') q.set(k, String(v));
  const s = q.toString();
  return s ? `${base}?${s}` : base;
}
