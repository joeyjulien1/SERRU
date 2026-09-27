'use client';

import { PaymentElement, useElements, useStripe } from '@stripe/react-stripe-js';
import { useImperativeHandle, useState, type Ref } from 'react';
import type { PaymentHandle } from './payment-types';

export function StripeSection({ ref }: { ref: Ref<PaymentHandle> }) {
  const stripe = useStripe();
  const elements = useElements();
  const [ready, setReady] = useState(false);

  useImperativeHandle(
    ref,
    () => ({
      async prepare() {
        if (!stripe || !elements || !ready) return { ok: false, message: 'The payment form is still loading. Please try again.' };
        const { error } = await elements.submit();
        if (error) return { ok: false, message: error.message ?? 'Please check your card details.' };
        return { ok: true };
      },
      async complete(res, billing) {
        if (!stripe || !elements || !res.clientSecret) return { ok: false, message: 'Payment could not be started.' };
        const { error, paymentIntent } = await stripe.confirmPayment({
          elements,
          clientSecret: res.clientSecret,
          confirmParams: {
            return_url: `${window.location.origin}/checkout/success/${res.number}?token=${encodeURIComponent(res.token)}`,
            payment_method_data: { billing_details: billing },
          },
          redirect: 'if_required',
        });
        if (error) return { ok: false, message: error.message ?? 'Your payment was not completed.' };
        return { ok: true, status: paymentIntent?.status ?? 'processing' };
      },
    }),
    [stripe, elements, ready],
  );

  return (
    <PaymentElement
      onReady={() => setReady(true)}
      options={{
        layout: 'tabs',
        wallets: { applePay: 'never', googlePay: 'never' },
        fields: { billingDetails: { name: 'auto', email: 'never', phone: 'never', address: 'never' } },
      }}
    />
  );
}
