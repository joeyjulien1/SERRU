// Host helpers shared by proxy.ts and server code. No server-only imports here.

const DEFAULT_STORE_URL = 'http://localhost:3000';
const DEFAULT_ADMIN_URL = 'http://admin.localhost:3000';

function hostOf(url: string): string | null {
  try {
    return new URL(url).host.toLowerCase();
  } catch {
    return null;
  }
}

export function storeUrl(): string {
  return (process.env.STORE_URL || DEFAULT_STORE_URL).replace(/\/+$/, '');
}

export function adminUrl(): string {
  return (process.env.ADMIN_URL || DEFAULT_ADMIN_URL).replace(/\/+$/, '');
}

/** True when the request host is the admin panel host (e.g. admin.serrulab.com). */
export function isAdminHost(host: string | null | undefined): boolean {
  if (!host) return false;
  const h = host.toLowerCase();
  const configured = hostOf(adminUrl());
  if (configured && h === configured) return true;
  // Fallback for previews/tunnels: any host whose first label is "admin".
  return h.startsWith('admin.');
}
