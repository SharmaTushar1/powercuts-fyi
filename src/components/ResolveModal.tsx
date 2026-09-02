import { useEffect, useId, useRef } from 'react';
import { useTranslation } from 'react-i18next';
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
  const { t } = useTranslation();
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
          {t('resolve.title', { place: locationTitle(incident) })}
        </div>
        <div className="resolve-sheet-copy mono">{t('resolve.body', { elapsed })}</div>
        <button
          type="button"
          className="btn btn-primary"
          style={{ width: '100%', marginBottom: 10 }}
          onClick={onConfirm}
        >
          {t('resolve.confirm')}
        </button>
        <button
          ref={cancelRef}
          type="button"
          className="resolve-cancel mono"
          onClick={onCancel}
        >
          {t('resolve.cancel')}
        </button>
      </div>
    </div>
  );
}
