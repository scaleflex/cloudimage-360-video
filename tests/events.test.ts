import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { EventEmitter, throttle } from '../src/utils/events';

describe('EventEmitter.once', () => {
  it('fires the handler exactly once', () => {
    const ee = new EventEmitter();
    const fn = vi.fn();
    ee.once('e', fn);
    ee.emit('e');
    ee.emit('e');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('the same handler can be a one-shot listener on multiple events', () => {
    const ee = new EventEmitter();
    const fn = vi.fn();
    // Regression: a single handler→wrapper map used to let the 2nd registration
    // clobber the 1st, so one of the events could never be removed/fired right.
    ee.once('a', fn);
    ee.once('b', fn);
    ee.emit('a');
    ee.emit('b');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('off(event, handler) removes a pending once wrapper for that event only', () => {
    const ee = new EventEmitter();
    const fn = vi.fn();
    ee.once('a', fn);
    ee.once('b', fn);
    ee.off('a', fn); // cancel only the 'a' registration
    ee.emit('a');
    ee.emit('b');
    expect(fn).toHaveBeenCalledTimes(1);
  });
});

describe('throttle', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('fires on the leading edge immediately', () => {
    const fn = vi.fn();
    const t = throttle(fn, 100);
    t('a');
    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenLastCalledWith('a');
  });

  it('trailing edge uses the most recent args, not the scheduling call', () => {
    const fn = vi.fn();
    const t = throttle(fn, 100);
    t(1); // leading
    t(2); // schedules trailing
    t(3); // updates the pending args
    vi.advanceTimersByTime(100);
    expect(fn).toHaveBeenCalledTimes(2);
    expect(fn).toHaveBeenLastCalledWith(3);
  });

  it('cancel() drops a pending trailing call', () => {
    const fn = vi.fn();
    const t = throttle(fn, 100);
    t(1);
    t(2);
    t.cancel();
    vi.advanceTimersByTime(200);
    expect(fn).toHaveBeenCalledTimes(1);
  });
});
