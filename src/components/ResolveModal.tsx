import { useEffect, useId, useRef } from 'react';
import { useElapsed } from '../hooks/useElapsed';
import type { Incident } from '../types';
import { locationTitle } from '../lib/incidentCopy';

export function ResolveModal({
  incident,
  onConfirm,
  onCancel,
}: {
  incident: Incident;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const elapsed = useElapsed(incident.createdAt);
  const titleId = useId();
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    cancelRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        onCancel();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onCancel]);

  return (
    <div className="resolve-overlay" onClick={onCancel}>
      <div
        className="resolve-sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="resolve-sheet-title" id={titleId}>
          Power back in {locationTitle(incident)}?
        </div>
        <div className="resolve-sheet-copy mono">
          This records your observation. The area stays ongoing until recent reports agree
          it&apos;s back. Current timer: {elapsed}.
        </div>
        <button
          type="button"
          className="btn btn-primary"
          style={{ width: '100%', marginBottom: 10 }}
          onClick={onConfirm}
        >
          Power is back
        </button>
        <button
          ref={cancelRef}
          type="button"
          className="resolve-cancel mono"
          onClick={onCancel}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
