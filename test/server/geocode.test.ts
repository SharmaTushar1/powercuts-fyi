import { describe, expect, it } from 'vitest';
import {
  buildMapTilerGeocodeUrl,
  GeocodeResponseError,
  parseGeocodeQuery,
  shapeGeocodeResults,
} from '../../server/geocode';

describe('geocoding validation and shaping', () => {
  it('validates a strict query and caps the requested result count', () => {
    expect(parseGeocodeQuery({ q: '  Shivaji   Nagar ', limit: '3' })).toEqual({
      query: 'Shivaji Nagar',
      limit: 3,
    });

    expect(() => parseGeocodeQuery({ q: 'Pune', limit: '6' })).toThrow();
    expect(() => parseGeocodeQuery({ q: 'Pune', extra: 'nope' })).toThrow();
  });

  it('encodes MapTiler request parameters without leaking them into the path', () => {
    const url = buildMapTilerGeocodeUrl('A/B & Pune', 3, 'test-api-key');

    expect(url.pathname).toBe('/geocoding/A%2FB%20%26%20Pune.json');
    expect(url.searchParams.get('limit')).toBe('3');
    expect(url.searchParams.get('country')).toBe('in');
    expect(url.searchParams.get('key')).toBe('test-api-key');
  });

  it('shapes MapTiler features into bounded locality results', () => {
    const payload = {
      features: [
        {
          id: 'locality.shivaji-nagar',
          type: 'Feature',
          place_type: ['locality'],
          text: 'Shivaji Nagar',
          place_name: 'Shivaji Nagar, Pune, Maharashtra, India',
          center: [73.8475, 18.5308],
          context: [
            { id: 'place.pune', text: 'Pune' },
            { id: 'region.maharashtra', text: 'Maharashtra' },
            { id: 'postcode.411005', text: '411005' },
          ],
        },
        {
          id: 'place.pune',
          type: 'Feature',
          place_type: ['place'],
          text: 'Pune',
          place_name: 'Pune, Maharashtra, India',
          center: [73.8567, 18.5204],
          context: [{ id: 'region.maharashtra', text: 'Maharashtra' }],
        },
      ],
    };

    expect(shapeGeocodeResults(payload, 1)).toEqual([
      {
        id: 'locality.shivaji-nagar',
        label: 'Shivaji Nagar, Pune, Maharashtra, India',
        latitude: 18.5308,
        longitude: 73.8475,
        state: 'Maharashtra',
        city: 'Pune',
        locality: 'Shivaji Nagar',
        pincode: '411005',
      },
    ]);
  });

  it('rejects malformed upstream payloads', () => {
    expect(() => shapeGeocodeResults({ features: 'invalid' }, 5)).toThrow(
      GeocodeResponseError,
    );
  });
});
