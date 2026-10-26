import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';

document.documentElement.dataset.theme = localStorage.getItem('sonora-theme') || 'dark';

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', event => {
    event.preventDefault();
    window.sonoraInstallPrompt = event;
    window.dispatchEvent(new Event('sonora-install-availability'));
  });
  window.addEventListener('appinstalled', () => {
    window.sonoraAppInstalled = true;
    window.sonoraInstallPrompt = null;
    window.dispatchEvent(new Event('sonora-install-availability'));
  });

  if ('serviceWorker' in navigator) {
    if (process.env.NODE_ENV === 'production') {
      window.addEventListener('load', () => navigator.serviceWorker.register('/service-worker.js').catch(error => {
        console.error('Sonora could not register its offline app support.', error);
      }));
    } else {
      const serviceWorkerUrl = new URL('/service-worker.js', window.location.origin).href;
      navigator.serviceWorker.getRegistrations()
        .then(registrations => Promise.all(registrations
          .filter(registration => [registration.active, registration.installing, registration.waiting]
            .some(worker => worker?.scriptURL === serviceWorkerUrl))
          .map(registration => registration.unregister())))
        .catch(error => console.error('Sonora could not clear its development app cache.', error));
    }
  }
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
