import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it, vi } from 'vitest';
import '@/i18n';
import type { AppNotification } from '@/api/notifications';
import { useRequestsUi } from '@/features/requests/store';
import NotificationsPage from './NotificationsPage';

const rows: AppNotification[] = [
  {
    id: 1,
    title: 'New request',
    message: 'A user asked for you',
    type: 'info',
    is_read: false,
    created_at: '2026-09-29T10:00:00Z',
    link: 'request:5',
  },
  { id: 2, title: 'Rated', message: 'You got 5 stars', type: 'success', is_read: true, created_at: '2026-09-28T10:00:00Z' },
];
const markRead = vi.fn();
const markAllRead = vi.fn();

// The hook talks over socket.io (covered against the real server in requests.live.test); here only the page is under test.
vi.mock('@/api/notifications', async (orig) => ({
  ...(await orig<typeof import('@/api/notifications')>()),
  useNotifications: () => ({
    items: rows,
    unread: 1,
    isLoading: false,
    isError: false,
    refresh: vi.fn(),
    isRefreshing: false,
    markRead,
    markAllRead,
  }),
}));

describe('NotificationsPage', () => {
  it('lists everything, filters to unread, and marks read', () => {
    render(
      <MemoryRouter>
        <NotificationsPage />
      </MemoryRouter>,
    );
    expect(screen.getByText('New request')).toBeTruthy();
    expect(screen.getByText('Rated')).toBeTruthy();

    fireEvent.click(screen.getAllByRole('tab')[1]);
    expect(screen.getByText('New request')).toBeTruthy();
    expect(screen.queryByText('Rated')).toBeNull();

    fireEvent.click(screen.getByText('New request'));
    expect(markRead).toHaveBeenCalledWith(1);
    expect(useRequestsUi.getState().chatId).toBe(5); // its link opens the request's chat
  });

  it('shows the full text of a notification without a link', () => {
    render(
      <MemoryRouter>
        <NotificationsPage />
      </MemoryRouter>,
    );
    fireEvent.click(screen.getByText('Rated'));
    expect(markRead).not.toHaveBeenCalledWith(2); // already read
    expect(screen.getByRole('dialog')).toBeTruthy();
    expect(screen.getAllByText('You got 5 stars').length).toBe(2); // the row and the dialog
  });
});
