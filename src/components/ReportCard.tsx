import { Link } from 'react-router-dom';
import type { Incident } from '../types';
import { useElapsed } from '../hooks/useElapsed';
import { StatusBadge } from './StatusBadge';
import { consensusSummary, locationTitle } from '../lib/incidentCopy';

export function ReportCard({
  incident,
  onConfirm,
  onRequestResolve,
  pending,
}: {
  incident: Incident;
  onConfirm: (incident: Incident) => void;
  onRequestResolve: (incident: Incident) => void;
  pending?: boolean;
}) {
  const elapsed = useElapsed(
    incident.createdAt,
    incident.inactiveAt ?? undefined,
  );
  const resolved = incident.status === 'resolved';

  return (
    <article className={`report-card${resolved ? ' report-card-resolved' : ''}`}>
      <Link to={`/r/${incident.slug}`} className="report-card-main">
        <StatusBadge type={incident.outageType} status={incident.status} />
        <div>
          <div className="report-card-title">{locationTitle(incident)}</div>
          <div className="report-card-meta mono">
            {resolved ? 'Lasted' : 'Ongoing —'} {elapsed} · {consensusSummary(incident)}
          </div>
          <div className="consensus-bar" aria-hidden="true">
            <span
              className="consensus-bar-out"
              style={{ width: `${incident.consensus.outPercentage}%` }}
            />
          </div>
        </div>
      </Link>
      {!resolved && (
        <div className="report-card-actions">
          <button
            type="button"
            className="btn btn-secondary btn-sm mono"
            disabled={pending}
            onClick={() => onConfirm(incident)}
          >
            ▲ Still out?
          </button>
          <button
            type="button"
            className="report-card-resolve-link mono"
            disabled={pending}
            onClick={() => onRequestResolve(incident)}
          >
            Power&rsquo;s back
          </button>
        </div>
      )}
    </article>
  );
}
