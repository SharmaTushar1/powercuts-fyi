import { describe, expect, it } from 'vitest';
import { mapIncidentDatabaseError, parseIncidentMutationResult } from './incidents';

const databaseResult = {
  id: '123e4567-e89b-42d3-a456-426614174000',
  slug: 'pc-123e4567e89b42d3a456426614174000',
  normalized_state: 'maharashtra',
  normalized_city: 'pune',
  normalized_locality: 'shivaji nagar',
  normalized_sector: null,
  state_label: 'Maharashtra',
  city_label: 'Pune',
  locality_label: 'Shivaji Nagar',
  sector_label: null,
  pincode: '411005',
  latitude: 18.5308,
  longitude: 73.8475,
  outage_type: 'unexpected',
  consensus_status: 'ongoing',
  participant_count: 2,
  out_count: 2,
  back_count: 0,
  out_percentage: 100,
  back_percentage: 0,
  created_at: '2026-08-28T10:00:00.000Z',
  updated_at: '2026-08-28T10:01:00.000Z',
  last_activity_at: '2026-08-28T10:01:00.000Z',
  inactive_at: null,
  was_created: true,
};

describe('incident database result mapping', () => {
  it('validates and shapes a mutation result for the API', () => {
    expect(parseIncidentMutationResult(databaseResult)).toEqual({
      incident: {
        id: '123e4567-e89b-42d3-a456-426614174000',
        slug: 'pc-123e4567e89b42d3a456426614174000',
        location: {
          normalizedState: 'maharashtra',
          normalizedCity: 'pune',
          normalizedLocality: 'shivaji nagar',
          normalizedSector: null,
          stateLabel: 'Maharashtra',
          cityLabel: 'Pune',
          localityLabel: 'Shivaji Nagar',
          sectorLabel: null,
          pincode: '411005',
          latitude: 18.5308,
          longitude: 73.8475,
        },
        outageType: 'unexpected',
        status: 'ongoing',
        consensus: {
          participantCount: 2,
          outCount: 2,
          backCount: 0,
          outPercentage: 100,
          backPercentage: 0,
        },
        createdAt: '2026-08-28T10:00:00.000Z',
        updatedAt: '2026-08-28T10:01:00.000Z',
        lastActivityAt: '2026-08-28T10:01:00.000Z',
        inactiveAt: null,
      },
      wasCreated: true,
    });
  });

  it('maps missing and inactive incidents without leaking database messages', () => {
    expect(
      mapIncidentDatabaseError({
        code: 'P0002',
        message: 'INCIDENT_NOT_FOUND',
      }),
    ).toMatchObject({
      status: 404,
      code: 'NOT_FOUND',
    });

    expect(
      mapIncidentDatabaseError({
        code: 'P0001',
        message: 'INCIDENT_INACTIVE',
      }),
    ).toMatchObject({
      status: 409,
      code: 'CONFLICT',
    });
  });
});
