import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { localizedPath } from '../i18n/paths';
import './HowItWorks.css';

const steps = [
  { n: '1', titleKey: 'howItWorks.step1Title', bodyKey: 'howItWorks.step1Body' },
  { n: '2', titleKey: 'howItWorks.step2Title', bodyKey: 'howItWorks.step2Body' },
  { n: '3', titleKey: 'howItWorks.step3Title', bodyKey: 'howItWorks.step3Body' },
] as const;

export function HowItWorks() {
  const { t, i18n } = useTranslation();
  const language = i18n.language === 'hi' ? 'hi' : 'en';

  return (
    <section className="how-section container-pad" id="how">
      <div className="section-label">{t('howItWorks.sectionLabel')}</div>
      <div className="how-heading">{t('howItWorks.heading')}</div>

      <div className="how-steps">
        {steps.map((s) => (
          <div className="how-step" key={s.n}>
            <div className="how-step-number mono">{s.n}</div>
            <div className="how-step-title">{t(s.titleKey)}</div>
            <div className="how-step-body">{t(s.bodyKey)}</div>
          </div>
        ))}
      </div>

      <Link to={localizedPath('/report', language)} className="btn btn-primary how-cta">
        {t('howItWorks.cta')}
      </Link>
    </section>
  );
}
