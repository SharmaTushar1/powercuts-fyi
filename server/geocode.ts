import { z } from 'zod';

const geocodeQuerySchema = z
  .object({
    q: z
      .string()
      .min(2)
      .max(120)
      // Control-character rejection is intentional input sanitization.
      // eslint-disable-next-line no-control-regex -- reject ASCII control characters
      .refine((value) => !/[\u0000-\u001f\u007f]/u.test(value), {
        message: 'Query cannot contain control characters',
      })
      .transform((value) => value.normalize('NFKC').trim().replace(/\s+/gu, ' '))
      .pipe(z.string().min(2).max(120)),
    limit: z.preprocess(
      (value) => (value === undefined ? 5 : value),
      z.coerce.number().int().min(1).max(5),
    ),
  })
  .strict();

const contextEntrySchema = z
  .object({
    id: z.string().min(1),
    text: z.string().min(1),
  })
  .passthrough();

const featureSchema = z
  .object({
    id: z.string().min(1),
    place_type: z.array(z.string()).min(1),
    text: z.string().min(1),
    place_name: z.string().min(1),
    center: z.tuple([
      z.number().finite().min(-180).max(180),
      z.number().finite().min(-90).max(90),
    ]),
    context: z.array(contextEntrySchema).optional(),
  })
  .passthrough();

const responseSchema = z
  .object({
    features: z.array(z.unknown()).max(100),
  })
  .passthrough();

export class GeocodeResponseError extends Error {
  constructor() {
    super('The geocoding provider returned an invalid response');
    this.name = 'GeocodeResponseError';
  }
}

export interface GeocodeQuery {
  query: string;
  limit: number;
}

export interface GeocodeResult {
  id: string;
  label: string;
  latitude: number;
  longitude: number;
  state: string | null;
  city: string | null;
  locality: string | null;
  pincode: string | null;
}

export function parseGeocodeQuery(
  query: Record<string, string | string[] | undefined>,
): GeocodeQuery {
  const parsed = geocodeQuerySchema.parse(query);
  return {
    query: parsed.q,
    limit: parsed.limit,
  };
}

export function buildMapTilerGeocodeUrl(
  query: string,
  limit: number,
  apiKey: string,
): URL {
  const url = new URL(
    `https://api.maptiler.com/geocoding/${encodeURIComponent(query)}.json`,
  );
  url.searchParams.set('key', apiKey);
  url.searchParams.set('limit', String(limit));
  url.searchParams.set('country', 'in');
  url.searchParams.set('language', 'en');
  url.searchParams.set('autocomplete', 'false');
  return url;
}

function getComponent(
  feature: z.infer<typeof featureSchema>,
  componentTypes: readonly string[],
): string | null {
  const featureType = feature.place_type.find((type) => componentTypes.includes(type));
  if (featureType) {
    return feature.text;
  }

  const context = feature.context ?? [];
  return (
    context.find((entry) =>
      componentTypes.some((type) => entry.id === type || entry.id.startsWith(`${type}.`)),
    )?.text ?? null
  );
}

function getPincode(feature: z.infer<typeof featureSchema>): string | null {
  const value = getComponent(feature, ['postcode']);
  return value?.match(/\b\d{6}\b/u)?.[0] ?? null;
}

export function shapeGeocodeResults(payload: unknown, limit: number): GeocodeResult[] {
  const parsed = responseSchema.safeParse(payload);
  if (!parsed.success) {
    throw new GeocodeResponseError();
  }

  const results: GeocodeResult[] = [];
  for (const rawFeature of parsed.data.features) {
    const feature = featureSchema.safeParse(rawFeature);
    if (!feature.success) {
      continue;
    }

    const [longitude, latitude] = feature.data.center;
    results.push({
      id: feature.data.id,
      label: feature.data.place_name,
      latitude,
      longitude,
      state: getComponent(feature.data, ['region', 'state']),
      city: getComponent(feature.data, ['place', 'municipality', 'city']),
      locality: getComponent(feature.data, [
        'locality',
        'neighborhood',
        'neighbourhood',
        'district',
      ]),
      pincode: getPincode(feature.data),
    });

    if (results.length >= limit) {
      break;
    }
  }

  return results;
}
