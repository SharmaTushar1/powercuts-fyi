import { z } from 'zod';

const APPROVED_PUBLIC_KEYS = new Set([
  'VITE_SUPABASE_URL',
  'VITE_SUPABASE_PUBLISHABLE_KEY',
  'VITE_MAPTILER_KEY',
  'VITE_TURNSTILE_SITE_KEY',
  'VITE_SITE_URL',
]);

const VITE_BUILTIN_KEYS = new Set([
  'BASE_URL',
  'DEV',
  'MODE',
  'PROD',
  'SSR',
]);

const httpUrlSchema = z.url().refine((value) => {
  const protocol = new URL(value).protocol;
  return protocol === 'https:' || protocol === 'http:';
});

const browserEnvironmentSchema = z.object({
  VITE_SUPABASE_URL: httpUrlSchema,
  VITE_SUPABASE_PUBLISHABLE_KEY: z.string().min(20),
  VITE_MAPTILER_KEY: z.string().trim().min(1).optional(),
  VITE_TURNSTILE_SITE_KEY: z.string().trim().min(1).optional(),
  VITE_SITE_URL: httpUrlSchema.optional(),
});

export interface BrowserEnvironment {
  supabaseUrl: string;
  supabasePublishableKey: string;
  mapTilerKey: string | null;
  turnstileSiteKey: string | null;
  siteUrl: string | null;
}

export class BrowserEnvironmentError extends Error {
  constructor(message = 'The public data service is not configured') {
    super(message);
    this.name = 'BrowserEnvironmentError';
  }
}

function assertNoUnapprovedPublicKeys(
  environment: Record<string, unknown>,
): void {
  const hasUnapprovedKey = Object.keys(environment).some((key) => {
    if (VITE_BUILTIN_KEYS.has(key) || !key.startsWith('VITE_')) {
      return false;
    }
    return !APPROVED_PUBLIC_KEYS.has(key);
  });
  if (hasUnapprovedKey) {
    throw new BrowserEnvironmentError(
      'The browser environment contains an unapproved public variable',
    );
  }
}

export function parseBrowserEnv(
  environment: Record<string, unknown>,
): BrowserEnvironment {
  assertNoUnapprovedPublicKeys(environment);

  const parsed = browserEnvironmentSchema.safeParse(environment);
  if (!parsed.success) {
    throw new BrowserEnvironmentError();
  }

  return {
    supabaseUrl: parsed.data.VITE_SUPABASE_URL,
    supabasePublishableKey: parsed.data.VITE_SUPABASE_PUBLISHABLE_KEY,
    mapTilerKey: parsed.data.VITE_MAPTILER_KEY ?? null,
    turnstileSiteKey: parsed.data.VITE_TURNSTILE_SITE_KEY ?? null,
    siteUrl: parsed.data.VITE_SITE_URL ?? null,
  };
}

export function getBrowserEnv(): BrowserEnvironment {
  return parseBrowserEnv(import.meta.env as Record<string, unknown>);
}
