import { afterEach, describe, expect, it, vi } from 'vitest';
import middleware from '../middleware';

const GOOGLEBOT = 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)';
const REGULAR_BROWSER =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36';

function request(path: string, userAgent: string): Request {
  return new Request(`https://powercuts.fyi${path}`, {
    headers: { 'user-agent': userAgent },
  });
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('crawler middleware', () => {
  it('passes through untouched for non-crawler user agents', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const result = await middleware(request('/powercut/jaipur', REGULAR_BROWSER));
    expect(result).toBeUndefined();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('routes crawlers on the homepage to the home SEO handler', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('ok'));
    await middleware(request('/', GOOGLEBOT));
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const calledUrl = new URL(fetchSpy.mock.calls[0]?.[0] as string);
    expect(calledUrl.pathname).toBe('/api/seo/home');
  });

  it('routes crawlers on a city page to the location SEO handler with a city param', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('ok'));
    await middleware(request('/powercut/jaipur', GOOGLEBOT));
    const calledUrl = new URL(fetchSpy.mock.calls[0]?.[0] as string);
    expect(calledUrl.pathname).toBe('/api/seo/location');
    expect(calledUrl.searchParams.get('city')).toBe('jaipur');
    expect(calledUrl.searchParams.get('locality')).toBeNull();
  });

  it('routes crawlers on a locality page to the location SEO handler with city and locality params', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('ok'));
    await middleware(request('/powercut/bengaluru/hsr-layout', GOOGLEBOT));
    const calledUrl = new URL(fetchSpy.mock.calls[0]?.[0] as string);
    expect(calledUrl.searchParams.get('city')).toBe('bengaluru');
    expect(calledUrl.searchParams.get('locality')).toBe('hsr-layout');
  });

  it('routes crawlers on a state page to the location SEO handler via the city param', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('ok'));
    await middleware(request('/in/rajasthan', GOOGLEBOT));
    const calledUrl = new URL(fetchSpy.mock.calls[0]?.[0] as string);
    expect(calledUrl.pathname).toBe('/api/seo/location');
    expect(calledUrl.searchParams.get('city')).toBe('rajasthan');
  });

  it('still routes crawlers on share links to the existing share handler', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('ok'));
    const slug = `pc-${'a'.repeat(32)}`;
    await middleware(request(`/r/${slug}`, GOOGLEBOT));
    const calledUrl = new URL(fetchSpy.mock.calls[0]?.[0] as string);
    expect(calledUrl.pathname).toBe(`/api/share/${slug}`);
  });

  it('passes through for crawlers on unmatched paths', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const result = await middleware(request('/report', GOOGLEBOT));
    expect(result).toBeUndefined();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('falls back to the app shell when an SEO fetch fails', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('upstream down'));
    await expect(middleware(request('/', GOOGLEBOT))).resolves.toBeUndefined();
    await expect(
      middleware(request('/powercut/jaipur', GOOGLEBOT)),
    ).resolves.toBeUndefined();
  });

  it('forwards the Hindi language to the home SEO handler', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('ok'));
    await middleware(request('/hi', GOOGLEBOT));
    const calledUrl = new URL(fetchSpy.mock.calls[0]?.[0] as string);
    expect(calledUrl.pathname).toBe('/api/seo/home');
    expect(calledUrl.searchParams.get('lang')).toBe('hi');
  });

  it('forwards the Hindi language and place params for /hi location pages', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('ok'));
    await middleware(request('/hi/powercut/bengaluru/hsr-layout', GOOGLEBOT));
    const calledUrl = new URL(fetchSpy.mock.calls[0]?.[0] as string);
    expect(calledUrl.pathname).toBe('/api/seo/location');
    expect(calledUrl.searchParams.get('city')).toBe('bengaluru');
    expect(calledUrl.searchParams.get('locality')).toBe('hsr-layout');
    expect(calledUrl.searchParams.get('lang')).toBe('hi');
  });

  it('omits the lang param for English routes', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('ok'));
    await middleware(request('/powercut/jaipur', GOOGLEBOT));
    const calledUrl = new URL(fetchSpy.mock.calls[0]?.[0] as string);
    expect(calledUrl.searchParams.get('lang')).toBeNull();
  });
});
