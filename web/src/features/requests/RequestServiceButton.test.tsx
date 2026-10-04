import { beforeEach, describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router';
import i18n from '@/i18n';
import { useAuthStore } from '@/store/authStore';
import type { AuthUser } from '@/types/auth';
import LoginPrompt from '@/features/auth/LoginPrompt';
import { useLoginPrompt } from '@/features/auth/loginPromptStore';
import RequestServiceButton from './RequestServiceButton';
import { useRequestsUi } from './store';

const target = { serviceLayer: 'plumber', featureId: '14', providerName: 'لي', serviceType: 'سباك' };

function LoginProbe() {
  const from = (useLocation().state as { from?: string } | null)?.from;
  return <div>login page, back to {from}</div>;
}

function setup() {
  render(
    <MemoryRouter initialEntries={['/?x=1']}>
      <Routes>
        <Route
          path="/"
          element={
            <>
              <RequestServiceButton target={target} />
              <LoginPrompt />
            </>
          }
        />
        <Route path="/login" element={<LoginProbe />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('RequestServiceButton', () => {
  beforeEach(() => {
    useAuthStore.setState({ user: null });
    useRequestsUi.setState({ requestFor: null });
    useLoginPrompt.setState({ reason: null });
  });

  it('offers a visitor the login sheet, whose login comes back to the map afterwards', async () => {
    setup();
    await userEvent.click(screen.getByRole('button', { name: i18n.t('popup.requestService') }));
    expect(screen.getByRole('dialog', { name: i18n.t('loginPrompt.title.request') })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: i18n.t('loginPrompt.login') }));
    expect(screen.getByText('login page, back to /?x=1')).toBeInTheDocument();
    expect(useRequestsUi.getState().requestFor).toBeNull();
  });

  it('starts the request flow for a signed-in user', async () => {
    useAuthStore.setState({ user: { user_id: 3, token: 't' } as AuthUser });
    setup();
    await userEvent.click(screen.getByRole('button', { name: i18n.t('popup.requestService') }));
    expect(useRequestsUi.getState().requestFor).toEqual(target);
  });
});
