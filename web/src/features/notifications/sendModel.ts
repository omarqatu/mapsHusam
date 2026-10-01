import type { SendNotificationPayload } from '@/api/socket';

// The admin's "send a notification" form (legacy notifications-panel.html): values → checks → the socket payload.

export type TargetType = SendNotificationPayload['targetType'];
export type NotifyType = SendNotificationPayload['type'];

export const TARGET_TYPES: TargetType[] = [
  'single',
  'online',
  'all_users',
  'regular_users',
  'providers',
  'admins',
  'selected',
];
export const NOTIFY_TYPES: NotifyType[] = ['info', 'success', 'warning', 'error'];
/** The server's column limit. */
export const TITLE_MAX = 255;

export interface SendForm {
  target: TargetType;
  userId: string;
  selected: number[];
  type: NotifyType;
  title: string;
  message: string;
}

export const EMPTY_SEND: SendForm = {
  target: 'single',
  userId: '',
  selected: [],
  type: 'info',
  title: '',
  message: '',
};

export type SendErrors = Partial<Record<'userId' | 'selected' | 'title' | 'message', 'required' | 'invalid'>>;

export function validateSend(f: SendForm): SendErrors {
  const e: SendErrors = {};
  if (f.target === 'single') {
    if (!f.userId.trim()) e.userId = 'required';
    else if (!/^\d+$/.test(f.userId.trim()) || Number(f.userId) <= 0) e.userId = 'invalid';
  }
  if (f.target === 'selected' && f.selected.length === 0) e.selected = 'required';
  if (!f.title.trim()) e.title = 'required';
  if (!f.message.trim()) e.message = 'required';
  return e;
}

/** The payload; call only when `validateSend` found nothing. */
export function toPayload(f: SendForm): SendNotificationPayload {
  const p: SendNotificationPayload = {
    targetType: f.target,
    title: f.title.trim().slice(0, TITLE_MAX),
    message: f.message.trim(),
    type: f.type,
  };
  if (f.target === 'single') p.targetUserId = Number(f.userId.trim());
  if (f.target === 'selected') p.targetUserIds = [...new Set(f.selected)];
  return p;
}
