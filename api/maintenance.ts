import { timingSafeEqual } from 'node:crypto';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { z } from 'zod';
import type { MaintenanceEnv } from './_lib/env';
import { getMaintenanceEnv } from './_lib/env';
import { ApiError, sendApiError, sendData, sendMethodNotAllowed } from './_lib/http';
import {
  createServerSupabaseClient,
  type ServerSupabaseClient,
} from './_lib/supabase';

const affectedRowsSchema = z.number().int().nonnegative();

function parseAffectedRows(value: unknown): number {
  const parsed = affectedRowsSchema.safeParse(value);
  if (!parsed.success) {
    throw new ApiError(
      503,
      'SERVICE_UNAVAILABLE',
      'Maintenance is temporarily unavailable',
      { cause: parsed.error },
    );
  }
  return parsed.data;
}

export interface MaintenanceHandlerDependencies {
  getEnv: () => MaintenanceEnv;
  createClient: (environment: MaintenanceEnv) => ServerSupabaseClient;
}

const defaultDependencies: MaintenanceHandlerDependencies = {
  getEnv: getMaintenanceEnv,
  createClient: createServerSupabaseClient,
};

function hasValidCronAuthorization(
  authorization: string | string[] | undefined,
  secret: string,
): boolean {
  const value = Array.isArray(authorization) ? authorization[0] : authorization;
  if (!value?.startsWith('Bearer ')) {
    return false;
  }

  const received = Buffer.from(value.slice('Bearer '.length), 'utf8');
  const expected = Buffer.from(secret, 'utf8');
  return received.length === expected.length && timingSafeEqual(received, expected);
}

export function createMaintenanceHandler(
  dependencies: MaintenanceHandlerDependencies = defaultDependencies,
) {
  return async function maintenanceHandler(
    request: VercelRequest,
    response: VercelResponse,
  ): Promise<void> {
    if (request.method !== 'GET') {
      sendMethodNotAllowed(response, ['GET']);
      return;
    }

    response.setHeader('Cache-Control', 'no-store');

    try {
      const environment = dependencies.getEnv();
      if (
        !hasValidCronAuthorization(
          request.headers.authorization,
          environment.CRON_SECRET,
        )
      ) {
        throw new ApiError(401, 'UNAUTHORIZED', 'Unauthorized');
      }

      const client = dependencies.createClient(environment);
      const inactiveResult = await client.rpc('mark_inactive_incidents', {});
      if (inactiveResult.error) {
        throw new ApiError(
          503,
          'SERVICE_UNAVAILABLE',
          'Maintenance is temporarily unavailable',
          { cause: inactiveResult.error },
        );
      }

      const pruneResult = await client.rpc('prune_rate_limit_records', {});
      if (pruneResult.error) {
        throw new ApiError(
          503,
          'SERVICE_UNAVAILABLE',
          'Maintenance is temporarily unavailable',
          { cause: pruneResult.error },
        );
      }

      const inactiveIncidents = parseAffectedRows(inactiveResult.data);
      const prunedRateLimitRecords = parseAffectedRows(pruneResult.data);
      sendData(response, 200, {
        inactiveIncidents,
        prunedRateLimitRecords,
      });
    } catch (error) {
      sendApiError(response, error);
    }
  };
}

export default createMaintenanceHandler();
