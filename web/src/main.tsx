import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './i18n';
import './index.css';
import App from './App';
import { queryClient } from './api/queryClient';
import { captureInstallPrompt } from './lib/installPrompt';
import { registerServiceWorker } from './lib/pwa';
import { useAuthStore } from './store/authStore';
import { resetRequestsUi } from './features/requests/store';

// Every change of viewer (log in, log out — manual, 401, force_relogin — or another account) starts from an empty
// cache: the server shapes its answers by viewer (phones hidden from visitors, withdrawn listings for admins), and the
// previous user's open chat must not carry over. Logging in also ends the "browse as guest" choice.
useAuthStore.subscribe((state, prev) => {
  if (prev.user?.user_id === state.user?.user_id) return;
  queryClient.clear();
  resetRequestsUi();
  if (state.user) {
    try {
      localStorage.removeItem('guest_mode');
    } catch {
      /* storage blocked: nothing was stored either */
    }
  }
});

registerServiceWorker();
captureInstallPrompt();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
