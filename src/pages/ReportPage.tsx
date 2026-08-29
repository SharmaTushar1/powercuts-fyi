import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useReports } from '../context/ReportsContext';
import { searchPlaces, type PlaceSuggestion } from '../lib/geocodeClient';
import { incidentPermalink } from '../lib/site';
import { isTurnstileConfigured, requestTurnstileToken } from '../lib/turnstile';
import type { CutType } from '../types';
import './ReportPage.css';

interface DetectedLocation {
  locality: string;
  city: string;
  state: string;
  sector: string;
  pincode: string;
  latitude: number;
  longitude: number;
  source: 'geolocation' | 'search' | 'manual';
}

export function ReportPage() {
  const { createOrJoinIncident, fetchNearbyIncidents } = useReports();
  const [location, setLocation] = useState<DetectedLocation | null>(null);
  const [locationStatus, setLocationStatus] = useState<
    'idle' | 'locating' | 'denied' | 'ready' | 'searching'
  >(() =>
    typeof navigator !== 'undefined' && navigator.geolocation
      ? 'locating'
      : 'denied',
  );
  const [search, setSearch] = useState('');
  const [suggestions, setSuggestions] = useState<PlaceSuggestion[]>([]);
  const [editing, setEditing] = useState(false);
  const [type, setType] = useState<CutType>('unexpected');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [posted, setPosted] = useState<{ slug: string; joined: boolean } | null>(
    null,
  );
  const [nearbySlug, setNearbySlug] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const verificationReady = isTurnstileConfigured();

  useEffect(() => {
    if (!navigator.geolocation) {
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        void (async () => {
          try {
            const results = await searchPlaces(
              `${position.coords.longitude},${position.coords.latitude}`,
            );
            const match = results[0];
            setLocation({
              locality: match?.locality ?? 'Current location',
              city: match?.city ?? 'Unknown city',
              state: match?.state ?? 'Unknown state',
              sector: '',
              pincode: match?.pincode ?? '',
              latitude: position.coords.latitude,
              longitude: position.coords.longitude,
              source: 'geolocation',
            });
            setLocationStatus('ready');
          } catch {
            setLocation({
              locality: 'Current location',
              city: 'Unknown city',
              state: 'Unknown state',
              sector: '',
              pincode: '',
              latitude: position.coords.latitude,
              longitude: position.coords.longitude,
              source: 'geolocation',
            });
            setLocationStatus('ready');
          }
        })();
      },
      () => {
        setLocationStatus('denied');
      },
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 300000 },
    );
  }, []);

  const nearbyLatitude = location?.latitude;
  const nearbyLongitude = location?.longitude;

  useEffect(() => {
    if (nearbyLatitude === undefined || nearbyLongitude === undefined) {
      return;
    }
    let cancelled = false;
    void fetchNearbyIncidents({
      latitude: nearbyLatitude,
      longitude: nearbyLongitude,
      radiusKm: 0.4,
      limit: 1,
    })
      .then((nearby) => {
        if (!cancelled) {
          setNearbySlug(nearby[0]?.incident.slug ?? null);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setNearbySlug(null);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [fetchNearbyIncidents, nearbyLatitude, nearbyLongitude]);

  useEffect(() => {
    const trimmed = search.trim();
    if (trimmed.length < 2) {
      return;
    }
    const handle = window.setTimeout(() => {
      setLocationStatus((current) =>
        current === 'ready' ? current : 'searching',
      );
      void searchPlaces(search)
        .then((results) => setSuggestions(results))
        .catch(() => setSuggestions([]));
    }, 250);
    return () => window.clearTimeout(handle);
  }, [search]);

  const canSubmit = useMemo(() => {
    if (!location || submitting || !verificationReady) {
      return false;
    }
    return (
      location.locality.trim().length > 0 &&
      location.city.trim().length > 0 &&
      location.state.trim().length > 0
    );
  }, [location, submitting, verificationReady]);

  const applySuggestion = (place: PlaceSuggestion): void => {
    setLocation({
      locality: place.locality ?? place.label,
      city: place.city ?? 'Unknown city',
      state: place.state ?? 'Unknown state',
      sector: '',
      pincode: place.pincode ?? '',
      latitude: place.latitude,
      longitude: place.longitude,
      source: 'search',
    });
    setSearch(place.label);
    setSuggestions([]);
    setEditing(false);
    setLocationStatus('ready');
  };

  const handleSubmit = async (): Promise<void> => {
    if (!location) {
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const turnstileToken = await requestTurnstileToken('report-incident');
      const result = await createOrJoinIncident({
        turnstileToken,
        state: location.state,
        city: location.city,
        locality: location.locality,
        ...(location.sector.trim() ? { sector: location.sector.trim() } : {}),
        ...(location.pincode.trim() ? { pincode: location.pincode.trim() } : {}),
        latitude: location.latitude,
        longitude: location.longitude,
        outageType: type,
      });
      setPosted({ slug: result.incident.slug, joined: !result.wasCreated });
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : 'Unable to post this report right now.',
      );
    } finally {
      setSubmitting(false);
    }
  };

  const shareUrl = posted ? incidentPermalink(posted.slug) : '';

  if (posted && location) {
    return (
      <div className="report-page-wrap">
        <div className="report-frame report-success">
          <div className="report-success-check">✓</div>
          <div className="report-success-title">
            {posted.joined ? 'Added to the local report.' : 'Reported. Thanks for the heads up.'}
          </div>
          <div className="report-success-sub mono">
            It&apos;s live in the {location.locality} feed now.
          </div>
          {error && (
            <div className="report-error" role="alert">
              {error}
            </div>
          )}
          <div className="report-success-actions">
            <a
              className="share-circle mono"
              href={`https://wa.me/?text=${encodeURIComponent(`Power cut reported in ${location.locality}, ${location.city} — ${shareUrl}`)}`}
              target="_blank"
              rel="noreferrer"
            >
              WA
            </a>
            <a
              className="share-circle mono"
              href={`https://x.com/intent/tweet?text=${encodeURIComponent(`Power cut in ${location.locality}, ${location.city}`)}&url=${encodeURIComponent(shareUrl)}`}
              target="_blank"
              rel="noreferrer"
            >
              X
            </a>
            <button
              type="button"
              className="share-circle mono"
              aria-label="Copy report link"
              onClick={() => {
                void (async () => {
                  if (!navigator.clipboard) {
                    setError('Unable to copy the link from this browser.');
                    return;
                  }
                  try {
                    await navigator.clipboard.writeText(shareUrl);
                    setError(null);
                    setCopied(true);
                    window.setTimeout(() => setCopied(false), 1500);
                  } catch {
                    setError('Unable to copy the link. Try sharing another way.');
                  }
                })();
              }}
            >
              {copied ? '✓' : '🔗'}
            </button>
          </div>
          <Link to={`/r/${posted.slug}`} className="btn btn-primary" style={{ marginTop: 24 }}>
            View report →
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="report-page-wrap">
      <div className="report-frame">
        <div className="report-title">Where&apos;s the cut?</div>

        <div className="report-field">
          <label className="report-field-label mono" htmlFor="location-search">
            LOCATION
          </label>
          {location && !editing ? (
            <div className="report-detected-row">
              <span className="report-detected-text">
                {location.locality}, {location.city}
              </span>
              <button
                type="button"
                className="report-edit-link mono"
                onClick={() => setEditing(true)}
              >
                edit ✎
              </button>
            </div>
          ) : (
            <>
              <input
                id="location-search"
                className="report-pincode"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search locality, city, or pincode"
                autoComplete="off"
              />
              {search.trim().length >= 2 && suggestions.length > 0 && (
                <ul className="place-suggestions">
                  {suggestions.map((place) => (
                    <li key={place.id}>
                      <button type="button" onClick={() => applySuggestion(place)}>
                        {place.label}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
          <div className="report-help mono">
            {locationStatus === 'locating' && 'Detecting your location…'}
            {locationStatus === 'denied' &&
              'Location permission is off. Search by locality or pincode instead.'}
            {location?.source === 'geolocation' && 'Detected from this browser.'}
          </div>
        </div>

        {location && (
          <>
            <div className="report-field">
              <label className="report-field-label mono" htmlFor="sector">
                SECTOR / SUB-AREA (OPTIONAL)
              </label>
              <input
                id="sector"
                className="report-pincode"
                value={location.sector}
                onChange={(event) =>
                  setLocation({ ...location, sector: event.target.value, source: 'manual' })
                }
                placeholder="Sector 2, Block A…"
              />
            </div>
            <div className="report-field">
              <label className="report-field-label mono" htmlFor="pincode">
                PINCODE
              </label>
              <input
                id="pincode"
                className="report-pincode"
                value={location.pincode}
                onChange={(event) =>
                  setLocation({ ...location, pincode: event.target.value, source: 'manual' })
                }
                inputMode="numeric"
              />
            </div>
          </>
        )}

        <div className="report-field">
          <div className="report-field-label mono" id="cut-type-label">
            WHAT KIND OF CUT
          </div>
          <div className="type-toggle" role="group" aria-labelledby="cut-type-label">
            <button
              type="button"
              className={type === 'unexpected' ? 'type-toggle-btn active' : 'type-toggle-btn'}
              onClick={() => setType('unexpected')}
            >
              Unexpected
            </button>
            <button
              type="button"
              className={type === 'planned' ? 'type-toggle-btn active' : 'type-toggle-btn'}
              onClick={() => setType('planned')}
            >
              Planned
            </button>
          </div>
        </div>

        {location && nearbySlug && (
          <div className="report-help">
            There&apos;s already a live report nearby. Posting will add your observation to it.
          </div>
        )}
        {error && (
          <div className="report-error" role="alert">
            {error}
          </div>
        )}
        {!verificationReady && (
          <div className="report-help mono">
            Reporting is paused until verification keys are configured.
          </div>
        )}

        <div className="report-submit-row">
          <button
            type="button"
            className="btn btn-primary post-btn"
            onClick={() => {
              void handleSubmit();
            }}
            disabled={!canSubmit}
          >
            {submitting ? 'Posting…' : 'Post it'}
          </button>
        </div>
      </div>
    </div>
  );
}
