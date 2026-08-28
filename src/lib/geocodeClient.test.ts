import { describe, expect, it, vi } from 'vitest';
import { searchPlaces } from './geocodeClient';

describe('geocode client', () => {
  it('asks the protected geocode proxy and returns shaped places', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          data: {
            results: [
              {
                id: 'place.1',
                label: 'HSR Layout, Bengaluru, Karnataka',
                latitude: 12.9121,
                longitude: 77.6446,
                state: 'Karnataka',
                city: 'Bengaluru',
                locality: 'HSR Layout',
                pincode: '560102',
              },
            ],
          },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    );

    await expect(searchPlaces('HSR', fetchMock as unknown as typeof fetch)).resolves.toEqual([
      {
        id: 'place.1',
        label: 'HSR Layout, Bengaluru, Karnataka',
        latitude: 12.9121,
        longitude: 77.6446,
        state: 'Karnataka',
        city: 'Bengaluru',
        locality: 'HSR Layout',
        pincode: '560102',
      },
    ]);
    expect(fetchMock).toHaveBeenCalledWith('/api/geocode?q=HSR&limit=5', {
      headers: { Accept: 'application/json' },
    });
  });

  it('does not call the proxy for queries shorter than two characters', async () => {
    const fetchMock = vi.fn();
    await expect(searchPlaces('H', fetchMock as unknown as typeof fetch)).resolves.toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
