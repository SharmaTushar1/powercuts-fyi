import { afterEach, describe, expect, it, vi } from 'vitest';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createShareHandler } from '../../../api/share/[slug]';

function createResponse() {
  const headers = new Map<string, string>();
  const response = {
    statusCode: 200,
    body: '',
    setHeader(name: string, value: string) {
      headers.set(name, value);
      return response;
    },
    status(code: number) {
      response.statusCode = code;
      return response;
    },
    send(body: string) {
      response.body = body;
      return response;
    },
    json() {
      return response;
    },
  };
  return { response: response as unknown as VercelResponse, headers, raw: response };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('share metadata endpoint', () => {
  it('returns Open Graph HTML for a public incident slug', async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: [
        {
          id: '123e4567-e89b-42d3-a456-426614174000',
          slug: 'pc-123e4567e89b42d3a456426614174000',
          normalized_state: 'karnataka',
          normalized_city: 'bengaluru',
          normalized_locality: 'hsr layout',
          normalized_sector: 'sector 2',
          state_label: 'Karnataka',
          city_label: 'Bengaluru',
          locality_label: 'HSR Layout',
          sector_label: 'Sector 2',
          pincode: '560102',
          latitude: 12.9121,
          longitude: 77.6446,
          outage_type: 'unexpected',
          consensus_status: 'ongoing',
          participant_count: 23,
          out_count: 17,
          back_count: 6,
          out_percentage: 73.91,
          back_percentage: 26.09,
          created_at: '2026-08-28T10:00:00.000Z',
          updated_at: '2026-08-28T10:05:00.000Z',
          last_activity_at: '2026-08-28T10:05:00.000Z',
          inactive_at: null,
        },
      ],
      error: null,
    });
    const handler = createShareHandler({
      getEnv: () => ({
        SUPABASE_URL: 'https://example.supabase.co',
        SUPABASE_SECRET_KEY: 'secret-key-for-tests-only',
        SITE_URL: 'https://powercuts.fyi',
      }),
      createClient: () => ({ rpc }) as never,
    });
    const { response, raw } = createResponse();

    await handler(
      {
        query: { slug: 'pc-123e4567e89b42d3a456426614174000' },
      } as unknown as VercelRequest,
      response,
    );

    expect(raw.statusCode).toBe(200);
    expect(raw.body).toContain('HSR Layout · Sector 2');
    expect(raw.body).toContain('23 recent reports');
    expect(raw.body).toContain('og:url');
  });
});
