export type PrepareResult = { ok: true; extra?: Record<string, unknown> } | { ok: false; message: string };

/** Implemented by payment sections that collect details on this page (the built-in test card form). */
export type PaymentHandle = {
  prepare: () => Promise<PrepareResult>;
};
