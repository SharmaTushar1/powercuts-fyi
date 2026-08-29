import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Database } from './database.types.js';
import type { DatabaseEnv } from './env.js';

export type ServerSupabaseClient = SupabaseClient<Database>;

export function createServerSupabaseClient(
  environment: DatabaseEnv,
): ServerSupabaseClient {
  return createClient<Database>(
    environment.SUPABASE_URL,
    environment.SUPABASE_SECRET_KEY,
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
