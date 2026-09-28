import 'server-only';
import { cache } from 'react';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { get } from './db';
import { isAdminHost } from './hosts';
import { readSession } from './session';

export type Admin = {
  id: number;
  email: string;
  name: string;
  role: 'owner' | 'staff';
};

async function onAdminHost(): Promise<boolean> {
  const h = await headers();
  return isAdminHost(h.get('x-forwarded-host') ?? h.get('host'));
}

export const getCurrentAdmin = cache(async (): Promise<Admin | null> => {
  if (!(await onAdminHost())) return null;
  const id = await readSession('admin');
  if (!id) return null;
  return (await get<Admin>('SELECT id, email, name, role FROM admins WHERE id = ?', id)) ?? null;
});

/** For admin pages: redirects to the admin login when not signed in. */
export async function requireAdminPage(): Promise<Admin> {
  const admin = await getCurrentAdmin();
  if (!admin) redirect('/login');
  return admin;
}

/** For admin Server Actions and Route Handlers: throws when not authorized. */
export async function requireAdmin(role?: 'owner'): Promise<Admin> {
  const admin = await getCurrentAdmin();
  if (!admin) throw new Error('Unauthorized');
  if (role === 'owner' && admin.role !== 'owner') throw new Error('Only the store owner can do this');
  return admin;
}
