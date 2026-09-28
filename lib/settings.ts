import 'server-only';
import { cache } from 'react';
import { all, run, tx } from './db';
import type { ShippingRules } from './shipping';

export const SETTING_DEFAULTS = {
  store_name: 'SERRU LAB',
  tagline: 'Luxury Perfected',
  currency: 'USD',
  default_country: 'LB',
  cod_enabled: '1',
  shipping_flat_cents: '2500',
  free_shipping_threshold_cents: '50000',
  announcement: 'See any piece on your own wall before you order',
  hero_eyebrow: 'Plexi · Metal · Wood · Parametric · Mirrors · 3D · Sculpture',
  hero_title: 'Art that shapes the room.',
  hero_subtitle:
    'Statement pieces designed and crafted in our lab — parametric wood, plexi, metal and mirror art, made to the size of your space.',
  hero_media_id: '',
  marquee: 'Crafted in our lab\nCustom sizes available\nSecure card checkout\nLuxury perfected',
  contact_email: '',
  contact_phone: '',
  whatsapp: '',
  instagram: '',
  address: '',
} as const;

export type SettingKey = keyof typeof SETTING_DEFAULTS;
export type Settings = Record<SettingKey, string>;

export const getSettings = cache(async (): Promise<Settings> => {
  const rows = await all<{ key: string; value: string }>('SELECT key, value FROM settings');
  const out: Settings = { ...SETTING_DEFAULTS };
  for (const r of rows) {
    if (r.key in SETTING_DEFAULTS) out[r.key as SettingKey] = r.value;
  }
  return out;
});

export async function saveSettings(values: Partial<Settings>): Promise<void> {
  await tx(async () => {
    for (const [key, value] of Object.entries(values)) {
      if (!(key in SETTING_DEFAULTS) || value === undefined) continue;
      await run(
        'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
        key,
        value,
      );
    }
  });
}

export function shippingRules(s: Settings): ShippingRules {
  return {
    flatCents: Math.max(0, Number(s.shipping_flat_cents) || 0),
    freeThresholdCents: Math.max(0, Number(s.free_shipping_threshold_cents) || 0),
  };
}
