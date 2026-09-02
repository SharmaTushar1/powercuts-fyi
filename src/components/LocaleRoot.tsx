import { useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { SupportedLanguage } from '../i18n';

export function LocaleRoot({ language }: { language: SupportedLanguage }) {
  const { i18n } = useTranslation();

  useEffect(() => {
    if (i18n.language !== language) {
      void i18n.changeLanguage(language);
    }
  }, [language, i18n]);

  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);

  return <Outlet />;
}
