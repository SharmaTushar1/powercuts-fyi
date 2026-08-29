import { useEffect } from 'react';
import { getSiteOrigin } from '../lib/site';

interface PageMeta {
  title: string;
  description: string;
  path: string;
  index?: boolean;
  jsonLd?: Record<string, unknown> | Record<string, unknown>[];
}

function upsertMeta(selector: string, attributes: Record<string, string>): void {
  let element = document.head.querySelector(selector);
  if (!element) {
    const tagName = selector.startsWith('meta') ? 'meta' : 'link';
    element = document.createElement(tagName);
    document.head.appendChild(element);
  }
  for (const [name, value] of Object.entries(attributes)) {
    element.setAttribute(name, value);
  }
}

export function usePageMeta(meta: PageMeta): void {
  const jsonLdSerialized = meta.jsonLd ? JSON.stringify(meta.jsonLd) : '';

  useEffect(() => {
    const origin = getSiteOrigin();
    const url = `${origin}${meta.path === '/' ? '/' : meta.path}`;
    const robots = meta.index === false ? 'noindex, follow' : 'index, follow';
    document.title = meta.title;
    upsertMeta('meta[name="description"]', {
      name: 'description',
      content: meta.description,
    });
    upsertMeta('meta[name="robots"]', { name: 'robots', content: robots });
    upsertMeta('link[rel="canonical"]', { rel: 'canonical', href: url });
    upsertMeta('meta[property="og:title"]', {
      property: 'og:title',
      content: meta.title,
    });
    upsertMeta('meta[property="og:description"]', {
      property: 'og:description',
      content: meta.description,
    });
    upsertMeta('meta[property="og:url"]', { property: 'og:url', content: url });
    upsertMeta('meta[property="og:type"]', {
      property: 'og:type',
      content: 'website',
    });
    upsertMeta('meta[property="og:site_name"]', {
      property: 'og:site_name',
      content: 'powercuts.fyi',
    });
    upsertMeta('meta[property="og:image"]', {
      property: 'og:image',
      content: `${origin}/apple-touch-icon.png`,
    });
    upsertMeta('meta[name="twitter:card"]', {
      name: 'twitter:card',
      content: 'summary',
    });
    upsertMeta('meta[name="twitter:title"]', {
      name: 'twitter:title',
      content: meta.title,
    });
    upsertMeta('meta[name="twitter:description"]', {
      name: 'twitter:description',
      content: meta.description,
    });

    const existing = document.getElementById('seo-jsonld');
    if (!jsonLdSerialized) {
      existing?.remove();
      return;
    }
    const script =
      existing instanceof HTMLScriptElement
        ? existing
        : document.createElement('script');
    script.id = 'seo-jsonld';
    script.type = 'application/ld+json';
    script.textContent = jsonLdSerialized;
    if (!existing) {
      document.head.appendChild(script);
    }
  }, [
    jsonLdSerialized,
    meta.description,
    meta.index,
    meta.path,
    meta.title,
  ]);
}
