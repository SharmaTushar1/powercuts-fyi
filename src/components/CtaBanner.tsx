import { useTranslation } from 'react-i18next';

export function CtaBanner() {
  const { t } = useTranslation();

  return (
    <section className="cta-banner">
      <div>
        <div className="cta-banner-title">{t('cta.title')}</div>
        <div className="cta-banner-sub">{t('cta.sub')}</div>
      </div>
      <a href="#how" className="cta-banner-link mono">
        {t('cta.cta')}
      </a>
    </section>
  );
}
