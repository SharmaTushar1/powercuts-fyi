import { describe, expect, it } from 'vitest';
import {
  displayNameFromSlug,
  homeDocumentTitle,
  localizedSeoPath,
  locationDocumentTitle,
  locationJsonLd,
  powercutHeading,
  powercutPath,
  resolveSeoPlace,
  slugifyPlace,
  uniqueIndexablePaths,
} from './seo';

describe('seo place URLs', () => {
  it('builds search-matching powercut paths', () => {
    expect(slugifyPlace('HSR Layout')).toBe('hsr-layout');
    expect(powercutPath('Bengaluru')).toBe('/powercut/bengaluru');
    expect(powercutPath('Bengaluru', 'HSR Layout')).toBe(
      '/powercut/bengaluru/hsr-layout',
    );
    expect(displayNameFromSlug('hsr-layout')).toBe('HSR Layout');
  });

  it('titles a location the way people search for it', () => {
    expect(powercutHeading('Bengaluru')).toBe('Power cut in Bengaluru');
    expect(locationDocumentTitle('Bengaluru')).toContain('Power cut in Bengaluru');
    expect(homeDocumentTitle()).toContain('power cuts in India');
  });

  it('resolves city aliases used in Google searches', () => {
    expect(resolveSeoPlace('bangalore')).toMatchObject({
      city: 'Bengaluru',
      displayName: 'Bengaluru',
      path: '/powercut/bengaluru',
      indexable: true,
    });
    expect(resolveSeoPlace('koramangala')).toMatchObject({
      city: 'Bengaluru',
      locality: 'Koramangala',
      displayName: 'Koramangala, Bengaluru',
      path: '/powercut/bengaluru/koramangala',
    });
  });

  it('includes major city URLs in the indexable sitemap set', () => {
    const paths = uniqueIndexablePaths();
    expect(paths).toContain('/powercut/bengaluru');
    expect(paths).toContain('/powercut/mumbai');
    expect(paths).toContain('/powercut/delhi');
    expect(paths).not.toContain('/powercut/bangalore');
  });

  it('prefixes Hindi SEO paths with /hi and leaves English bare', () => {
    expect(localizedSeoPath('/powercut/bengaluru', 'hi')).toBe('/hi/powercut/bengaluru');
    expect(localizedSeoPath('/', 'hi')).toBe('/hi');
    expect(localizedSeoPath('/powercut/bengaluru', 'en')).toBe('/powercut/bengaluru');
    expect(localizedSeoPath('/')).toBe('/');
  });

  it('builds Hindi JSON-LD from the locale-prefixed page URL', () => {
    const resolved = resolveSeoPlace('bengaluru');
    const hindiPlace = {
      ...resolved,
      path: localizedSeoPath(resolved.path, 'hi'),
    };
    const graph = locationJsonLd('https://powercuts.fyi', hindiPlace, 2, 'hi')[
      '@graph'
    ] as Record<string, unknown>[];
    const webPage = graph.find((node) => node['@type'] === 'WebPage');
    expect(webPage?.url).toBe('https://powercuts.fyi/hi/powercut/bengaluru');
    expect(graph[0]?.inLanguage).toBe('hi-IN');
  });
});
