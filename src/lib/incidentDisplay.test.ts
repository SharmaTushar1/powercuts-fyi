import { describe, expect, it } from 'vitest';
import { formatConsensusSummary, locationTitle } from './incidentDisplay';
import type { Incident } from '../types';

const incident: Incident = {
  id: '123e4567-e89b-42d3-a456-426614174000',
  slug: 'pc-123e4567e89b42d3a456426614174000',
  location: {
    normalizedState: 'karnataka',
    normalizedCity: 'bengaluru',
    normalizedLocality: 'hsr layout',
    normalizedSector: 'sector 2',
    state: 'Karnataka',
    city: 'Bengaluru',
    locality: 'HSR Layout',
    sector: 'Sector 2',
    pincode: '560102',
    latitude: 12.9121,
    longitude: 77.6446,
  },
  outageType: 'unexpected',
  status: 'ongoing',
  consensus: {
    participantCount: 4,
    outCount: 3,
    backCount: 1,
    outPercentage: 75,
    backPercentage: 25,
  },
  createdAt: '2026-08-28T10:00:00.000Z',
  updatedAt: '2026-08-28T10:05:00.000Z',
  lastActivityAt: '2026-08-28T10:05:00.000Z',
  inactiveAt: null,
};

describe('incident display copy', () => {
  it('shows locality, optional sector, and consensus percentages', () => {
    expect(locationTitle(incident)).toBe('HSR Layout · Sector 2');
    expect(formatConsensusSummary(incident)).toBe(
      '4 recent reports · 75% power out · 25% power back',
    );
  });
});
