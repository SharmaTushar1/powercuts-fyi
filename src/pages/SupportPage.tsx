import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { KOFI_URL } from '../lib/site';
import { localizedPath } from '../i18n/paths';
import './InfoPage.css';

export function SupportPage() {
  const { t, i18n } = useTranslation();
  const language = i18n.language === 'hi' ? 'hi' : 'en';

  return (
    <div className="info-page container-pad">
      <div className="section-label">{t('support.label')}</div>
      <h1>{t('support.title')}</h1>
      <p>{t('support.p1')}</p>
      <p>{t('support.p2')}</p>
      <a
        className="btn btn-primary"
        href={KOFI_URL}
        target="_blank"
        rel="noreferrer"
        style={{ display: 'inline-block', marginBottom: 28 }}
      >
        {t('support.cta')}
      </a>
      <Link to={localizedPath('/', language)} className="btn btn-secondary">
        {t('common.backHome')}
      </Link>
    </div>
  );
}
