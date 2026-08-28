import { getBrowserEnv } from './env';

export function getSiteOrigin(): string {
  try {
    const configured = getBrowserEnv().siteUrl;
    if (configured) {
      return new URL(configured).origin;
    }
  } catch {
    // Fall through to the current origin when public env is incomplete.
  }

  if (typeof window !== 'undefined' && window.location.origin) {
    return window.location.origin;
  }

  return 'https://powercuts.fyi';
}

export function incidentPermalink(slug: string, origin = getSiteOrigin()): string {
  return `${origin}/r/${slug}`;
}
