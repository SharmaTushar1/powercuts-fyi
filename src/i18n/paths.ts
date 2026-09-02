import type { SupportedLanguage } from './index';
import { localizedSeoPath } from '../lib/seo';

/** Prefixes a path with /hi for Hindi, leaves it bare for English. */
export function localizedPath(path: string, language: SupportedLanguage): string {
  return localizedSeoPath(path, language);
}

/** Strips a leading /hi segment, if present, back to the bare English path. */
export function stripLanguagePrefix(pathname: string): string {
  if (pathname === '/hi') {
    return '/';
  }
  if (pathname.startsWith('/hi/')) {
    return pathname.slice(3);
  }
  return pathname;
}
