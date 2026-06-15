import { describe, it, expect } from 'vitest';
import { formatTime, parseTime } from '../src/utils/time';

describe('formatTime', () => {
  it('formats m:ss and h:mm:ss', () => {
    expect(formatTime(0)).toBe('0:00');
    expect(formatTime(5)).toBe('0:05');
    expect(formatTime(65)).toBe('1:05');
    expect(formatTime(3661)).toBe('1:01:01');
  });
  it('guards NaN / Infinity / negative', () => {
    expect(formatTime(NaN)).toBe('0:00');
    expect(formatTime(Infinity)).toBe('0:00');
    expect(formatTime(-10)).toBe('0:00');
  });
});

describe('parseTime', () => {
  it('parses m:ss and h:mm:ss', () => {
    expect(parseTime('0:05')).toBe(5);
    expect(parseTime('1:05')).toBe(65);
    expect(parseTime('1:01:01')).toBe(3661);
  });
  it('returns 0 (not NaN) on malformed input — its documented contract', () => {
    expect(parseTime('1:2:bad')).toBe(0);
    expect(parseTime('a:b')).toBe(0);
    expect(parseTime('nonsense')).toBe(0);
  });
});
