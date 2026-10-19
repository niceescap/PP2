// ═══════════════════════════════════════════════════════════════
// GPX parser tests
// ═══════════════════════════════════════════════════════════════

import { describe, it, assert, assertEqual, assertClose, assertThrows } from './harness.js';
import { parseGPX } from '../src/fit/gpx-parser.js';
import { parseXml, parseXmlStrict } from './xml-parser.js';

/** Parse a GPX document with the test XML parser. */
function parse(xml: string) {
  return parseGPX(xml, { domParser: parseXml });
}

const GPX = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="test" xmlns="http://www.topografix.com/GPX/1/1">
  <trk>
    <name>Test ride</name>
    <trkseg>
      <trkpt lat="45.000" lon="6.000"><ele>200</ele><time>2024-01-01T10:00:00Z</time></trkpt>
      <trkpt lat="45.001" lon="6.001"><ele>210</ele><time>2024-01-01T10:00:01Z</time></trkpt>
      <trkpt lat="45.002" lon="6.002"><ele>220</ele><time>2024-01-01T10:00:02Z</time></trkpt>
      <trkpt lat="45.003" lon="6.003"><ele>215</ele><time>2024-01-01T10:00:03Z</time></trkpt>
    </trkseg>
  </trk>
</gpx>`;

describe('GPX parser', () => {
  it('parses the track points', () => {
    const activity = parse(GPX);
    assertEqual(activity.points.length, 4);
    assert(activity.meta.hasGps, 'expected GPS data');
    assert(activity.meta.hasAltitude, 'expected altitude data');
  });

  it('reads coordinates and elevation', () => {
    const activity = parse(GPX);
    assertClose(activity.points[0].lat!, 45.0, 1e-9);
    assertClose(activity.points[0].lon!, 6.0, 1e-9);
    assertClose(activity.points[2].alt!, 220, 0.001);
  });

  it('computes the elapsed time from the first point', () => {
    const activity = parse(GPX);
    assertEqual(activity.points[0].elapsed, 0);
    assertEqual(activity.points[3].elapsed, 3);
    assertEqual(activity.meta.totalDuration, 3);
  });

  it('accumulates D+ and distance', () => {
    const activity = parse(GPX);
    // 200 → 210 → 220 → 215: two 10 m climbs = 20 m of D+
    assertClose(activity.meta.totalDplus, 20, 0.001);
    assert(activity.meta.totalDistance > 100, 'expected a non-zero distance');
  });

  it('computes the GPS bounds', () => {
    const activity = parse(GPX);
    assertClose(activity.bounds!.minLat, 45.0, 1e-9);
    assertClose(activity.bounds!.maxLat, 45.003, 1e-9);
  });

  it('reads a route when no track is present', () => {
    const route = `<?xml version="1.0"?>
      <gpx version="1.1" creator="test">
        <rte><rtept lat="45.1" lon="6.1"><ele>100</ele><time>2024-01-01T10:00:00Z</time></rtept>
        <rtept lat="45.2" lon="6.2"><ele>110</ele><time>2024-01-01T10:00:01Z</time></rtept></rte>
      </gpx>`;
    const activity = parse(route);
    assertEqual(activity.points.length, 2);
  });

  it('rejects malformed XML', () => {
    assertThrows(
      () => parseGPX('<gpx><trk>', { domParser: parseXmlStrict }),
      'expected a throw on broken XML'
    );
  });

  it('rejects a file without any point', () => {
    assertThrows(
      () => parse('<?xml version="1.0"?><gpx version="1.1"><trk></trk></gpx>'),
      'expected a throw when no point is found'
    );
  });
});
