import type { VercelRequest, VercelResponse } from '@vercel/node';
import type { ShareEnv } from '../_lib/env';
import { getShareEnv } from '../_lib/env';
import { parseIncidentMutationResult } from '../_lib/incidents';
import { sendApiError } from '../_lib/http';
import { escapeHtml, renderCrawlerPage } from '../_lib/crawler-html';
import {
  createServerSupabaseClient,
  type ServerSupabaseClient,
} from '../_lib/supabase';

const SLUG_PATTERN = /^pc-[a-f0-9]{32}$/u;
const CRAWLER_HTML_HEADERS = {
  'Content-Type': 'text/html; charset=utf-8',
  'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300',
};

export interface ShareHandlerDependencies {
  getEnv: () => ShareEnv;
  createClient: (environment: ShareEnv) => ServerSupabaseClient;
}

const defaultDependencies: ShareHandlerDependencies = {
  getEnv: getShareEnv,
  createClient: createServerSupabaseClient,
};

export function createShareHandler(
  dependencies: ShareHandlerDependencies = defaultDependencies,
) {
  return async function shareHandler(
    request: VercelRequest,
    response: VercelResponse,
  ): Promise<void> {
    const slugValue = request.query.slug;
    const slug = Array.isArray(slugValue) ? slugValue[0] : slugValue;
    if (!slug || !SLUG_PATTERN.test(slug)) {
      response.status(404).send('Not found');
      return;
    }

    try {
      const environment = dependencies.getEnv();
      const client = dependencies.createClient(environment);
      const { data, error } = await client.rpc('get_incident_by_slug', {
        p_slug: slug,
      });
      if (error || !Array.isArray(data) || data.length === 0) {
        response.status(404).send('Not found');
        return;
      }

      const mapped = parseIncidentMutationResult(data[0]);
      const locality = mapped.incident.location.localityLabel;
      const city = mapped.incident.location.cityLabel;
      const sector = mapped.incident.location.sectorLabel;
      const area = sector ? `${locality} · ${sector}` : locality;
      const origin = environment.SITE_URL ?? 'https://powercuts.fyi';
      const url = `${origin.replace(/\/$/u, '')}/r/${slug}`;
      const participants = mapped.incident.consensus.participantCount;
      const out = Math.round(mapped.incident.consensus.outPercentage);
      const back = Math.round(mapped.incident.consensus.backPercentage);
      const title = `Power cut in ${area}, ${city} — powercuts.fyi`;
      const description = `${participants} recent reports · ${out}% power out · ${back}% power back`;
      response.setHeader('Content-Type', CRAWLER_HTML_HEADERS['Content-Type']);
      response.setHeader('Cache-Control', CRAWLER_HTML_HEADERS['Cache-Control']);
      response.status(200).send(
        renderCrawlerPage({
          title,
          description,
          url,
          bodyHtml: `<p>${escapeHtml(description)}</p><p><a href="${escapeHtml(url)}">Open report</a></p>`,
        }),
      );
    } catch (error) {
      sendApiError(response, error);
    }
  };
}

export default createShareHandler();
