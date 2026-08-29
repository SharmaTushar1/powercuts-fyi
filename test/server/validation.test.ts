import { describe, expect, it } from 'vitest';
import {
  incidentRequestSchema,
  normalizeLocationComponent,
  observationRequestSchema,
} from '../../server/validation';

const validIncidentPayload = {
  turnstileToken: 'turnstile-token',
  state: '  Maharashtra ',
  city: ' Pune ',
  locality: '  Shivaji   Nagar ',
  sector: ' Sector  5 ',
  pincode: '411005',
  latitude: 18.5308,
  longitude: 73.8475,
  outageType: 'unexpected',
};

describe('location and request validation', () => {
  it('normalizes Unicode and repeated whitespace for locality keys', () => {
    expect(normalizeLocationComponent('  NEW   ＤＥＬＨＩ  ')).toBe('new delhi');
  });

  it('parses an incident request into normalized keys and display labels', () => {
    const result = incidentRequestSchema.parse(validIncidentPayload);

    expect(result).toMatchObject({
      normalizedState: 'maharashtra',
      normalizedCity: 'pune',
      normalizedLocality: 'shivaji nagar',
      normalizedSector: 'sector 5',
      stateLabel: 'Maharashtra',
      cityLabel: 'Pune',
      localityLabel: 'Shivaji Nagar',
      sectorLabel: 'Sector 5',
      pincode: '411005',
      outageType: 'unexpected',
    });
  });

  it('rejects unknown incident fields and invalid coordinates', () => {
    expect(() =>
      incidentRequestSchema.parse({
        ...validIncidentPayload,
        latitude: 91,
        unexpectedField: true,
      }),
    ).toThrow();
  });

  it('rejects a client-controlled browser identity field', () => {
    expect(() =>
      incidentRequestSchema.parse({
        ...validIncidentPayload,
        browserId: 'browser_A1b2C3d4E5f6',
      }),
    ).toThrow();
  });

  it('rejects invalid observation identifiers and states', () => {
    expect(() =>
      observationRequestSchema.parse({
        turnstileToken: 'token',
        incidentId: 'not-a-uuid',
        state: 'maybe',
      }),
    ).toThrow();
  });
});
