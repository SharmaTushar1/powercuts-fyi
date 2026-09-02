import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { localizedPath } from '../i18n/paths';
import './InfoPage.css';

export function NotFoundPage() {
  const { t, i18n } = useTranslation();
  const language = i18n.language === 'hi' ? 'hi' : 'en';

  return (
    <div className="info-page container-pad">
      <div className="section-label">{t('notFound.label')}</div>
      <h1>{t('notFound.title')}</h1>
      <p>{t('notFound.body')}</p>
      <Link to={localizedPath('/', language)} className="btn btn-secondary">
        {t('common.backHome')}
      </Link>
    </div>
  );
}
