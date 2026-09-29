import '@testing-library/jest-dom/vitest';
import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

afterEach(() => cleanup());

// jsdom has no layout, so no scrollIntoView. The portal's deep-link scroll fires after a 250 ms timer that only lands inside
// a test when the machine is busy — without this stub that was a flaky "unhandled error" that failed the whole run.
if (typeof Element !== 'undefined' && typeof Element.prototype.scrollIntoView !== 'function')
  Element.prototype.scrollIntoView = () => undefined;
