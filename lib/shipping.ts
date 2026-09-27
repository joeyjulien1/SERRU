// Shipping math shared by the cart drawer (client) and checkout (server).

export type ShippingRules = { flatCents: number; freeThresholdCents: number };

export function shippingFor(subtotalCents: number, rules: ShippingRules): number {
  if (subtotalCents <= 0) return 0;
  if (rules.freeThresholdCents > 0 && subtotalCents >= rules.freeThresholdCents) return 0;
  return rules.flatCents;
}
