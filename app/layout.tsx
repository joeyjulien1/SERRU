import type { Metadata, Viewport } from 'next';
import { Jost } from 'next/font/google';
import { storeUrl } from '@/lib/hosts';
import './globals.css';

// Jost is a geometric sans in the spirit of the Futura used in the SERRU LAB logo.
const jost = Jost({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600'],
  variable: '--font-jost',
  display: 'swap',
});

export const metadata: Metadata = {
  metadataBase: new URL(storeUrl()),
  title: {
    default: 'SERRU LAB — Luxury Perfected',
    template: '%s | SERRU LAB',
  },
  description:
    'Statement art designed and crafted in our lab: plexi art, metal art, wood art, parametric design, mirror art, 3D art and sculpture.',
  applicationName: 'SERRU LAB',
  openGraph: {
    type: 'website',
    siteName: 'SERRU LAB',
    images: [{ url: '/brand/logo-full.svg' }],
  },
};

export const viewport: Viewport = {
  themeColor: '#184a46',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    // data-scroll-behavior: page changes jump to the top instantly; smooth scrolling stays for in-page links.
    <html lang="en" className={jost.variable} data-scroll-behavior="smooth">
      <body>{children}</body>
    </html>
  );
}
