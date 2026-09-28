import type { Metadata } from 'next';
import { CheckoutClient } from '@/components/checkout/CheckoutClient';
import { COUNTRIES } from '@/lib/countries';
import { getCurrentCustomer } from '@/lib/customers';
import { paymentMode } from '@/lib/payments';
import { getSettings } from '@/lib/settings';

export const metadata: Metadata = { title: 'Checkout', robots: { index: false } };

export default async function CheckoutPage() {
  const settings = await getSettings();
  const customer = await getCurrentCustomer();
  const address = customer?.defaultAddress;
  const [first = '', ...rest] = (address?.name ?? '').split(' ');
  return (
    <CheckoutClient
      cardMode={paymentMode()}
      codEnabled={settings.cod_enabled === '1'}
      countries={COUNTRIES}
      signedIn={!!customer}
      defaults={{
        email: customer?.email ?? '',
        firstName: address ? first : (customer?.firstName ?? ''),
        lastName: address ? rest.join(' ') : (customer?.lastName ?? ''),
        phone: address?.phone || customer?.phone || '',
        address1: address?.address1 ?? '',
        address2: address?.address2 ?? '',
        city: address?.city ?? '',
        region: address?.region ?? '',
        postal: address?.postal ?? '',
        country: address?.country ?? settings.default_country,
      }}
    />
  );
}
