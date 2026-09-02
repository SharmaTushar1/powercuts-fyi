import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
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
  const { t } = useTranslation();
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
              locality: match?.locality ?? t('report.currentLocation'),
              city: match?.city ?? t('report.unknownCity'),
              state: match?.state ?? t('report.unknownState'),
              sector: '',
              pincode: match?.pincode ?? '',
              latitude: position.coords.latitude,
              longitude: position.coords.longitude,
              source: 'geolocation',
            });
            setLocationStatus('ready');
          } catch {
            setLocation({
              locality: t('report.currentLocation'),
              city: t('report.unknownCity'),
              state: t('report.unknownState'),
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
  }, [t]);

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
      city: place.city ?? t('report.unknownCity'),
      state: place.state ?? t('report.unknownState'),
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
      setError(caught instanceof Error ? caught.message : t('report.unableToPost'));
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
            {posted.joined ? t('report.joinedTitle') : t('report.postedTitle')}
          </div>
          <div className="report-success-sub mono">
            {t('report.liveInFeed', { locality: location.locality })}
          </div>
          {error && (
            <div className="report-error" role="alert">
              {error}
            </div>
          )}
          <div className="report-success-actions">
            <a
              className="share-circle mono"
              href={`https://wa.me/?text=${encodeURIComponent(
                t('report.shareWhatsAppText', {
                  locality: location.locality,
                  city: location.city,
                  url: shareUrl,
                }),
              )}`}
              target="_blank"
              rel="noreferrer"
            >
              WA
            </a>
            <a
              className="share-circle mono"
              href={`https://x.com/intent/tweet?text=${encodeURIComponent(
                t('report.shareTweetText', { locality: location.locality, city: location.city }),
              )}&url=${encodeURIComponent(shareUrl)}`}
              target="_blank"
              rel="noreferrer"
            >
              X
            </a>
            <button
              type="button"
              className="share-circle mono"
              aria-label={t('report.copyLinkLabel')}
              onClick={() => {
                void (async () => {
                  if (!navigator.clipboard) {
                    setError(t('report.unableToCopy'));
                    return;
                  }
                  try {
                    await navigator.clipboard.writeText(shareUrl);
                    setError(null);
                    setCopied(true);
                    window.setTimeout(() => setCopied(false), 1500);
                  } catch {
                    setError(t('report.unableToCopyRetry'));
                  }
                })();
              }}
            >
              {copied ? '✓' : '🔗'}
            </button>
          </div>
          <Link to={`/r/${posted.slug}`} className="btn btn-primary" style={{ marginTop: 24 }}>
            {t('report.viewReport')}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="report-page-wrap">
      <div className="report-frame">
        <div className="report-title">{t('report.title')}</div>

        <div className="report-field">
          <label className="report-field-label mono" htmlFor="location-search">
            {t('report.locationLabel')}
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
                {t('report.editLink')}
              </button>
            </div>
          ) : (
            <>
              <input
                id="location-search"
                className="report-pincode"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder={t('report.searchPlaceholder')}
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
            {locationStatus === 'locating' && t('report.detectingLocation')}
            {locationStatus === 'denied' && t('report.locationDenied')}
            {location?.source === 'geolocation' && t('report.detectedFromBrowser')}
          </div>
        </div>

        {location && (
          <>
            <div className="report-field">
              <label className="report-field-label mono" htmlFor="sector">
                {t('report.sectorLabel')}
              </label>
              <input
                id="sector"
                className="report-pincode"
                value={location.sector}
                onChange={(event) =>
                  setLocation({ ...location, sector: event.target.value, source: 'manual' })
                }
                placeholder={t('report.sectorPlaceholder')}
              />
            </div>
            <div className="report-field">
              <label className="report-field-label mono" htmlFor="pincode">
                {t('report.pincodeLabel')}
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
            {t('report.cutTypeLabel')}
          </div>
          <div className="type-toggle" role="group" aria-labelledby="cut-type-label">
            <button
              type="button"
              className={type === 'unexpected' ? 'type-toggle-btn active' : 'type-toggle-btn'}
              onClick={() => setType('unexpected')}
            >
              {t('report.unexpected')}
            </button>
            <button
              type="button"
              className={type === 'planned' ? 'type-toggle-btn active' : 'type-toggle-btn'}
              onClick={() => setType('planned')}
            >
              {t('report.planned')}
            </button>
          </div>
        </div>

        {location && nearbySlug && (
          <div className="report-help">{t('report.nearbyExists')}</div>
        )}
        {error && (
          <div className="report-error" role="alert">
            {error}
          </div>
        )}
        {!verificationReady && (
          <div className="report-help mono">{t('report.verificationPaused')}</div>
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
            {submitting ? t('report.posting') : t('report.postIt')}
          </button>
        </div>
      </div>
    </div>
  );
}
