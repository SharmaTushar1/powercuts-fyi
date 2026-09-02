import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { localizedPath } from '../i18n/paths';
import './InfoPage.css';

export function VisionPage() {
  const { t, i18n } = useTranslation();
  const language = i18n.language === 'hi' ? 'hi' : 'en';

  return (
    <div className="info-page container-pad">
      <div className="section-label">{t('vision.label')}</div>
      <h1>{t('vision.title')}</h1>
      <p>{t('vision.p1')}</p>
      <p>{t('vision.p2')}</p>
      <p>{t('vision.p3')}</p>
      <Link to={localizedPath('/', language)} className="btn btn-secondary">
        {t('common.backHome')}
      </Link>
    </div>
  );
}
