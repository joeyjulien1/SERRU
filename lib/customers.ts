import 'server-only';
import { cache } from 'react';
import { get } from './db';
import { readSession } from './session';

export type Address = {
  name: string;
  phone: string;
  address1: string;
  address2: string;
  city: string;
  region: string;
  postal: string;
  country: string;
};

export type Customer = {
  id: number;
  email: string;
  firstName: string;
  lastName: string;
  phone: string;
  acceptsMarketing: boolean;
  defaultAddress: Address | null;
  createdAt: string;
};

type CustomerRow = {
  id: number;
  email: string;
  first_name: string;
  last_name: string;
  phone: string;
  accepts_marketing: number;
  default_address: string | null;
  created_at: string;
};

function parseAddress(json: string | null): Address | null {
  if (!json) return null;
  try {
    return JSON.parse(json) as Address;
  } catch {
    return null;
  }
}

export function mapCustomer(row: CustomerRow): Customer {
  return {
    id: row.id,
    email: row.email,
    firstName: row.first_name,
    lastName: row.last_name,
    phone: row.phone,
    acceptsMarketing: row.accepts_marketing === 1,
    defaultAddress: parseAddress(row.default_address),
    createdAt: row.created_at,
  };
}

export function getCustomerById(id: number): Customer | null {
  const row = get<CustomerRow>(
    'SELECT id, email, first_name, last_name, phone, accepts_marketing, default_address, created_at FROM customers WHERE id = ?',
    id,
  );
  return row ? mapCustomer(row) : null;
}

/** The signed-in customer for this request (memoized per render). */
export const getCurrentCustomer = cache(async (): Promise<Customer | null> => {
  const id = await readSession('customer');
  return id ? getCustomerById(id) : null;
});
