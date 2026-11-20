import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { FirebaseErrorBoundary } from './components/FirebaseErrorBoundary';

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
    <FirebaseErrorBoundary>
      <App />
    </FirebaseErrorBoundary>
  </React.StrictMode>
);
