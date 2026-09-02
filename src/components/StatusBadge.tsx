import { useTranslation } from 'react-i18next';
import type { CutType, CutStatus } from '../types';

export function StatusBadge({ type, status }: { type: CutType; status: CutStatus }) {
  const { t } = useTranslation();

  if (status === 'resolved') {
    return <span className="badge badge-resolved">{t('badge.resolved')}</span>;
  }
  return (
    <span className={type === 'unexpected' ? 'badge badge-unexpected' : 'badge badge-planned'}>
      {type === 'unexpected' ? t('badge.unexpected') : t('badge.planned')}
    </span>
  );
}
