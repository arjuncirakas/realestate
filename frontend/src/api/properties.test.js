import { describe, expect, it } from 'vitest';
import { roundMapBounds } from './properties.js';

/**
 * `roundMapBounds` is the Section 7.3 cache key: two viewports a few metres
 * apart must round to the same bounds, or the 5-minute `staleTime` on
 * `usePropertyMap` never gets a cache hit worth having.
 */
describe('roundMapBounds', () => {
  it('renames the camera bounds into the bounding-box query field names', () => {
    expect(roundMapBounds({ north: 9.1, south: 8.7, east: 77.0, west: 76.4 })).toEqual({
      maxLat: 9.1,
      minLat: 8.7,
      maxLng: 77.0,
      minLng: 76.4,
    });
  });

  it('rounds to 3 decimal places, so two nearby viewports share a cache key', () => {
    const a = roundMapBounds({ north: 9.10041, south: 8.70009, east: 77.00033, west: 76.39998 });
    const b = roundMapBounds({ north: 9.10044, south: 8.70011, east: 77.00029, west: 76.40001 });
    expect(a).toEqual(b);
  });

  it('returns null when there are no bounds yet, rather than a bogus query', () => {
    expect(roundMapBounds(null)).toBeNull();
  });
});
