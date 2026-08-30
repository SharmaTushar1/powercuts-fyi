import { useEffect, useState } from 'react';
import { useReports } from '../context/ReportsContext';
import { Hero } from '../components/Hero';
import { CtaBanner } from '../components/CtaBanner';
import { ReportsSection } from '../components/ReportsSection';
import { BrowseSection } from '../components/BrowseSection';
import { HowItWorks } from '../components/HowItWorks';
import { ResolveModal } from '../components/ResolveModal';
import { isTurnstileConfigured, requestTurnstileToken } from '../lib/turnstile';
import { toCompatibilityReport } from '../lib/reportsApi';
import { searchPlaces } from '../lib/geocodeClient';
import type { Incident, NearbyIncident, NearbyLocalityStats } from '../types';

const NEARBY_LOCALITY_RADIUS_KM = 2;
// Effectively "all" within the radius: MAX_NEARBY_LIMIT in reportsApi.ts is
// a generous safety ceiling, not a realistic count for a 2km radius.
const NEARBY_LOCALITY_LIMIT = 200;

export function HomePage() {
  const {
    incidents,
    aggregateStats,
    locationAggregates,
    loading,
    error,
    pending,
    submitObservation,
    fetchNearbyIncidents,
  } = useReports();
  const [resolving, setResolving] = useState<Incident | null>(null);
  const [nearby, setNearby] = useState<NearbyIncident[]>([]);
  const [nearbyLocality, setNearbyLocality] = useState<NearbyLocalityStats | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [mapCenter, setMapCenter] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);

  useEffect(() => {
    if (!navigator.geolocation) {
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        void fetchNearbyIncidents({
          latitude,
          longitude,
          radiusKm: 8,
          limit: 10,
        })
          .then(setNearby)
          .catch(() => setNearby([]));
        setMapCenter({ latitude, longitude });

        void Promise.all([
          searchPlaces(`${longitude},${latitude}`),
          fetchNearbyIncidents({
            latitude,
            longitude,
            radiusKm: NEARBY_LOCALITY_RADIUS_KM,
            limit: NEARBY_LOCALITY_LIMIT,
          }),
        ])
          .then(([places, localIncidents]) => {
            const place = places[0];
            if (!place?.city) {
              return;
            }
            setNearbyLocality({
              // Rural/highway points often have no locality-level feature,
              // only a city; fall back rather than hiding the stat entirely.
              locality: place.locality ?? place.city,
              city: place.city,
              activeIncidentCount: localIncidents.filter(
                (entry) => entry.incident.status === 'ongoing',
              ).length,
            });
          })
          .catch(() => undefined);
      },
      () => undefined,
      { timeout: 8000, maximumAge: 300000 },
    );
  }, [fetchNearbyIncidents]);

  const observe = async (incident: Incident, state: 'out' | 'back'): Promise<void> => {
    setActionError(null);
    if (!isTurnstileConfigured()) {
      setActionError('Verification is not configured, so observations are paused.');
      return;
    }
    try {
      const token = await requestTurnstileToken('record-observation');
      await submitObservation({
        incidentId: incident.id,
        state,
        turnstileToken: token,
      });
    } catch (caught) {
      setActionError(
        caught instanceof Error ? caught.message : 'Unable to record that observation.',
      );
    }
  };

  if (loading) {
    return <div className="page-loading mono">Loading reports…</div>;
  }

  return (
    <>
      {(error || actionError) && (
        <div className="page-banner" role="alert">
          {actionError ?? error?.message}
        </div>
      )}
      <Hero
        latest={incidents[0] ? toCompatibilityReport(incidents[0]) : undefined}
        stats={aggregateStats}
        mostAffected={locationAggregates.slice(0, 3)}
        nearby={nearbyLocality}
      />
      <CtaBanner />
      <ReportsSection
        incidents={incidents}
        nearby={nearby}
        pendingIds={pending.observations}
        selectedId={selectedId}
        mapCenter={mapCenter}
        onSelectIncident={(incident) => setSelectedId(incident.id)}
        onConfirm={(incident) => {
          void observe(incident, 'out');
        }}
        onRequestResolve={setResolving}
      />
      <BrowseSection aggregates={locationAggregates} />
      <HowItWorks />

      {resolving && (
        <ResolveModal
          incident={resolving}
          onCancel={() => setResolving(null)}
          onConfirm={() => {
            const target = resolving;
            setResolving(null);
            void observe(target, 'back');
          }}
        />
      )}
    </>
  );
}
