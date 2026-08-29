import { z } from 'zod';

// Control-character rejection is intentional input sanitization.
// eslint-disable-next-line no-control-regex -- reject ASCII control characters
const CONTROL_CHARACTER_PATTERN = /[\u0000-\u001f\u007f]/u;

function normalizeWhitespace(value: string): string {
  return value.normalize('NFKC').trim().replace(/\s+/gu, ' ');
}

export function normalizeLocationComponent(value: string): string {
  return normalizeWhitespace(value).toLocaleLowerCase('en-IN');
}

const displayLabelSchema = z
  .string()
  .min(1)
  .max(120)
  .refine((value) => !CONTROL_CHARACTER_PATTERN.test(value), {
    message: 'Location labels cannot contain control characters',
  })
  .transform(normalizeWhitespace)
  .pipe(z.string().min(1).max(100));

const optionalDisplayLabelSchema = z.preprocess(
  (value) => {
    if (typeof value !== 'string') {
      return value;
    }

    const normalized = normalizeWhitespace(value);
    return normalized.length === 0 ? undefined : normalized;
  },
  displayLabelSchema.optional(),
);

const optionalPincodeSchema = z.preprocess(
  (value) => (value === '' ? undefined : value),
  z.string().regex(/^\d{6}$/u, 'Pincode must contain exactly six digits').optional(),
);

export const turnstileTokenSchema = z.string().min(1).max(2048);

const rawIncidentRequestSchema = z
  .object({
    turnstileToken: turnstileTokenSchema,
    state: displayLabelSchema,
    city: displayLabelSchema,
    locality: displayLabelSchema,
    sector: optionalDisplayLabelSchema,
    pincode: optionalPincodeSchema,
    latitude: z.number().finite().min(-90).max(90),
    longitude: z.number().finite().min(-180).max(180),
    outageType: z.enum(['planned', 'unexpected']),
  })
  .strict();

export const incidentRequestSchema = rawIncidentRequestSchema.transform((value) => ({
  turnstileToken: value.turnstileToken,
  normalizedState: normalizeLocationComponent(value.state),
  normalizedCity: normalizeLocationComponent(value.city),
  normalizedLocality: normalizeLocationComponent(value.locality),
  normalizedSector: value.sector ? normalizeLocationComponent(value.sector) : null,
  stateLabel: value.state,
  cityLabel: value.city,
  localityLabel: value.locality,
  sectorLabel: value.sector ?? null,
  pincode: value.pincode ?? null,
  latitude: value.latitude,
  longitude: value.longitude,
  outageType: value.outageType,
}));

export const observationRequestSchema = z
  .object({
    turnstileToken: turnstileTokenSchema,
    incidentId: z.uuid(),
    state: z.enum(['out', 'back']),
  })
  .strict();

export type IncidentRequest = z.infer<typeof incidentRequestSchema>;
export type ObservationRequest = z.infer<typeof observationRequestSchema>;
