import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getShareEnv } from '../../server/env';
import { ApiError, sendApiError, sendMethodNotAllowed } from '../../server/http';
import { renderCrawlerPage, escapeHtml } from '../../server/crawler-html';
import {
  faqItems,
  locationDescription,
  locationDocumentTitle,
  locationJsonLd,
  powercutHeading,
  resolveSeoPlace,
} from '../../src/lib/seo.ts';
import {
  createServerSupabaseClient,
  type ServerSupabaseClient,
} from '../../server/supabase';

const PLACE_SLUG = /^[a-z0-9]+(?:-[a-z0-9]+){0,12}$/u;
const HTML_HEADERS = {
  'Content-Type': 'text/html; charset=utf-8',
  'Cache-Control': 'public, s-maxage=120, stale-while-revalidate=600',
};

export interface LocationSeoDependencies {
  getEnv: typeof getShareEnv;
  createClient: (environment: ReturnType<typeof getShareEnv>) => ServerSupabaseClient;
}

const defaultDependencies: LocationSeoDependencies = {
  getEnv: getShareEnv,
  createClient: createServerSupabaseClient,
};

function queryValue(value: string | string[] | undefined): string | undefined {
  const raw = Array.isArray(value) ? value[0] : value;
  return raw?.trim() ? raw.trim() : undefined;
}

async function countActiveIncidents(
  client: ServerSupabaseClient,
  city: string | null,
  locality: string | null,
  state: string | null,
): Promise<number> {
  const { data, error } = await client.rpc('get_public_incidents_filtered', {
    p_state: state,
    p_city: city,
    p_locality: locality,
    p_sector: null,
    p_outage_type: null,
    p_consensus_status: 'ongoing',
    p_active_only: true,
    p_limit: 1,
    p_offset: 0,
  });
  if (error) {
    throw new ApiError(
      503,
      'SERVICE_UNAVAILABLE',
      'Unable to load incident counts',
      { cause: error },
    );
  }
  if (!Array.isArray(data)) {
    throw new ApiError(
      503,
      'SERVICE_UNAVAILABLE',
      'The incident count query returned invalid data',
    );
  }
  if (data.length === 0) {
    return 0;
  }
  const total = (data[0] as { total_count?: number }).total_count;
  if (typeof total !== 'number') {
    throw new ApiError(
      503,
      'SERVICE_UNAVAILABLE',
      'The incident count query returned invalid data',
    );
  }
  return total;
}

export function createLocationSeoHandler(
  dependencies: LocationSeoDependencies = defaultDependencies,
) {
  return async function locationSeoHandler(
    request: VercelRequest,
    response: VercelResponse,
  ): Promise<void> {
    if (request.method !== 'GET') {
      sendMethodNotAllowed(response, ['GET']);
      return;
    }

    const citySlug = queryValue(request.query.city);
    const localitySlug = queryValue(request.query.locality);
    if (!citySlug || !PLACE_SLUG.test(citySlug) || (localitySlug && !PLACE_SLUG.test(localitySlug))) {
      response.status(404).send('Not found');
      return;
    }

    try {
      const environment = dependencies.getEnv();
      const origin = (environment.SITE_URL ?? 'https://powercuts.fyi').replace(/\/$/u, '');
      const resolved = resolveSeoPlace(citySlug, localitySlug);
      const client = dependencies.createClient(environment);
      const activeCount = await countActiveIncidents(
        client,
        resolved.city,
        resolved.locality,
        resolved.state,
      );
      const heading = powercutHeading(resolved.displayName);
      const description = locationDescription(resolved.displayName, activeCount);
      const faqs = faqItems(resolved.displayName)
        .map(
          (item) =>
            `<h2>${escapeHtml(item.question)}</h2><p>${escapeHtml(item.answer)}</p>`,
        )
        .join('');
      const url = `${origin}${resolved.path}`;
      response.setHeader('Content-Type', HTML_HEADERS['Content-Type']);
      response.setHeader('Cache-Control', HTML_HEADERS['Cache-Control']);
      response.status(200).send(
        renderCrawlerPage({
          title: locationDocumentTitle(resolved.displayName),
          description,
          url,
          canonical: `${origin}${resolved.path}`,
          index: resolved.indexable || activeCount > 0,
          jsonLd: locationJsonLd(origin, resolved, activeCount),
          bodyHtml: `
    <h1>${escapeHtml(heading)}</h1>
    <p>${escapeHtml(description)}</p>
    <p><a href="${escapeHtml(url)}">Open live reports for ${escapeHtml(resolved.displayName)}</a></p>
    ${faqs}
    <p>Also searched as power outage, electricity cut, load shedding, and no power in ${escapeHtml(resolved.displayName)}.</p>
`,
        }),
      );
    } catch (error) {
      sendApiError(response, error);
    }
  };
}

export default createLocationSeoHandler();
