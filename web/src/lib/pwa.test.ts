import { afterEach, describe, expect, it, vi } from 'vitest';
import { showSystemNotification } from './pwa';

function stubNotification(permission: NotificationPermission) {
  const ctor = vi.fn();
  vi.stubGlobal('Notification', Object.assign(ctor, { permission }));
  return ctor;
}

function stubWorker(registration: unknown) {
  Object.defineProperty(navigator, 'serviceWorker', {
    configurable: true,
    value: { getRegistration: () => Promise.resolve(registration) },
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
  Reflect.deleteProperty(navigator, 'serviceWorker');
});

describe('showSystemNotification', () => {
  it('goes through the service worker when there is one (the only way on Android)', async () => {
    const ctor = stubNotification('granted');
    const showNotification = vi.fn().mockResolvedValue(undefined);
    stubWorker({ showNotification });
    await showSystemNotification('New request', 'A plumber is needed');
    expect(showNotification).toHaveBeenCalledWith('New request', expect.objectContaining({ body: 'A plumber is needed' }));
    expect(ctor).not.toHaveBeenCalled();
  });

  it('falls back to the constructor without a worker', async () => {
    const ctor = stubNotification('granted');
    stubWorker(undefined);
    await showSystemNotification('Hi', 'there');
    expect(ctor).toHaveBeenCalledWith('Hi', expect.objectContaining({ body: 'there' }));
  });

  it('does nothing without permission', async () => {
    const ctor = stubNotification('default');
    const showNotification = vi.fn();
    stubWorker({ showNotification });
    await showSystemNotification('Hi', 'there');
    expect(ctor).not.toHaveBeenCalled();
    expect(showNotification).not.toHaveBeenCalled();
  });

  it('swallows a browser refusal', async () => {
    stubNotification('granted');
    stubWorker({ showNotification: () => Promise.reject(new Error('refused')) });
    await expect(showSystemNotification('Hi', 'there')).resolves.toBeUndefined();
  });
});
