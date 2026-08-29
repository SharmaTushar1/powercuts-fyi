import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getShareEnv } from '../_lib/env';
import { sendApiError, sendMethodNotAllowed } from '../_lib/http';
import { renderCrawlerPage, escapeHtml } from '../_lib/crawler-html';
import {
  INDEXABLE_PLACES,
  homeDescription,
  homeDocumentTitle,
  powercutHeading,
  powercutPath,
  websiteJsonLd,
} from '../../src/lib/seo.ts';

const HTML_HEADERS = {
  'Content-Type': 'text/html; charset=utf-8',
  'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=900',
};

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
      const cities = INDEXABLE_PLACES.filter((place) => place.locality === null)
        .slice(0, 24)
        .map(
          (place) =>
            `<li><a href="${escapeHtml(origin + powercutPath(place.city))}">${escapeHtml(powercutHeading(place.city))}</a></li>`,
        )
        .join('');
      response.setHeader('Content-Type', HTML_HEADERS['Content-Type']);
      response.setHeader('Cache-Control', HTML_HEADERS['Cache-Control']);
      response.status(200).send(
        renderCrawlerPage({
          title: homeDocumentTitle(),
          description: homeDescription(),
          url: `${origin}/`,
          jsonLd: websiteJsonLd(origin),
          bodyHtml: `
    <h1>Live power cuts in India</h1>
    <p>${escapeHtml(homeDescription())}</p>
    <h2>Power cut in your city</h2>
    <ul>${cities}</ul>
    <p><a href="${escapeHtml(origin)}/report">Report a power cut</a></p>
`,
        }),
      );
    } catch (error) {
      sendApiError(response, error);
    }
  };
}

export default createHomeSeoHandler();
