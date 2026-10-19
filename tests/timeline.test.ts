// ═══════════════════════════════════════════════════════════════
// resampleTo1Hz tests — the timeline exactness guarantee
// ═══════════════════════════════════════════════════════════════

import { describe, it, assertEqual } from './harness.js';
import { resampleTo1Hz } from '../src/timeline.js';
import { FitPoint } from '../src/fit/types.js';

function point(elapsed: number): FitPoint {
  return {
    timestamp: elapsed, elapsed, lat: null, lon: null, alt: null,
    hr: 0, cad: 0, speed: 0, power: 0, distance: 0, dplus: 0,
    pente: null, temp: null,
  };
}

describe('resampleTo1Hz', () => {
  it('returns an empty array for no points', () => {
    assertEqual(resampleTo1Hz([]).length, 0);
  });

  it('returns the single point unchanged', () => {
    const out = resampleTo1Hz([point(0)]);
    assertEqual(out.length, 1);
    assertEqual(out[0].elapsed, 0);
  });

  it('covers every second of an exact range', () => {
    const points = Array.from({ length: 11 }, (_, i) => point(i));
    assertEqual(resampleTo1Hz(points).length, 11);
  });

  it('keeps the last second of a fractional range', () => {
    // 0 → 10.4 s must yield 11 seconds, never 10
    const points = [point(0), point(5), point(10.4)];
    assertEqual(resampleTo1Hz(points).length, 11);
  });

  it('does not exceed the source range for a sub-second span', () => {
    const points = [point(0), point(0.4)];
    assertEqual(resampleTo1Hz(points).length, 1);
  });

  it('picks the point closest to each target second', () => {
    const points = [point(0), point(0.4), point(1.0), point(1.6), point(2.0)];
    const out = resampleTo1Hz(points);
    assertEqual(out.length, 3);
    assertEqual(out[0].elapsed, 0);
    assertEqual(out[1].elapsed, 1.0);
    assertEqual(out[2].elapsed, 2.0);
  });

  it('handles a range that does not start at zero', () => {
    const points = Array.from({ length: 6 }, (_, i) => point(100 + i));
    const out = resampleTo1Hz(points);
    assertEqual(out.length, 6);
    assertEqual(out[0].elapsed, 100);
    assertEqual(out[5].elapsed, 105);
  });
});
