import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../../server/database.types';
import {
  getBrowserEnv,
  type BrowserEnvironment,
} from './env';

export type BrowserSupabaseClient = SupabaseClient<Database>;

export function createBrowserSupabaseClient(
  environment: BrowserEnvironment,
): BrowserSupabaseClient {
  return createClient<Database>(
    environment.supabaseUrl,
    environment.supabaseAnonKey,
    {
      auth: {
        autoRefreshToken: false,
        detectSessionInUrl: false,
        persistSession: false,
      },
      db: {
        schema: 'public',
      },
    },
  );
}

let browserClient: BrowserSupabaseClient | undefined;

export function getBrowserSupabaseClient(): BrowserSupabaseClient {
  browserClient ??= createBrowserSupabaseClient(getBrowserEnv());
  return browserClient;
}
