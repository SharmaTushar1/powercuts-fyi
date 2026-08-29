import type { VercelRequest, VercelResponse } from '@vercel/node';
import type { GeocodeEnv } from '../server/env.js';
import { getGeocodeEnv } from '../server/env.js';
import {
  buildMapTilerGeocodeUrl,
  GeocodeResponseError,
  parseGeocodeQuery,
  shapeGeocodeResults,
} from '../server/geocode.js';
import { ApiError, sendApiError, sendData, sendMethodNotAllowed } from '../server/http.js';

export interface GeocodeHandlerDependencies {
  getEnv: () => GeocodeEnv;
  fetch: typeof fetch;
}

const defaultDependencies: GeocodeHandlerDependencies = {
  getEnv: getGeocodeEnv,
  fetch,
};

export function createGeocodeHandler(
  dependencies: GeocodeHandlerDependencies = defaultDependencies,
) {
  return async function geocodeHandler(
    request: VercelRequest,
    response: VercelResponse,
  ): Promise<void> {
    if (request.method !== 'GET') {
      sendMethodNotAllowed(response, ['GET']);
      return;
    }

    try {
      const input = parseGeocodeQuery(request.query);
      const environment = dependencies.getEnv();
      const url = buildMapTilerGeocodeUrl(
        input.query,
        input.limit,
        environment.MAPTILER_API_KEY,
      );

      let upstream: Response;
      try {
        upstream = await dependencies.fetch(url, {
          method: 'GET',
          headers: {
            accept: 'application/json',
          },
          signal: AbortSignal.timeout(5_000),
        });
      } catch (error) {
        console.error('geocode: upstream fetch threw', error);
        throw new ApiError(
          502,
          'SERVICE_UNAVAILABLE',
          'Geocoding is temporarily unavailable',
          { cause: error },
        );
      }

      if (!upstream.ok) {
        const bodyText = await upstream.text().catch(() => '<unreadable body>');
        console.error(
          'geocode: upstream returned non-ok status',
          upstream.status,
          bodyText.slice(0, 500),
        );
        throw new ApiError(
          502,
          'SERVICE_UNAVAILABLE',
          'Geocoding is temporarily unavailable',
        );
      }

      let payload: unknown;
      try {
        payload = await upstream.json();
      } catch (error) {
        console.error('geocode: upstream response was not valid JSON', error);
        throw new ApiError(
          502,
          'SERVICE_UNAVAILABLE',
          'Geocoding is temporarily unavailable',
          { cause: error },
        );
      }

      let results;
      try {
        results = shapeGeocodeResults(payload, input.limit);
      } catch (error) {
        if (error instanceof GeocodeResponseError) {
          console.error(
            'geocode: upstream payload failed shape validation',
            JSON.stringify(payload).slice(0, 500),
          );
          throw new ApiError(
            502,
            'SERVICE_UNAVAILABLE',
            'Geocoding is temporarily unavailable',
            { cause: error },
          );
        }
        throw error;
      }

      response.setHeader(
        'Cache-Control',
        'public, s-maxage=300, stale-while-revalidate=600',
      );
      sendData(response, 200, { results });
    } catch (error) {
      sendApiError(response, error);
    }
  };
}

export default createGeocodeHandler();
