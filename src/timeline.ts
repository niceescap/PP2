// ═══════════════════════════════════════════════════════════════
// Timeline helpers — shared by the browser exporters and the server
// renderer. Kept free of any browser or Node specific API so it can
// be imported from both sides.
// ═══════════════════════════════════════════════════════════════

import { FitPoint } from './fit/types.js';

/**
 * Resample data points to exactly 1 Hz based on elapsed time.
 * Guarantees: video second N shows data from source second N.
 *
 * The output length is `floor(t1 - t0) + 1` so that the very last
 * source second is always covered: a range of 10.4s yields 11 seconds
 * of video, never 10. Using `round` here used to drop or duplicate the
 * final second depending on the fractional part.
 */
export function resampleTo1Hz(points: FitPoint[]): FitPoint[] {
  if (points.length === 0) return [];
  if (points.length === 1) return [points[0]];

  const t0 = points[0].elapsed;
  const t1 = points[points.length - 1].elapsed;
  // Number of one-second slots covering [t0, t1], inclusive.
  const seconds = Math.max(1, Math.floor(t1 - t0) + 1);

  const out: FitPoint[] = [];
  let cursor = 0;

  for (let k = 0; k < seconds; k++) {
    const target = t0 + k;
    // Advance cursor to the point closest to target time
    while (
      cursor < points.length - 1 &&
      Math.abs(points[cursor + 1].elapsed - target) <= Math.abs(points[cursor].elapsed - target)
    ) {
      cursor++;
    }
    out.push(points[cursor]);
  }
  return out;
}
