import { z } from 'zod';

const databaseEnvSchema = z.object({
  SUPABASE_URL: z.url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(20),
});

const hostnameSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(
    /^(?:localhost|[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+)$/u,
  );

const mutationEnvSchema = databaseEnvSchema.extend({
  TURNSTILE_SECRET_KEY: z.string().min(1),
  PARTICIPANT_HMAC_SECRET: z.string().min(32),
  PARTICIPANT_TOKEN_SECRET: z.string().min(32),
  TURNSTILE_ALLOWED_HOSTNAMES: z
    .string()
    .transform((value) => value.split(',').map((hostname) => hostname.trim()))
    .pipe(z.array(hostnameSchema).min(1)),
});

const geocodeEnvSchema = z.object({
  MAPTILER_API_KEY: z.string().min(1),
});

const maintenanceEnvSchema = databaseEnvSchema.extend({
  CRON_SECRET: z.string().min(32),
});

const shareEnvSchema = databaseEnvSchema.extend({
  SITE_URL: z.url().optional(),
});

export type DatabaseEnv = z.infer<typeof databaseEnvSchema>;
export type MutationEnv = z.infer<typeof mutationEnvSchema>;
export type GeocodeEnv = z.infer<typeof geocodeEnvSchema>;
export type MaintenanceEnv = z.infer<typeof maintenanceEnvSchema>;
export type ShareEnv = z.infer<typeof shareEnvSchema>;

export class ServerEnvironmentError extends Error {
  constructor() {
    super('Server environment is not configured');
    this.name = 'ServerEnvironmentError';
  }
}

function parseEnvironment<T>(
  schema: z.ZodType<T>,
  environment: Record<string, string | undefined>,
): T {
  const parsed = schema.safeParse(environment);
  if (!parsed.success) {
    throw new ServerEnvironmentError();
  }
  return parsed.data;
}

export function parseMutationEnv(
  environment: Record<string, string | undefined>,
): MutationEnv {
  return parseEnvironment(mutationEnvSchema, environment);
}

export function parseGeocodeEnv(
  environment: Record<string, string | undefined>,
): GeocodeEnv {
  return parseEnvironment(geocodeEnvSchema, environment);
}

export function parseMaintenanceEnv(
  environment: Record<string, string | undefined>,
): MaintenanceEnv {
  return parseEnvironment(maintenanceEnvSchema, environment);
}

export function getMutationEnv(): MutationEnv {
  return parseMutationEnv(process.env);
}

export function getGeocodeEnv(): GeocodeEnv {
  return parseGeocodeEnv(process.env);
}

export function getMaintenanceEnv(): MaintenanceEnv {
  return parseMaintenanceEnv(process.env);
}

export function parseShareEnv(
  environment: Record<string, string | undefined>,
): ShareEnv {
  return parseEnvironment(shareEnvSchema, environment);
}

export function getShareEnv(): ShareEnv {
  return parseShareEnv(process.env);
}
