import { PostgrestClient } from '@supabase/postgrest-js';
import type { Database } from './types';

const POSTGREST_URL = import.meta.env.VITE_POSTGREST_URL as string;
const TOKEN_STORAGE_KEY = 'estudo_biblico_token';

// PostgREST reads the JWT from an Authorization header — it can't read the
// httpOnly cookie the login service also sets. The token lives in localStorage,
// the same place the previous Supabase client already stored its own token.
export function getStoredToken(): string | null {
  return localStorage.getItem(TOKEN_STORAGE_KEY);
}

export function setStoredToken(token: string | null): void {
  if (token) localStorage.setItem(TOKEN_STORAGE_KEY, token);
  else localStorage.removeItem(TOKEN_STORAGE_KEY);
}

function authHeaders(): Record<string, string> {
  const token = getStoredToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function postgrest() {
  return new PostgrestClient<Database>(POSTGREST_URL, { headers: authHeaders() });
}

// Minimal `.channel()`/`.removeChannel()` compatibility shim. PostgREST has no
// realtime subscriptions, so hooks that still call these keep compiling and
// running — they just won't receive live updates until a later migration phase
// replaces this (out of scope for the auth/infra foundation phase).
interface StubChannel {
  // Matches the shape every caller uses: .on('postgres_changes', filter, callback).
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  on: (event: string, filter: object, callback: (payload: any) => void) => StubChannel;
  subscribe: (...args: unknown[]) => StubChannel;
}

function createStubChannel(): StubChannel {
  const channel: StubChannel = {
    on: () => channel,
    subscribe: () => channel,
  };
  return channel;
}

// Forwards the generic type parameter to PostgrestClient#from so callers keep
// getting the per-table Row/Insert/Update types instead of a widened union.
function from<TableName extends string & keyof Database['public']['Tables']>(table: TableName) {
  return postgrest().from(table);
}

export const supabase = {
  from,
  channel: (_name: string) => createStubChannel(),
  removeChannel: (_channel: unknown) => {},
};
