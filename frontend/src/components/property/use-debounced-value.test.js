import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useDebouncedValue } from './use-debounced-value.js';

/**
 * The map explorer's Section 7.3 guarantee — "debounce viewport queries at
 * 500ms" — lives entirely in this hook. A pan that fires ten `onBoundsChanged`
 * events in 200ms must produce one debounced value, not ten queries.
 */
describe('useDebouncedValue', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('holds the initial value immediately', () => {
    const { result } = renderHook(() => useDebouncedValue('first', 500));
    expect(result.current).toBe('first');
  });

  it('does not adopt a new value until the delay has fully elapsed', () => {
    const { result, rerender } = renderHook(({ value }) => useDebouncedValue(value, 500), {
      initialProps: { value: 'a' },
    });

    rerender({ value: 'b' });
    act(() => vi.advanceTimersByTime(499));
    expect(result.current).toBe('a');

    act(() => vi.advanceTimersByTime(1));
    expect(result.current).toBe('b');
  });

  it('restarts the timer on every change during a pan, settling on the last value only', () => {
    const { result, rerender } = renderHook(({ value }) => useDebouncedValue(value, 500), {
      initialProps: { value: 'bounds-1' },
    });

    for (const value of ['bounds-2', 'bounds-3', 'bounds-4']) {
      rerender({ value });
      act(() => vi.advanceTimersByTime(200));
    }
    expect(result.current).toBe('bounds-1');

    act(() => vi.advanceTimersByTime(500));
    expect(result.current).toBe('bounds-4');
  });
});
