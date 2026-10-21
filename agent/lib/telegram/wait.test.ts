import { afterEach, describe, expect, it, vi } from 'vitest';

import { wait } from './wait';

afterEach(() => {
  vi.useRealTimers();
});

describe('wait', () => {
  it('resolves once the time has passed, not before', async () => {
    vi.useFakeTimers();
    let done = false;

    const waiting = wait(500).then(() => {
      done = true;
    });
    await vi.advanceTimersByTimeAsync(499);
    expect(done).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    await waiting;

    expect(done).toBe(true);
  });
});
