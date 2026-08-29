import { describe, expect, it } from 'vitest';
import { consensusSummary, locationTitle } from './incidentCopy';
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
    participantCount: 23,
    outCount: 17,
    backCount: 6,
    outPercentage: 73.91,
    backPercentage: 26.09,
  },
  createdAt: '2026-08-28T10:00:00.000Z',
  updatedAt: '2026-08-28T10:05:00.000Z',
  lastActivityAt: '2026-08-28T10:05:00.000Z',
  inactiveAt: null,
};

describe('incident copy', () => {
  it('includes optional sector in the locality title', () => {
    expect(locationTitle(incident)).toBe('HSR Layout · Sector 2, Bengaluru');
  });

  it('summarizes distinct recent reports as out/back percentages', () => {
    expect(consensusSummary(incident)).toBe(
      '23 recent reports · 74% power out · 26% power back',
    );
  });
});
