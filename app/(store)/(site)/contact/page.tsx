import type { Metadata } from 'next';
import Link from 'next/link';
import { Icon } from '@/components/Icon';
import { ContactForm } from '@/components/store/ContactForm';
import { BrandIcon } from '@/components/BrandIcon';
import { instagramHandle, instagramLink, whatsappLink } from '@/lib/social';
import { getSettings } from '@/lib/settings';

export const metadata: Metadata = {
  title: 'Contact & commissions',
  description: 'Ask about a piece, request a custom size or commission a work for your space.',
};

const STEPS = [
  { title: 'Share your space', text: 'Send photos of the wall, its size and the colours you love.' },
  { title: 'We design it', text: 'We come back with a concept and a price for your piece.' },
  { title: 'Crafted for you', text: 'Made by hand in our lab, then delivered or ready to collect.' },
];

export default async function ContactPage(props: PageProps<'/contact'>) {
  const { subject } = (await props.searchParams) as { subject?: string };
  const settings = await getSettings();
  return (
    <>
      <section className="contact-hero">
        <div className="container page-head">
          <nav className="breadcrumbs" aria-label="Breadcrumb">
            <Link href="/">Home</Link>
            <span aria-hidden="true">/</span>
            <span>Contact</span>
          </nav>
          <span className="eyebrow">Contact &amp; commissions</span>
          <h1 className="h1">Let&apos;s make something for your space.</h1>
          <p className="contact-hero__text">
            Questions about a piece, a custom size, or a full commission for your home, office or project — we would love
            to hear from you.
          </p>
          <span className="contact-hero__reply">
            <span className="live-dot" aria-hidden="true" />
            We reply within one business day
          </span>
        </div>
      </section>

      <div className="container">
        <div className="contact">
          <div className="contact__aside">
            <div className="contact-methods">
              {settings.whatsapp && (
                <a
                  className="contact-method contact-method--primary"
                  href={whatsappLink(settings.whatsapp)}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <span className="contact-method__icon">
                    <BrandIcon name="whatsapp" size={22} />
                  </span>
                  <span className="contact-method__text">
                    <small>WhatsApp · fastest reply</small>
                    {settings.whatsapp}
                  </span>
                  <Icon name="arrowRight" size={18} />
                </a>
              )}
              {settings.instagram && (
                <a className="contact-method" href={instagramLink(settings.instagram)} target="_blank" rel="noopener noreferrer">
                  <span className="contact-method__icon">
                    <BrandIcon name="instagram" size={22} />
                  </span>
                  <span className="contact-method__text">
                    <small>Instagram</small>
                    {instagramHandle(settings.instagram)}
                  </span>
                  <Icon name="arrowRight" size={18} />
                </a>
              )}
              {settings.contact_phone && (
                <a className="contact-method" href={`tel:${settings.contact_phone.replace(/\s/g, '')}`}>
                  <span className="contact-method__icon">
                    <Icon name="phone" size={20} />
                  </span>
                  <span className="contact-method__text">
                    <small>Phone</small>
                    {settings.contact_phone}
                  </span>
                  <Icon name="arrowRight" size={18} />
                </a>
              )}
              {settings.contact_email && (
                <a className="contact-method" href={`mailto:${settings.contact_email}`}>
                  <span className="contact-method__icon">
                    <Icon name="mail" size={20} />
                  </span>
                  <span className="contact-method__text">
                    <small>Email</small>
                    {settings.contact_email}
                  </span>
                  <Icon name="arrowRight" size={18} />
                </a>
              )}
              {settings.address && (
                <div className="contact-method">
                  <span className="contact-method__icon">
                    <Icon name="pin" size={20} />
                  </span>
                  <span className="contact-method__text" style={{ whiteSpace: 'pre-line' }}>
                    <small>Studio</small>
                    {settings.address}
                  </span>
                </div>
              )}
            </div>

            <div className="contact-steps">
              <span className="eyebrow">How a commission works</span>
              <ol className="contact-steps__list">
                {STEPS.map((step, i) => (
                  <li key={step.title}>
                    <span className="contact-steps__num">{String(i + 1).padStart(2, '0')}</span>
                    <div>
                      <h3>{step.title}</h3>
                      <p>{step.text}</p>
                    </div>
                  </li>
                ))}
              </ol>
            </div>
          </div>

          <div className="contact__form">
            <div className="contact__form-head">
              <span className="eyebrow">Send a message</span>
              <h2 className="h2">Tell us what you have in mind</h2>
            </div>
            <ContactForm
              defaultSubject={typeof subject === 'string' ? subject.slice(0, 120) : ''}
              defaults={{ name: '', email: '', phone: '' }}
            />
          </div>
        </div>
      </div>
    </>
  );
}
