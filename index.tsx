import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import { FirebaseErrorBoundary } from './components/FirebaseErrorBoundary';
import { I18nProvider } from './hooks/useI18n';

// Google Maps Platform Quota Defense (Tier 1: Global Auth & Console Error Listeners)
if (typeof window !== 'undefined') {
  (window as Window & { gm_authFailure?: () => void }).gm_authFailure = () => {
    window.dispatchEvent(new CustomEvent('gmp-quota-exceeded'));
  };

  const origConsoleError = console.error;
  console.error = (...args: unknown[]) => {
    const joined = args.map((a) => String(a ?? '')).join(' ');
    if (/OverQuotaMapError|QuotaExceededError|OVER_QUERY_LIMIT|RESOURCE_EXHAUSTED/i.test(joined)) {
      window.dispatchEvent(new CustomEvent('gmp-quota-exceeded'));
    }
    origConsoleError.apply(console, args);
  };
}

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('Could not find root element to mount to');
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <I18nProvider>
      <FirebaseErrorBoundary>
        <App />
      </FirebaseErrorBoundary>
    </I18nProvider>
  </React.StrictMode>
);
