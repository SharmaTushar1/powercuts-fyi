import { Route, Routes } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { SiteHeader } from './components/SiteHeader';
import { SiteFooter } from './components/SiteFooter';
import { LocaleRoot } from './components/LocaleRoot';
import { HomePage } from './pages/HomePage';
import { ReportPage } from './pages/ReportPage';
import { PermalinkPage } from './pages/PermalinkPage';
import { LocationPage } from './pages/LocationPage';
import { VisionPage } from './pages/VisionPage';
import { SupportPage } from './pages/SupportPage';
import { NotFoundPage } from './pages/NotFoundPage';

function App() {
  const { t } = useTranslation();

  return (
    <div className="page">
      <a className="skip-link" href="#main">
        {t('common.skipToReports')}
      </a>
      <SiteHeader />
      <main id="main" tabIndex={-1}>
        <Routes>
          <Route element={<LocaleRoot language="en" />}>
            <Route path="/" element={<HomePage />} />
            <Route path="/report" element={<ReportPage />} />
            <Route path="/powercut/:city" element={<LocationPage />} />
            <Route path="/powercut/:city/:locality" element={<LocationPage />} />
            <Route path="/in/:state" element={<LocationPage />} />
            <Route path="/vision" element={<VisionPage />} />
            <Route path="/support" element={<SupportPage />} />
            <Route path="/r/:slug" element={<PermalinkPage />} />
          </Route>
          <Route path="/hi" element={<LocaleRoot language="hi" />}>
            <Route index element={<HomePage />} />
            <Route path="report" element={<ReportPage />} />
            <Route path="powercut/:city" element={<LocationPage />} />
            <Route path="powercut/:city/:locality" element={<LocationPage />} />
            <Route path="in/:state" element={<LocationPage />} />
            <Route path="vision" element={<VisionPage />} />
            <Route path="support" element={<SupportPage />} />
            <Route path="r/:slug" element={<PermalinkPage />} />
            <Route path="*" element={<NotFoundPage />} />
          </Route>
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </main>
      <SiteFooter />
    </div>
  );
}

export default App;
