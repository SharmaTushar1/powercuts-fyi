import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useReports } from '../context/ReportsContext';
import { useElapsed } from '../hooks/useElapsed';
import { StatusBadge } from '../components/StatusBadge';
import { ResolveModal } from '../components/ResolveModal';
import { consensusSummary, locationTitle } from '../lib/incidentCopy';
import { incidentPermalink } from '../lib/site';
import { isTurnstileConfigured, requestTurnstileToken } from '../lib/turnstile';
import { localizedPath } from '../i18n/paths';
import type { Incident, NearbyIncident } from '../types';
import './PermalinkPage.css';

export function PermalinkPage() {
  const { t, i18n } = useTranslation();
  const language = i18n.language === 'hi' ? 'hi' : 'en';
  const home = localizedPath('/', language);
  const { slug } = useParams<{ slug: string }>();
  const { fetchIncidentBySlug, fetchNearbyIncidents, submitObservation, pending } =
    useReports();
  const [incident, setIncident] = useState<Incident | null>(null);
  const [nearby, setNearby] = useState<NearbyIncident[]>([]);
  const [loadedSlug, setLoadedSlug] = useState<string | null>(null);
  const [resolving, setResolving] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const elapsed = useElapsed(
    incident?.createdAt ?? new Date(0).toISOString(),
    incident?.inactiveAt ?? undefined,
  );

  useEffect(() => {
    if (!slug) {
      return;
    }
    let cancelled = false;
    void fetchIncidentBySlug(slug)
      .then((result) => {
        if (cancelled) {
          return;
        }
        setError(null);
        if (!result) {
          setIncident(null);
          setLoadedSlug(slug);
          setNearby([]);
          return;
        }
        setIncident(result);
        setLoadedSlug(slug);
        setNearby([]);
        void fetchNearbyIncidents({
          latitude: result.location.latitude,
          longitude: result.location.longitude,
          radiusKm: 5,
          limit: 4,
          excludeIncidentId: result.id,
        })
          .then((nearbyResult) => {
            if (!cancelled) {
              setNearby(nearbyResult);
            }
          })
          .catch(() => {
            if (!cancelled) {
              setNearby([]);
            }
          });
      })
      .catch((caught: unknown) => {
        if (!cancelled) {
          setIncident(null);
          setLoadedSlug(slug);
          setNearby([]);
          setError(caught instanceof Error ? caught.message : t('permalink.unableToLoad'));
        }
      });
    return () => {
      cancelled = true;
    };
  }, [fetchIncidentBySlug, fetchNearbyIncidents, slug, t]);

  const observe = async (state: 'out' | 'back'): Promise<void> => {
    if (!incident) {
      return;
    }
    setError(null);
    try {
      const token = await requestTurnstileToken('record-observation');
      const result = await submitObservation({
        incidentId: incident.id,
        state,
        turnstileToken: token,
      });
      setIncident(result.incident);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t('permalink.unableToRecord'));
    }
  };

  const loading = Boolean(slug) && loadedSlug !== slug;
  const missing = !slug || (loadedSlug === slug && !incident);

  if (loading) {
    return <div className="page-loading mono">Loading…</div>;
  }

  if (missing || !incident) {
    return (
      <div className="permalink-not-found container-pad">
        <div className="section-label">{t('permalink.notFoundLabel')}</div>
        <p>{error ?? t('permalink.notFoundBody')}</p>
        <Link to={home} className="btn btn-secondary">
          {t('permalink.backToFeed')}
        </Link>
      </div>
    );
  }

  const shareUrl = incidentPermalink(incident.slug);
  const reportedAtLabel = new Date(incident.createdAt).toLocaleTimeString('en-IN', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });

  return (
    <div className="permalink-page container-pad">
      <Link to={home} className="back-link mono">
        {t('permalink.backToFeed')}
      </Link>

      <div className="permalink-grid">
        <div>
          <StatusBadge type={incident.outageType} status={incident.status} />
          <h1 className="permalink-title">{locationTitle(incident)}</h1>
          <div className="permalink-meta mono">
            {t('permalink.reportedAt', { time: reportedAtLabel, state: incident.location.state })}
          </div>
          <div className="permalink-timer mono">{elapsed}</div>
          <div className="permalink-timer-sub">{consensusSummary(incident, t)}</div>
          {error && (
            <div className="report-error" role="alert">
              {error}
            </div>
          )}

          {incident.status === 'ongoing' && (
            <div className="permalink-actions">
              <button
                type="button"
                className="btn btn-secondary mono"
                disabled={Boolean(pending.observations[incident.id]) || !isTurnstileConfigured()}
                onClick={() => {
                  void observe('out');
                }}
              >
                {t('permalink.stillOutConfirm')}
              </button>
              <button
                type="button"
                className="permalink-resolve-link mono"
                disabled={Boolean(pending.observations[incident.id]) || !isTurnstileConfigured()}
                onClick={() => setResolving(true)}
              >
                {t('permalink.powersBack')}
              </button>
            </div>
          )}
        </div>

        <div>
          <div className="section-label">{t('permalink.howShared')}</div>
          <div className="share-preview">
            <div className="share-preview-image" />
            <div className="share-preview-body">
              <div className="share-preview-title">
                powercuts.fyi — {locationTitle(incident)}
              </div>
              <div className="share-preview-sub">{consensusSummary(incident, t)}</div>
              <div className="share-preview-url mono">{new URL(shareUrl).host}</div>
            </div>
          </div>

          <button
            type="button"
            className="btn btn-primary"
            style={{ marginTop: 16, width: '100%' }}
            onClick={() => {
              void (async () => {
                const copyLink = async () => {
                  if (!navigator.clipboard) {
                    return;
                  }
                  try {
                    await navigator.clipboard.writeText(shareUrl);
                    setCopied(true);
                    window.setTimeout(() => setCopied(false), 1500);
                  } catch {
                    // Clipboard unavailable or denied.
                  }
                };

                if (navigator.share) {
                  try {
                    await navigator.share({
                      title: t('permalink.shareTitle', { place: locationTitle(incident) }),
                      url: shareUrl,
                    });
                    return;
                  } catch (caught) {
                    if (caught instanceof Error && caught.name === 'AbortError') {
                      return;
                    }
                  }
                }

                await copyLink();
              })();
            }}
          >
            {copied ? t('permalink.copied') : t('permalink.share')}
          </button>

          {nearby.length > 0 && (
            <>
              <div className="nearby-label mono">{t('permalink.nearbyReports')}</div>
              {nearby.map((item) => (
                <Link to={`/r/${item.incident.slug}`} className="nearby-row" key={item.incident.id}>
                  <span>{locationTitle(item.incident)}</span>
                  <span className="nearby-distance">{item.distanceKm.toFixed(1)}km</span>
                </Link>
              ))}
            </>
          )}
        </div>
      </div>

      {resolving && (
        <ResolveModal
          incident={incident}
          onCancel={() => setResolving(false)}
          onConfirm={() => {
            setResolving(false);
            void observe('back');
          }}
        />
      )}
    </div>
  );
}
