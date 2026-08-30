import { Link } from 'react-router-dom';
import type { AggregateStats, LocationAggregate, NearbyLocalityStats, Report } from '../types';
import { useElapsed } from '../hooks/useElapsed';
import { StatusBadge } from './StatusBadge';
import './Hero.css';

interface HeroProps {
  latest: Report | undefined;
  stats: AggregateStats | null;
  mostAffected: LocationAggregate[];
  nearby: NearbyLocalityStats | null;
}

export function Hero({ latest, stats, mostAffected, nearby }: HeroProps) {
  const elapsed = useElapsed(latest?.reportedAt ?? new Date(0).toISOString(), latest?.resolvedAt);
  const largestAffectedCount = Math.max(
    ...mostAffected.map((location) => location.incidentCount),
    1,
  );

  return (
    <section className="hero container-pad" id="top">
      <div className="hero-live mono">
        <span className="live-dot" />
        LIVE · {stats?.incidentsLast10Minutes ?? 0} CUTS REPORTED · LAST 10 MIN ·{' '}
        {stats?.affectedStates ?? 0} STATES
      </div>

      <div className="hero-headline">
        <div className="hero-number mono">{stats?.incidentsLast10Minutes ?? 0}</div>
        <h1>power cuts reported in the last 10 minutes, across India.</h1>
      </div>

      <p className="hero-sub">
        Crowdsourced power-cut reports for your area. No signup, no app download, no calling a
        DISCOM helpline that never picks up.
      </p>

      <div className="hero-ctas">
        <Link to="/report" className="btn btn-primary">
          Report a cut →
        </Link>
        <a href="#feed" className="btn btn-secondary">
          Browse reports
        </a>
      </div>

      <div className="hero-panel">
        <div className="hero-panel-col">
          <div className="section-label">LATEST REPORT</div>
          {latest ? (
            <>
              <StatusBadge type={latest.type} status={latest.status} />
              <div className="hero-panel-title">
                {latest.locality}, {latest.city}
              </div>
              <div className="hero-panel-meta mono">
                {latest.status === 'resolved' ? 'resolved after' : 'reported'} {elapsed} ago
              </div>
            </>
          ) : (
            <div className="hero-panel-meta mono">No reports yet</div>
          )}
        </div>
        <div className="hero-panel-col">
          <div className="section-label">CUTS RIGHT NOW</div>
          <div className="hero-panel-big mono">{stats?.activeIncidents ?? 0}</div>
          <div className="hero-panel-meta mono">
            across India
            {nearby ? ` · ${nearby.activeIncidentCount} in ${nearby.locality} right now` : ''}
          </div>
        </div>
        <div className="hero-panel-col hero-panel-col-wide">
          <div className="section-label">MOST AFFECTED TODAY</div>
          <div className="affected-list">
            {mostAffected.map((location) => (
              <div
                className="affected-row"
                key={`${location.normalizedState}:${location.normalizedCity}:${location.normalizedLocality}:${location.normalizedSector ?? ''}`}
              >
                <span className="affected-label">
                  {location.locality}, {location.city}
                </span>
                <span className="affected-bar-track">
                  <span
                    className="affected-bar-fill"
                    style={{
                      width: `${Math.round((100 * location.incidentCount) / largestAffectedCount)}%`,
                    }}
                  />
                </span>
                <span className="affected-count mono">{location.incidentCount}</span>
              </div>
            ))}
            {mostAffected.length === 0 && (
              <div className="hero-panel-meta mono">No affected areas yet</div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
