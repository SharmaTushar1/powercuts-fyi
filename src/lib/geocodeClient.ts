import { z } from 'zod';

const placeSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  latitude: z.number().finite(),
  longitude: z.number().finite(),
  state: z.string().nullable(),
  city: z.string().nullable(),
  locality: z.string().nullable(),
  pincode: z.string().nullable(),
});

const geocodeEnvelopeSchema = z.object({
  data: z.object({
    results: z.array(placeSchema),
  }),
});

export type PlaceSuggestion = z.infer<typeof placeSchema>;

export async function searchPlaces(
  query: string,
  fetcher: typeof fetch = fetch,
): Promise<PlaceSuggestion[]> {
  const trimmed = query.trim();
  if (trimmed.length < 2) {
    return [];
  }

  const params = new URLSearchParams({
    q: trimmed,
    limit: '5',
  });
  const response = await fetcher(`/api/geocode?${params.toString()}`, {
    headers: { Accept: 'application/json' },
  });
  if (!response.ok) {
    throw new Error('Location search is temporarily unavailable');
  }
  const body: unknown = await response.json();
  const parsed = geocodeEnvelopeSchema.safeParse(body);
  if (!parsed.success) {
    throw new Error('Location search returned invalid data');
  }
  return parsed.data.data.results;
}
