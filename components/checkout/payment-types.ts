export type Billing = {
  name: string;
  email: string;
  phone: string;
  address: { line1: string; line2: string; city: string; state: string; postal_code: string; country: string };
};

export type CheckoutResponse = { number: number; token: string; clientSecret?: string; status: string };

export type PrepareResult = { ok: true; extra?: Record<string, unknown> } | { ok: false; message: string };
export type CompleteResult = { ok: true; status: string } | { ok: false; message: string };

/** Implemented by each payment method section (Stripe card element or built-in test card form). */
export type PaymentHandle = {
  prepare: () => Promise<PrepareResult>;
  complete: (res: CheckoutResponse, billing: Billing) => Promise<CompleteResult>;
};
