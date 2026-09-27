import type { Metadata } from 'next';
import Link from 'next/link';
import { Icon } from '@/components/Icon';
import { ContactForm } from '@/components/store/ContactForm';
import { instagramLink, whatsappLink } from '@/components/store/Footer';
import { getCurrentCustomer } from '@/lib/customers';
import { getSettings } from '@/lib/settings';

export const metadata: Metadata = {
  title: 'Contact & commissions',
  description: 'Ask about a piece, request a custom size or commission a work for your space.',
};

export default async function ContactPage(props: PageProps<'/contact'>) {
  const { subject } = (await props.searchParams) as { subject?: string };
  const settings = getSettings();
  const customer = await getCurrentCustomer();
  return (
    <div className="container">
      <header className="page-head">
        <nav className="breadcrumbs" aria-label="Breadcrumb">
          <Link href="/">Home</Link>
          <span aria-hidden="true">/</span>
          <span>Contact</span>
        </nav>
        <span className="eyebrow">Contact &amp; commissions</span>
        <h1 className="h1">Let&apos;s make something for your space.</h1>
      </header>
      <div className="contact">
        <div className="stack" style={{ '--stack': '22px' } as React.CSSProperties}>
          <p className="lead">
            Questions about a piece, a custom size, or a full commission for your home, office or project — send us a
            message and we will reply within one business day.
          </p>
          <div className="contact-methods">
            {settings.whatsapp && (
              <a className="contact-method" href={whatsappLink(settings.whatsapp)} target="_blank" rel="noopener noreferrer">
                <Icon name="whatsapp" size={24} />
                <span>
                  <small>WhatsApp</small>
                  {settings.whatsapp}
                </span>
              </a>
            )}
            {settings.contact_phone && (
              <a className="contact-method" href={`tel:${settings.contact_phone.replace(/\s/g, '')}`}>
                <Icon name="phone" size={24} />
                <span>
                  <small>Phone</small>
                  {settings.contact_phone}
                </span>
              </a>
            )}
            {settings.contact_email && (
              <a className="contact-method" href={`mailto:${settings.contact_email}`}>
                <Icon name="mail" size={24} />
                <span>
                  <small>Email</small>
                  {settings.contact_email}
                </span>
              </a>
            )}
            {settings.instagram && (
              <a className="contact-method" href={instagramLink(settings.instagram)} target="_blank" rel="noopener noreferrer">
                <Icon name="instagram" size={24} />
                <span>
                  <small>Instagram</small>
                  {settings.instagram}
                </span>
              </a>
            )}
            {settings.address && (
              <div className="contact-method">
                <Icon name="pin" size={24} />
                <span style={{ whiteSpace: 'pre-line' }}>
                  <small>Studio</small>
                  {settings.address}
                </span>
              </div>
            )}
          </div>
        </div>
        <ContactForm
          defaultSubject={typeof subject === 'string' ? subject.slice(0, 120) : ''}
          defaults={{
            name: customer ? `${customer.firstName} ${customer.lastName}`.trim() : '',
            email: customer?.email ?? '',
            phone: customer?.phone ?? '',
          }}
        />
      </div>
    </div>
  );
}
