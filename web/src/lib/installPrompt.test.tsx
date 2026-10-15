import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router';
import i18n from '@/i18n';
import AppHeader from '@/components/AppHeader';
import { captureInstallPrompt, useInstallPrompt } from './installPrompt';

beforeAll(async () => {
  await i18n.changeLanguage('en');
  captureInstallPrompt();
});
afterAll(async () => {
  await i18n.changeLanguage('ar');
});

const header = () =>
  render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter>
        <AppHeader />
      </MemoryRouter>
    </QueryClientProvider>,
  );

describe('install the app', () => {
  it('is offered in the menu only after the browser says it can be installed, and only once', async () => {
    const user = userEvent.setup();
    header();
    await user.click(screen.getAllByRole('button', { name: i18n.t('info.title') })[0]);
    expect(screen.queryByRole('button', { name: 'Install the app' })).toBeNull();

    const prompt = vi.fn(() => Promise.resolve());
    const event = Object.assign(new Event('beforeinstallprompt', { cancelable: true }), {
      prompt,
      userChoice: Promise.resolve({ outcome: 'accepted' as const }),
    });
    act(() => {
      window.dispatchEvent(event);
    });
    expect(event.defaultPrevented).toBe(true);
    await user.click(await screen.findByRole('button', { name: 'Install the app' }));
    expect(prompt).toHaveBeenCalledOnce();
    expect(useInstallPrompt.getState().prompt).toBeNull();
    expect(screen.queryByRole('button', { name: 'Install the app' })).toBeNull();
  });
});
