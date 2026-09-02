import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getShareEnv } from '../../server/env.js';
import { sendApiError, sendMethodNotAllowed } from '../../server/http.js';
import { renderCrawlerPage, escapeHtml } from '../../server/crawler-html.js';
import {
  INDEXABLE_PLACES,
  homeCitiesHeading,
  homeDescription,
  homeDocumentTitle,
  homeHeading,
  homeReportLinkLabel,
  localizedSeoPath,
  powercutHeading,
  powercutPath,
  websiteJsonLd,
  type SeoLanguage,
} from '../../src/lib/seo.js';

const HTML_HEADERS = {
  'Content-Type': 'text/html; charset=utf-8',
  'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=900',
};

const HTML_LANG: Record<SeoLanguage, string> = { en: 'en-IN', hi: 'hi-IN' };

export function createHomeSeoHandler(getEnv = getShareEnv) {
  return async function homeSeoHandler(
    request: VercelRequest,
    response: VercelResponse,
  ): Promise<void> {
    if (request.method !== 'GET') {
      sendMethodNotAllowed(response, ['GET']);
      return;
    }

    try {
      const environment = getEnv();
      const origin = (environment.SITE_URL ?? 'https://powercuts.fyi').replace(/\/$/u, '');
      const rawLang = Array.isArray(request.query.lang)
        ? request.query.lang[0]
        : request.query.lang;
      const language: SeoLanguage = rawLang?.trim() === 'hi' ? 'hi' : 'en';
      const url = `${origin}${localizedSeoPath('/', language)}`;
      const cities = INDEXABLE_PLACES.filter((place) => place.locality === null)
        .slice(0, 24)
        .map(
          (place) =>
            `<li><a href="${escapeHtml(origin + localizedSeoPath(powercutPath(place.city), language))}">${escapeHtml(powercutHeading(place.city, language))}</a></li>`,
        )
        .join('');
      response.setHeader('Content-Type', HTML_HEADERS['Content-Type']);
      response.setHeader('Cache-Control', HTML_HEADERS['Cache-Control']);
      response.status(200).send(
        renderCrawlerPage({
          title: homeDocumentTitle(language),
          description: homeDescription(language),
          url,
          canonical: url,
          lang: HTML_LANG[language],
          jsonLd: websiteJsonLd(origin, language),
          bodyHtml: `
    <h1>${escapeHtml(homeHeading(language))}</h1>
    <p>${escapeHtml(homeDescription(language))}</p>
    <h2>${escapeHtml(homeCitiesHeading(language))}</h2>
    <ul>${cities}</ul>
    <p><a href="${escapeHtml(origin + localizedSeoPath('/report', language))}">${escapeHtml(homeReportLinkLabel(language))}</a></p>
`,
        }),
      );
    } catch (error) {
      sendApiError(response, error);
    }
  };
}

export default createHomeSeoHandler();
