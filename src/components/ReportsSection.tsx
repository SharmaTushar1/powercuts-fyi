import { lazy, Suspense, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import type { Incident, NearbyIncident } from '../types';
import { orderIncidentsByProximity } from '../lib/nearbyFeed';
import { ReportCard } from './ReportCard';
import './ReportsSection.css';

const IncidentMap = lazy(async () => {
  const module = await import('./IncidentMap');
  return { default: module.IncidentMap };
});

type Tab = 'feed' | 'map';
type TypeFilter = 'all' | 'unexpected' | 'planned';

export function ReportsSection({
  incidents,
  nearby,
  pendingIds,
  onConfirm,
  onRequestResolve,
  onSelectIncident,
  selectedId,
  mapCenter,
}: {
  incidents: Incident[];
  nearby: NearbyIncident[];
  pendingIds: Readonly<Record<string, string>>;
  onConfirm: (incident: Incident) => void;
  onRequestResolve: (incident: Incident) => void;
  onSelectIncident?: (incident: Incident) => void;
  selectedId?: string | null;
  mapCenter?: { latitude: number; longitude: number } | null;
}) {
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const tab: Tab = location.hash === '#map' ? 'map' : 'feed';
  const state = searchParams.get('state') ?? 'all';
  const city = searchParams.get('city') ?? 'all';
  const locality = searchParams.get('locality') ?? 'all';
  const sector = searchParams.get('sector') ?? 'all';
  const typeParam = searchParams.get('type');
  const typeFilter: TypeFilter =
    typeParam === 'unexpected' || typeParam === 'planned' ? typeParam : 'all';
  const [dismissedDuplicate, setDismissedDuplicate] = useState(false);
  const orderedIncidents = useMemo(
    () => orderIncidentsByProximity(incidents, nearby),
    [incidents, nearby],
  );

  const setFilter = (key: string, value: string, resetKeys: string[] = []): void => {
    const next = new URLSearchParams(searchParams);
    if (value === 'all') {
      next.delete(key);
    } else {
      next.set(key, value);
    }
    for (const resetKey of resetKeys) {
      next.delete(resetKey);
    }
    void navigate(
      {
        pathname: '/',
        search: next.toString(),
        hash: location.hash.slice(1),
      },
      { replace: true },
    );
  };

  const states = useMemo(
    () => Array.from(new Set(orderedIncidents.map((incident) => incident.location.state))).sort(),
    [orderedIncidents],
  );
  const cities = useMemo(
    () =>
      Array.from(
        new Set(
          orderedIncidents
            .filter((incident) => state === 'all' || incident.location.state === state)
            .map((incident) => incident.location.city),
        ),
      ).sort(),
    [orderedIncidents, state],
  );
  const localities = useMemo(
    () =>
      Array.from(
        new Set(
          orderedIncidents
            .filter(
              (incident) =>
                (state === 'all' || incident.location.state === state) &&
                (city === 'all' || incident.location.city === city),
            )
            .map((incident) => incident.location.locality),
        ),
      ).sort(),
    [city, orderedIncidents, state],
  );
  const sectors = useMemo(
    () =>
      Array.from(
        new Set(
          orderedIncidents
            .filter(
              (incident) =>
                (state === 'all' || incident.location.state === state) &&
                (city === 'all' || incident.location.city === city) &&
                (locality === 'all' || incident.location.locality === locality) &&
                incident.location.sector,
            )
            .map((incident) => incident.location.sector as string),
        ),
      ).sort(),
    [city, locality, orderedIncidents, state],
  );

  const filtered = useMemo(
    () =>
      orderedIncidents.filter((incident) => {
        if (state !== 'all' && incident.location.state !== state) return false;
        if (city !== 'all' && incident.location.city !== city) return false;
        if (locality !== 'all' && incident.location.locality !== locality) return false;
        if (sector !== 'all' && (incident.location.sector ?? '') !== sector) return false;
        if (typeFilter !== 'all' && incident.outageType !== typeFilter) return false;
        return true;
      }),
    [city, locality, orderedIncidents, sector, state, typeFilter],
  );

  const duplicateCandidate =
    !dismissedDuplicate &&
    nearby.find((item) => item.incident.status === 'ongoing' && item.distanceKm <= 0.4);

  return (
    <section className="reports-section container-pad" id="feed">
      <div className="reports-header">
        <div>
          <div className="section-label">02 — LIVE FEED</div>
          <div className="reports-heading">
            {nearby.length > 0 ? 'Near you, then nationwide' : 'Most recent first'}
          </div>
        </div>
        <div className="reports-tabs mono" id="map">
          <button
            type="button"
            className={tab === 'feed' ? 'reports-tab active' : 'reports-tab'}
            onClick={() => {
              void navigate({ pathname: '/', search: location.search, hash: 'feed' });
            }}
          >
            FEED
          </button>
          <button
            type="button"
            className={tab === 'map' ? 'reports-tab active' : 'reports-tab'}
            onClick={() => {
              void navigate({ pathname: '/', search: location.search, hash: 'map' });
            }}
          >
            MAP
          </button>
        </div>
      </div>

      <div className="reports-filters mono">
        <label className="visually-hidden" htmlFor="filter-state">
          State
        </label>
        <select
          id="filter-state"
          className="pill"
          value={state}
          onChange={(event) => {
            setFilter('state', event.target.value, ['city', 'locality', 'sector']);
          }}
        >
          <option value="all">All India ▾</option>
          {states.map((value) => (
            <option key={value} value={value}>
              {value}
            </option>
          ))}
        </select>
        <label className="visually-hidden" htmlFor="filter-city">
          City
        </label>
        <select
          id="filter-city"
          className="pill"
          value={city}
          onChange={(event) => {
            setFilter('city', event.target.value, ['locality', 'sector']);
          }}
          disabled={state === 'all'}
        >
          <option value="all">All cities ▾</option>
          {cities.map((value) => (
            <option key={value} value={value}>
              {value}
            </option>
          ))}
        </select>
        <label className="visually-hidden" htmlFor="filter-locality">
          Locality
        </label>
        <select
          id="filter-locality"
          className="pill"
          value={locality}
          onChange={(event) => setFilter('locality', event.target.value, ['sector'])}
          disabled={city === 'all'}
        >
          <option value="all">All localities ▾</option>
          {localities.map((value) => (
            <option key={value} value={value}>
              {value}
            </option>
          ))}
        </select>
        <label className="visually-hidden" htmlFor="filter-sector">
          Sector
        </label>
        <select
          id="filter-sector"
          className="pill"
          value={sector}
          onChange={(event) => setFilter('sector', event.target.value)}
          disabled={locality === 'all' || sectors.length === 0}
        >
          <option value="all">All sectors ▾</option>
          {sectors.map((value) => (
            <option key={value} value={value}>
              {value}
            </option>
          ))}
        </select>
        <label className="visually-hidden" htmlFor="filter-type">
          Cut type
        </label>
        <select
          id="filter-type"
          className="pill"
          value={typeFilter}
          onChange={(event) => setFilter('type', event.target.value)}
        >
          <option value="all">Planned + Unexpected ▾</option>
          <option value="unexpected">Unexpected only</option>
          <option value="planned">Planned only</option>
        </select>
      </div>

      {tab === 'feed' ? (
        <div className="reports-list">
          {duplicateCandidate && (
            <div className="duplicate-card">
              <div>
                Someone reported an outage{' '}
                <strong>
                  {Math.round(duplicateCandidate.distanceKm * 1000)}m away
                </strong>
                . Same cut?
              </div>
              <div className="duplicate-actions">
                <button
                  type="button"
                  className="btn btn-primary btn-sm mono"
                  onClick={() => {
                    onConfirm(duplicateCandidate.incident);
                    setDismissedDuplicate(true);
                  }}
                >
                  Yes, confirm it
                </button>
                <Link to="/report" className="btn btn-secondary btn-sm mono">
                  No, new report
                </Link>
              </div>
            </div>
          )}

          {filtered.length === 0 && (
            <div className="reports-empty mono">No reports match these filters.</div>
          )}

          {filtered.map((incident) => (
            <ReportCard
              key={incident.id}
              incident={incident}
              pending={Boolean(pendingIds[incident.id])}
              onConfirm={onConfirm}
              onRequestResolve={onRequestResolve}
            />
          ))}
        </div>
      ) : (
        <Suspense fallback={<div className="map-placeholder mono">Loading map…</div>}>
          <IncidentMap
            incidents={filtered}
            selectedId={selectedId}
            onSelect={onSelectIncident}
            center={mapCenter}
          />
        </Suspense>
      )}

      <div className="reports-footnote mono">
        Reports with no activity for 6 hours are marked inactive. Status follows recent community
        consensus, not the last click.
      </div>
    </section>
  );
}
