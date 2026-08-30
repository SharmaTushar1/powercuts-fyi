const CRAWLER_PATTERN =
  /facebookexternalhit|Facebot|Twitterbot|WhatsApp|Slackbot|TelegramBot|LinkedInBot|Discordbot|Pinterest|Googlebot/iu;

const SHARE_PATTERN = /^\/r\/(pc-[a-f0-9]{32})$/u;
const LOCATION_PATTERN =
  /^\/(?:powercut\/([a-z0-9-]+)(?:\/([a-z0-9-]+))?|in\/([a-z0-9-]+))$/u;

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

  if (url.pathname === '/') {
    return fetch(new URL('/api/seo/home', url.origin), {
      headers: { Accept: 'text/html' },
    });
  }

  const locationMatch = url.pathname.match(LOCATION_PATTERN);
  if (locationMatch) {
    const [, city, locality, state] = locationMatch;
    const seoUrl = new URL('/api/seo/location', url.origin);
    seoUrl.searchParams.set('city', city ?? state ?? '');
    if (locality) {
      seoUrl.searchParams.set('locality', locality);
    }
    return fetch(seoUrl, { headers: { Accept: 'text/html' } });
  }

  return undefined;
}

export const config = {
  matcher: ['/', '/r/:slug*', '/powercut/:path*', '/in/:path*'],
};
