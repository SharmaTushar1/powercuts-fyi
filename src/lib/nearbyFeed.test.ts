import { describe, expect, it } from 'vitest';
import type { Incident, NearbyIncident } from '../types';
import { orderIncidentsByProximity } from './nearbyFeed';

function makeIncident(id: string, locality: string): Incident {
  return {
    id,
    slug: `pc-${id.replaceAll('-', '')}`,
    location: {
      normalizedState: 'karnataka',
      normalizedCity: 'bengaluru',
      normalizedLocality: locality.toLowerCase(),
      normalizedSector: null,
      state: 'Karnataka',
      city: 'Bengaluru',
      locality,
      sector: null,
      pincode: '560001',
      latitude: 12.97,
      longitude: 77.59,
    },
    outageType: 'unexpected',
    status: 'ongoing',
    consensus: {
      participantCount: 1,
      outCount: 1,
      backCount: 0,
      outPercentage: 100,
      backPercentage: 0,
    },
    createdAt: '2026-08-28T10:00:00.000Z',
    updatedAt: '2026-08-28T10:05:00.000Z',
    lastActivityAt: '2026-08-28T10:05:00.000Z',
    inactiveAt: null,
  };
}

describe('orderIncidentsByProximity', () => {
  it('keeps recency order when no nearby results exist', () => {
    const far = makeIncident('11111111-1111-4111-8111-111111111111', 'Whitefield');
    const closer = makeIncident('22222222-2222-4222-8222-222222222222', 'HSR Layout');

    expect(orderIncidentsByProximity([far, closer], [])).toEqual([far, closer]);
  });

  it('puts nearby incidents first and prefers live feed copies', () => {
    const far = makeIncident('11111111-1111-4111-8111-111111111111', 'Whitefield');
    const closer = makeIncident('22222222-2222-4222-8222-222222222222', 'HSR Layout');
    const liveCloser: Incident = {
      ...closer,
      consensus: { ...closer.consensus, participantCount: 4 },
    };
    const nearby: NearbyIncident[] = [
      { incident: closer, distanceKm: 0.3 },
    ];

    expect(orderIncidentsByProximity([far, liveCloser], nearby)).toEqual([
      liveCloser,
      far,
    ]);
  });
});
