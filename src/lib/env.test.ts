import { describe, expect, it } from 'vitest';
import { BrowserEnvironmentError, parseBrowserEnv } from './env';

describe('browser environment validation', () => {
  it('maps every approved public browser variable', () => {
    expect(
      parseBrowserEnv({
        MODE: 'production',
        DEV: false,
        PROD: true,
        SSR: false,
        BASE_URL: '/',
        VITE_SUPABASE_URL: 'https://example.supabase.co',
        VITE_SUPABASE_ANON_KEY: 'public-anonymous-key-for-tests',
        VITE_MAPTILER_KEY: 'maptiler-public-key',
        VITE_TURNSTILE_SITE_KEY: 'turnstile-public-site-key',
        VITE_SITE_URL: 'https://powercuts.fyi',
      }),
    ).toEqual({
      supabaseUrl: 'https://example.supabase.co',
      supabaseAnonKey: 'public-anonymous-key-for-tests',
      mapTilerKey: 'maptiler-public-key',
      turnstileSiteKey: 'turnstile-public-site-key',
      siteUrl: 'https://powercuts.fyi',
    });
  });

  it('rejects browser-prefixed variables outside the public allowlist', () => {
    expect(() =>
      parseBrowserEnv({
        VITE_SUPABASE_URL: 'https://example.supabase.co',
        VITE_SUPABASE_ANON_KEY: 'public-anonymous-key-for-tests',
        VITE_SUPABASE_SERVICE_ROLE_KEY: 'service-role-key-must-not-be-used',
      }),
    ).toThrow(BrowserEnvironmentError);
  });

  it('fails clearly when required public credentials are missing', () => {
    expect(() => parseBrowserEnv({ MODE: 'test' })).toThrow(
      BrowserEnvironmentError,
    );
    expect(() => parseBrowserEnv({ MODE: 'production' })).toThrow(
      BrowserEnvironmentError,
    );
  });
});
