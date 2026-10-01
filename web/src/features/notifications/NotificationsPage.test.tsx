import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import '@/i18n';
import type { AppNotification } from '@/api/notifications';
import NotificationsPage from './NotificationsPage';

const rows: AppNotification[] = [
  { id: 1, title: 'New request', message: 'A user asked for you', type: 'info', is_read: false, created_at: '2026-09-29T10:00:00Z' },
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
    render(<NotificationsPage />);
    expect(screen.getByText('New request')).toBeTruthy();
    expect(screen.getByText('Rated')).toBeTruthy();

    fireEvent.click(screen.getAllByRole('tab')[1]);
    expect(screen.getByText('New request')).toBeTruthy();
    expect(screen.queryByText('Rated')).toBeNull();

    fireEvent.click(screen.getByText('New request'));
    expect(markRead).toHaveBeenCalledWith(1);
  });
});
