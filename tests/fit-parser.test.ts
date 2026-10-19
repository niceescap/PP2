// ═══════════════════════════════════════════════════════════════
// FIT parser tests
// ═══════════════════════════════════════════════════════════════

import { describe, it, assert, assertEqual, assertClose, assertThrows } from './harness.js';
import { parseFIT } from '../src/fit/parser.js';
import { buildFitFile, sampleFitRecords, toSemicircles } from '../src/fit/fixtures.js';

describe('FIT parser', () => {
  it('parses a record stream into points', () => {
    const activity = parseFIT(buildFitFile(sampleFitRecords()));
    assertEqual(activity.points.length, 11, 'expected 11 points');
    assert(activity.meta.hasGps, 'expected GPS data');
    assert(activity.meta.hasPower, 'expected power data');
    assert(activity.meta.hasHr, 'expected heart rate data');
  });

  it('decodes position, altitude and sensor values', () => {
    const activity = parseFIT(buildFitFile(sampleFitRecords()));
    const p = activity.points[5];
    assertClose(p.lat!, 45.005, 0.0005, 'latitude');
    assertClose(p.lon!, 6.005, 0.0005, 'longitude');
    assertClose(p.alt!, 250, 0.5, 'altitude');
    assertEqual(p.hr, 125, 'heart rate');
    assertEqual(p.cad, 80, 'cadence');
    assertEqual(p.power, 205, 'power');
  });

  it('converts speed from mm/s to km/h', () => {
    const activity = parseFIT(buildFitFile(sampleFitRecords()));
    // 10 m/s = 36 km/h
    assertClose(activity.points[0].speed, 36, 0.2, 'speed in km/h');
  });

  it('resolves the activity sport from the sport message', () => {
    const cycling = parseFIT(buildFitFile(sampleFitRecords(), 2));
    assertEqual(cycling.meta.sport, 'cycling');
    const running = parseFIT(buildFitFile(sampleFitRecords(), 1));
    assertEqual(running.meta.sport, 'running');
  });

  it('accumulates D+ once and reports it as the final cumulative value', () => {
    const activity = parseFIT(buildFitFile(sampleFitRecords()));
    // 10 steps of +10 m over 11 points
    assertClose(activity.meta.totalDplus, 100, 0.5, 'total D+');
    const last = activity.points[activity.points.length - 1];
    assertClose(last.dplus, 100, 0.5, 'last cumulative D+');
  });

  it('keeps the cumulative D+ monotonic', () => {
    const activity = parseFIT(buildFitFile(sampleFitRecords()));
    for (let i = 1; i < activity.points.length; i++) {
      assert(
        activity.points[i].dplus >= activity.points[i - 1].dplus,
        `D+ must not decrease at index ${i}`
      );
    }
  });

  it('computes duration, distance and averages', () => {
    const activity = parseFIT(buildFitFile(sampleFitRecords()));
    assertEqual(activity.meta.totalDuration, 10, 'duration in seconds');
    assertClose(activity.meta.totalDistance, 100, 0.5, 'distance in meters');
    assertEqual(activity.meta.avgPower, 205, 'average power');
    assertEqual(activity.meta.maxPower, 210, 'max power');
  });

  it('computes the GPS bounds', () => {
    const activity = parseFIT(buildFitFile(sampleFitRecords()));
    assert(activity.bounds !== null, 'expected bounds');
    assertClose(activity.bounds!.minLat, 45.0, 0.0005);
    assertClose(activity.bounds!.maxLat, 45.01, 0.0005);
  });

  it('rejects a file without a valid FIT signature', () => {
    const junk = new Uint8Array(64);
    assertThrows(() => parseFIT(junk.buffer), 'expected a throw on a bad signature');
  });

  it('rejects a truncated file', () => {
    assertThrows(() => parseFIT(new ArrayBuffer(4)), 'expected a throw on a short file');
  });

  it('encodes degrees to semicircles consistently', () => {
    assertEqual(toSemicircles(0), 0);
    // 45 degrees = 45/180 * 2^31
    assertEqual(toSemicircles(45), 536870912);
    assertEqual(toSemicircles(90), 1073741824);
  });
});
