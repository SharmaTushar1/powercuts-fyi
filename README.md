# powercuts.fyi

Crowdsourced, anonymous power-cut reports across India. No signup, no app download.

## Stack

- Vite + React + TypeScript frontend on Vercel
- Supabase Postgres for incidents, observations, consensus, and public reads
- Vercel functions for writes, geocoding, maintenance, and social share metadata
- MapLibre + MapTiler for maps and place search
- Cloudflare Turnstile for anonymous write verification

## Local development

```bash
npm install
cp .env.example .env
# Fill in Supabase, MapTiler, and Turnstile values
npm run dev
```

API routes are served by Vercel. In another terminal:

```bash
npx vercel dev --listen 3000
```

Vite proxies `/api` to `http://127.0.0.1:3000`.

## Database

Apply migrations from `supabase/migrations/` to your Supabase project. Enable Realtime for `public.incidents`. Schedule `/api/maintenance` is already declared in `vercel.json` once daily (02:00 UTC); set `CRON_SECRET` to Vercel’s cron secret.

Optional database tests:

```bash
npx supabase start
npm run test:db
```

## Environment

Public `VITE_*` keys are the only values the browser may see. Service role, Turnstile secret, HMAC secrets, cron secret, and MapTiler server key stay server-side. Restrict the MapTiler key to your production domain.

Turnstile widget actions must be:

- `report-incident` for `POST /api/incidents`
- `record-observation` for `POST /api/observations`

`TURNSTILE_ALLOWED_HOSTNAMES` is a comma-separated list, for example `localhost,powercuts.fyi`.

## Scripts

```bash
npm test          # credential-free unit tests
npm run test:unit
npm run test:e2e  # Playwright smoke tests (dummy public env)
npm run test:db
npm run build
npm run lint
```

## Product rules

- One active incident per normalized state/city/locality/optional sector
- Visitors record `out` / `back` observations; displayed status is the 60-minute latest-per-browser consensus
- Cards show distinct recent reports plus out/back percentages
- Incidents inactive for at least 24 hours are resolved during daily cleanup; permalinks remain
- Accounts, payments, admin UI, and Hindi localization are out of scope
