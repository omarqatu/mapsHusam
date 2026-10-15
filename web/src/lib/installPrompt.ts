import { create } from 'zustand';

/** Chrome / Edge / Samsung's "install this app" event (not in the DOM typings). Safari never fires it. */
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

interface InstallState {
  /** The browser said the app can be installed; null before that, after installing and after a refusal. */
  prompt: BeforeInstallPromptEvent | null;
}

export const useInstallPrompt = create<InstallState>(() => ({ prompt: null }));

/** Called once at start-up: the event fires early, often before any component is mounted. */
export function captureInstallPrompt() {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault(); // no mini-infobar: the app offers it in its own menu
    useInstallPrompt.setState({ prompt: e as BeforeInstallPromptEvent });
  });
  window.addEventListener('appinstalled', () => useInstallPrompt.setState({ prompt: null }));
}

/** Shows the browser's install dialog; the event can be used only once, whatever the answer. */
export async function installApp() {
  const { prompt } = useInstallPrompt.getState();
  if (!prompt) return;
  useInstallPrompt.setState({ prompt: null });
  await prompt.prompt();
  await prompt.userChoice.catch(() => undefined);
}
