import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { Analytics } from '@vercel/analytics/react';
import './i18n/index.ts';
import './index.css';
import App from './App.tsx';
import { ReportsProvider } from './context/ReportsContext.tsx';
import { ErrorBoundary } from './components/ErrorBoundary.tsx';

const root = document.getElementById('root');
if (!root) {
  throw new Error('The application root element is missing');
}

createRoot(root).render(
  <StrictMode>
    <ErrorBoundary>
      <BrowserRouter>
        <ReportsProvider>
          <App />
        </ReportsProvider>
      </BrowserRouter>
    </ErrorBoundary>
    <Analytics />
  </StrictMode>,
);
