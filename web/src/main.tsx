import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './i18n';
import './index.css';
import App from './App';
import { queryClient } from './api/queryClient';
import { registerServiceWorker } from './lib/pwa';
import { useAuthStore } from './store/authStore';

// Logging out (manual, 401, force_relogin) must not leave the previous user's data in the cache.
useAuthStore.subscribe((state, prev) => {
  if (prev.user && !state.user) queryClient.clear();
});

registerServiceWorker();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
