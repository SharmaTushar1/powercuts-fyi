import { describe, expect, it, vi } from 'vitest';

vi.mock('./env', () => ({
  getBrowserEnv: () => ({
    supabaseUrl: 'https://example.supabase.co',
    supabasePublishableKey: 'public-publishable-key-for-tests',
    mapTilerKey: null,
    turnstileSiteKey: null,
    siteUrl: 'https://powercuts.fyi',
  }),
}));

import { getSiteOrigin, incidentPermalink } from './site';

describe('site origin helpers', () => {
  it('builds permalinks from the configured public origin', () => {
    expect(getSiteOrigin()).toBe('https://powercuts.fyi');
    expect(incidentPermalink('pc-123e4567e89b42d3a456426614174000')).toBe(
      'https://powercuts.fyi/r/pc-123e4567e89b42d3a456426614174000',
    );
  });
});
