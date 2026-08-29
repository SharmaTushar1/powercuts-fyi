import { describe, expect, it } from 'vitest';
import {
  parseGeocodeEnv,
  parseMaintenanceEnv,
  parseMutationEnv,
  ServerEnvironmentError,
} from '../../server/env';

const databaseEnvironment = {
  SUPABASE_URL: 'https://example.supabase.co',
  SUPABASE_SERVICE_ROLE_KEY: 'service-role-key-for-tests',
};

const mutationEnvironment = {
  ...databaseEnvironment,
  TURNSTILE_SECRET_KEY: 'turnstile-secret',
  PARTICIPANT_HMAC_SECRET: 'hmac-secret-with-at-least-32-characters',
  PARTICIPANT_TOKEN_SECRET: 'token-secret-with-at-least-32-characters',
  TURNSTILE_ALLOWED_HOSTNAMES: 'powercuts.fyi, www.powercuts.fyi',
};

describe('server environment validation', () => {
  it('lets geocoding start with only its MapTiler key', () => {
    expect(parseGeocodeEnv({ MAPTILER_API_KEY: 'maptiler-key' })).toEqual({
      MAPTILER_API_KEY: 'maptiler-key',
    });
  });

  it('lets mutation routes start without a MapTiler key', () => {
    expect(parseMutationEnv(mutationEnvironment)).toEqual({
      ...mutationEnvironment,
      TURNSTILE_ALLOWED_HOSTNAMES: ['powercuts.fyi', 'www.powercuts.fyi'],
    });
  });

  it('lets maintenance start without Turnstile or MapTiler configuration', () => {
    expect(
      parseMaintenanceEnv({
        ...databaseEnvironment,
        CRON_SECRET: 'cron-secret-with-at-least-32-characters',
      }),
    ).toEqual({
      ...databaseEnvironment,
      CRON_SECRET: 'cron-secret-with-at-least-32-characters',
    });
  });

  it('does not accept Vite-prefixed service credentials as substitutes', () => {
    expect(ServerEnvironmentError).toBeDefined();

    let error: unknown;
    try {
      parseMutationEnv({
        ...mutationEnvironment,
        SUPABASE_SERVICE_ROLE_KEY: undefined,
        VITE_SUPABASE_SERVICE_ROLE_KEY: 'must-not-be-used',
      });
    } catch (caught) {
      error = caught;
    }

    expect(error).toBeInstanceOf(ServerEnvironmentError);
  });
});
