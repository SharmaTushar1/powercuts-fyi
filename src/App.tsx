import { Route, Routes } from 'react-router-dom';
import { SiteHeader } from './components/SiteHeader';
import { SiteFooter } from './components/SiteFooter';
import { HomePage } from './pages/HomePage';
import { ReportPage } from './pages/ReportPage';
import { PermalinkPage } from './pages/PermalinkPage';
import { VisionPage } from './pages/VisionPage';
import { SupportPage } from './pages/SupportPage';
import { NotFoundPage } from './pages/NotFoundPage';

function App() {
  return (
    <div className="page">
      <a className="skip-link" href="#feed">
        Skip to reports
      </a>
      <SiteHeader />
      <main id="main">
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/report" element={<ReportPage />} />
          <Route path="/r/:slug" element={<PermalinkPage />} />
          <Route path="/vision" element={<VisionPage />} />
          <Route path="/support" element={<SupportPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </main>
      <SiteFooter />
    </div>
  );
}

export default App;
