const CRAWLER_PATTERN =
  /facebookexternalhit|Facebot|Twitterbot|WhatsApp|Slackbot|TelegramBot|LinkedInBot|Discordbot|Pinterest|Googlebot/iu;

export default async function middleware(request: Request): Promise<Response | undefined> {
  const url = new URL(request.url);
  const match = url.pathname.match(/^\/r\/(pc-[a-f0-9]{32})$/u);
  const userAgent = request.headers.get('user-agent') ?? '';
  if (!match || !CRAWLER_PATTERN.test(userAgent)) {
    return undefined;
  }

  const slug = match[1];
  return fetch(new URL(`/api/share/${slug}`, url.origin), {
    headers: {
      Accept: 'text/html',
    },
  });
}

export const config = {
  matcher: '/r/:slug*',
};
