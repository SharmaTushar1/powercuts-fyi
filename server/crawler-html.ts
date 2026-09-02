export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/gu, (character) => {
    switch (character) {
      case '&':
        return '&amp;';
      case '<':
        return '&lt;';
      case '>':
        return '&gt;';
      case '"':
        return '&quot;';
      default:
        return '&#39;';
    }
  });
}

export function renderCrawlerPage(options: {
  title: string;
  description: string;
  url: string;
  canonical?: string;
  index?: boolean;
  jsonLd?: unknown;
  bodyHtml: string;
  imageUrl?: string;
  lang?: string;
}): string {
  const title = escapeHtml(options.title);
  const description = escapeHtml(options.description);
  const url = escapeHtml(options.url);
  const canonical = escapeHtml(options.canonical ?? options.url);
  const lang = escapeHtml(options.lang ?? 'en');
  const robots = options.index === false ? 'noindex, follow' : 'index, follow';
  const image = escapeHtml(
    options.imageUrl ?? `${new URL(options.url).origin}/apple-touch-icon.png`,
  );
  const jsonLd = options.jsonLd
    ? `<script type="application/ld+json">${JSON.stringify(options.jsonLd).replace(/</gu, '\\u003c')}</script>`
    : '';
  return `<!doctype html>
<html lang="${lang}">
  <head>
    <meta charset="utf-8" />
    <title>${title}</title>
    <meta name="description" content="${description}" />
    <meta name="robots" content="${robots}" />
    <link rel="canonical" href="${canonical}" />
    <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
    <link rel="icon" href="/favicon.png" type="image/png" sizes="32x32" />
    <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
    <meta property="og:type" content="website" />
    <meta property="og:site_name" content="powercuts.fyi" />
    <meta property="og:title" content="${title}" />
    <meta property="og:description" content="${description}" />
    <meta property="og:url" content="${url}" />
    <meta property="og:image" content="${image}" />
    <meta name="twitter:card" content="summary" />
    <meta name="twitter:title" content="${title}" />
    <meta name="twitter:description" content="${description}" />
    ${jsonLd}
  </head>
  <body>
    ${options.bodyHtml}
  </body>
</html>`;
}
