const CRAWLER_PATTERN =
  /facebookexternalhit|Facebot|Twitterbot|WhatsApp|Slackbot|TelegramBot|LinkedInBot|Discordbot|Pinterest|Googlebot/iu;

const SHARE_PATTERN = /^\/r\/(pc-[a-f0-9]{32})$/u;
const LOCATION_PATTERN =
  /^\/(?:powercut\/([a-z0-9-]+)(?:\/([a-z0-9-]+))?|in\/([a-z0-9-]+))$/u;

const SEO_FETCH_TIMEOUT_MS = 2500;

/**
 * A slow or failing SEO renderer must not hold up the request: fall through to
 * the client-rendered app shell instead of stalling the crawler.
 */
async function fetchSeoHtml(target: URL): Promise<Response | undefined> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), SEO_FETCH_TIMEOUT_MS);
  try {
    return await fetch(target, {
      headers: { Accept: 'text/html' },
      signal: controller.signal,
    });
  } catch {
    return undefined;
  } finally {
    clearTimeout(timeout);
  }
}

export default async function middleware(request: Request): Promise<Response | undefined> {
  const url = new URL(request.url);
  const userAgent = request.headers.get('user-agent') ?? '';
  if (!CRAWLER_PATTERN.test(userAgent)) {
    return undefined;
  }

  const shareMatch = url.pathname.match(SHARE_PATTERN);
  if (shareMatch) {
    return fetch(new URL(`/api/share/${shareMatch[1]}`, url.origin), {
      headers: { Accept: 'text/html' },
    });
  }

  const isHindi = url.pathname === '/hi' || url.pathname.startsWith('/hi/');
  const barePath = isHindi ? url.pathname.slice(3) || '/' : url.pathname;

  if (barePath === '/') {
    const seoUrl = new URL('/api/seo/home', url.origin);
    if (isHindi) {
      seoUrl.searchParams.set('lang', 'hi');
    }
    return fetchSeoHtml(seoUrl);
  }

  const locationMatch = barePath.match(LOCATION_PATTERN);
  if (locationMatch) {
    const [, city, locality, state] = locationMatch;
    const seoUrl = new URL('/api/seo/location', url.origin);
    seoUrl.searchParams.set('city', city ?? state ?? '');
    if (locality) {
      seoUrl.searchParams.set('locality', locality);
    }
    if (isHindi) {
      seoUrl.searchParams.set('lang', 'hi');
    }
    return fetchSeoHtml(seoUrl);
  }

  return undefined;
}

export const config = {
  matcher: [
    '/',
    '/r/:slug*',
    '/powercut/:path*',
    '/in/:path*',
    '/hi',
    '/hi/:path*',
  ],
};
