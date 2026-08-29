import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getShareEnv } from '../server/env.js';
import { sendApiError, sendMethodNotAllowed } from '../server/http.js';
import { createServerSupabaseClient } from '../server/supabase.js';
import {
  powercutPath,
  statePath,
  uniqueIndexablePaths,
  type SeoPlace,
} from '../src/lib/seo.js';

function xmlEscape(value: string): string {
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

export function createSitemapHandler() {
  return async function sitemapHandler(
    request: VercelRequest,
    response: VercelResponse,
  ): Promise<void> {
    if (request.method !== 'GET') {
      sendMethodNotAllowed(response, ['GET']);
      return;
    }

    try {
      const environment = getShareEnv();
      const origin = (environment.SITE_URL ?? 'https://powercuts.fyi').replace(
        /\/$/u,
        '',
      );
      const extra: SeoPlace[] = [];
      try {
        const client = createServerSupabaseClient(environment);
        const { data } = await client.rpc('get_public_location_aggregates', {
          p_state: null,
          p_city: null,
          p_active_only: false,
          p_since: null,
          p_limit: 500,
          p_offset: 0,
        });
        if (Array.isArray(data)) {
          for (const row of data) {
            const record = row as {
              state_label?: string;
              city_label?: string;
              locality_label?: string;
            };
            if (!record.state_label || !record.city_label) {
              continue;
            }
            extra.push({
              state: record.state_label,
              city: record.city_label,
              locality: record.locality_label ?? null,
            });
          }
        }
      } catch {
        // Seed URLs still make the sitemap useful when the database is unreachable.
      }

      const paths = new Set(uniqueIndexablePaths(extra));
      for (const place of extra) {
        paths.add(statePath(place.state));
        paths.add(powercutPath(place.city));
        if (place.locality) {
          paths.add(powercutPath(place.city, place.locality));
        }
      }

      const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${[...paths]
  .sort()
  .map(
    (path) => `  <url>
    <loc>${xmlEscape(`${origin}${path}`)}</loc>
    <changefreq>hourly</changefreq>
  </url>`,
  )
  .join('\n')}
</urlset>
`;
      response.setHeader('Content-Type', 'application/xml; charset=utf-8');
      response.setHeader(
        'Cache-Control',
        'public, s-maxage=300, stale-while-revalidate=900',
      );
      response.status(200).send(body);
    } catch (error) {
      sendApiError(response, error);
    }
  };
}

export default createSitemapHandler();
