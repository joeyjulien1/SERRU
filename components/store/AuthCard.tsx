import type { ReactNode } from 'react';

export function AuthCard({ title, subtitle, children, footer }: { title: string; subtitle?: string; children: ReactNode; footer?: ReactNode }) {
  return (
    <div className="auth">
      <div className="auth-card">
        <div className="auth-card__head">
          <img src="/brand/logo.svg" alt="SERRU LAB" width={126} height={30} />
          <h1 className="auth-card__title">{title}</h1>
          {subtitle && <p className="auth-card__sub">{subtitle}</p>}
        </div>
        {children}
        {footer && <div className="auth-card__alt">{footer}</div>}
      </div>
    </div>
  );
}
