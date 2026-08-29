import type { VercelRequest, VercelResponse } from '@vercel/node';
import { describe, expect, it, vi } from 'vitest';
import { createGeocodeHandler } from '../../api/geocode';

const environment = {
  MAPTILER_API_KEY: 'maptiler-key',
};

function createResponse() {
  const response = {
    status: vi.fn(),
    json: vi.fn(),
    setHeader: vi.fn(),
  };
  response.status.mockReturnValue(response);
  response.json.mockReturnValue(response);
  return response;
}

describe('GET /api/geocode', () => {
  it('returns a bounded, shaped MapTiler response', async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({
          features: [
            {
              id: 'locality.shivaji-nagar',
              place_type: ['locality'],
              text: 'Shivaji Nagar',
              place_name: 'Shivaji Nagar, Pune, Maharashtra, India',
              center: [73.8475, 18.5308],
              context: [
                { id: 'place.pune', text: 'Pune' },
                { id: 'region.maharashtra', text: 'Maharashtra' },
              ],
            },
          ],
        }),
        { headers: { 'content-type': 'application/json' } },
      ),
    );
    const handler = createGeocodeHandler({
      getEnv: () => environment,
      fetch: fetchImpl,
    });
    const request = {
      method: 'GET',
      query: { q: 'Shivaji Nagar', limit: '1' },
    } as unknown as VercelRequest;
    const response = createResponse();

    await handler(request, response as unknown as VercelResponse);

    expect(fetchImpl).toHaveBeenCalledOnce();
    expect(response.status).toHaveBeenCalledWith(200);
    expect(response.json).toHaveBeenCalledWith({
      data: {
        results: [
          expect.objectContaining({
            locality: 'Shivaji Nagar',
            city: 'Pune',
            state: 'Maharashtra',
          }),
        ],
      },
    });
  });

  it('rejects invalid queries before contacting MapTiler', async () => {
    const fetchImpl = vi.fn<typeof fetch>();
    const handler = createGeocodeHandler({
      getEnv: () => environment,
      fetch: fetchImpl,
    });
    const request = {
      method: 'GET',
      query: { q: 'x', limit: '100' },
    } as unknown as VercelRequest;
    const response = createResponse();

    await handler(request, response as unknown as VercelResponse);

    expect(fetchImpl).not.toHaveBeenCalled();
    expect(response.status).toHaveBeenCalledWith(400);
  });
});
