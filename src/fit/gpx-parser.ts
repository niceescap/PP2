// ═══════════════════════════════════════════════════════════════
// GPX Parser — reads GPS tracks from GPX 1.0/1.1 XML
// Produces the same FitActivity shape as the FIT parser so the
// rest of the app is format-agnostic.
//
// No external dependency: DOMParser is available in every browser.
// ═══════════════════════════════════════════════════════════════

import { FitActivity, FitPoint, MapBounds } from './types.js';

export interface GpxOptions {
  /** Sample the track to at most 1 point per second (default true). */
  resampleTo1Hz?: boolean;
  /**
   * XML parser factory. Defaults to the browser's `DOMParser`.
   * The server and the test suite inject their own implementation so
   * this module stays free of any DOM dependency.
   */
  domParser?: (xml: string) => XMLDocument;
}

/** Default XML parser: the browser built-in. */
function defaultDomParser(xml: string): XMLDocument {
  if (typeof DOMParser === 'undefined') {
    throw new Error('Aucun parseur XML disponible (DOMParser absent)');
  }
  return new DOMParser().parseFromString(xml, 'application/xml');
}

function textOf(parent: Element, tag: string): string | null {
  const el = parent.getElementsByTagName(tag)[0];
  return el ? el.textContent?.trim() ?? null : null;
}

/** Parse an ISO 8601 timestamp into seconds since epoch. */
function parseTime(value: string | null): number | null {
  if (!value) return null;
  const ms = Date.parse(value);
  return Number.isNaN(ms) ? null : ms / 1000;
}

export function parseGPX(xml: string, options: GpxOptions = {}): FitActivity {
  const resample = options.resampleTo1Hz !== false;
  const parse = options.domParser ?? defaultDomParser;
  const doc = parse(xml);

  if (doc.querySelector('parsererror')) {
    throw new Error('Fichier GPX invalide (XML mal formé)');
  }
  // A well-formed GPX document always has a root element.
  if (!doc.documentElement || doc.documentElement.tagName === '#document') {
    throw new Error('Fichier GPX invalide (racine XML absente)');
  }

  // ── Collect track points ────────────────────────
  const raw: {
    time: number | null;
    lat: number;
    lon: number;
    alt: number | null;
    hr: number;
    cad: number;
  }[] = [];

  const trackpoints = Array.from(doc.getElementsByTagName('trkpt'));
  const routepoints = Array.from(doc.getElementsByTagName('rtept'));
  const waypoints = Array.from(doc.getElementsByTagName('wpt'));

  // A GPX may hold a track, a route, or only waypoints.
  const sources = trackpoints.length > 0 ? trackpoints
    : routepoints.length > 0 ? routepoints
    : waypoints;

  for (const node of sources) {
    const lat = parseFloat(node.getAttribute('lat') ?? '');
    const lon = parseFloat(node.getAttribute('lon') ?? '');
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;

    const ele = textOf(node, 'ele');
    const time = parseTime(node.getAttribute('time') ?? textOf(node, 'time'));

    // Garmin extension: <gpxtpx:hr>, <gpxtpx:cad>
    const hr = parseInt(textOf(node, 'hr') ?? '', 10);
    const cad = parseInt(textOf(node, 'cad') ?? '', 10);

    raw.push({
      time,
      lat,
      lon,
      alt: ele !== null && Number.isFinite(parseFloat(ele)) ? parseFloat(ele) : null,
      hr: Number.isFinite(hr) ? hr : 0,
      cad: Number.isFinite(cad) ? cad : 0,
    });
  }

  if (raw.length === 0) {
    throw new Error('Aucun point GPS trouvé dans le fichier GPX');
  }

  // Sort by time when timestamps exist, otherwise keep document order.
  const hasTimes = raw.some(p => p.time !== null);
  if (hasTimes) {
    raw.sort((a, b) => (a.time ?? 0) - (b.time ?? 0));
  }

  // ── Downsample to 1 Hz ──────────────────────────
  let sampled = raw;
  if (resample && hasTimes && raw.length > 1) {
    const bucket = new Map<number, (typeof raw)[number]>();
    for (const p of raw) {
      const sec = Math.floor(p.time!);
      // Keep the last point of each second (most recent state)
      bucket.set(sec, p);
    }
    sampled = Array.from(bucket.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([, p]) => p);
  }

  // ── Build points ───────────────────────────────
  const t0 = sampled[0].time ?? 0;
  const points: FitPoint[] = [];
  let cumulativeDplus = 0;
  let cumulativeDistance = 0;

  for (let i = 0; i < sampled.length; i++) {
    const p = sampled[i];
    const elapsed = p.time !== null ? p.time - t0 : i;

    let alt = p.alt;
    let pente: number | null = null;

    if (i > 0) {
      const prev = sampled[i - 1];
      const prevPoint = points[i - 1];
      const distM = haversine(prev.lat, prev.lon, p.lat, p.lon);
      cumulativeDistance += distM;

      if (alt !== null && prevPoint.alt !== null) {
        const dAlt = alt - prevPoint.alt;
        if (distM > 0) {
          pente = (dAlt / distM) * 100;
          if (dAlt > 0) cumulativeDplus += dAlt;
        }
      }
    }

    // Speed from the distance covered over the last interval
    let speed = 0;
    if (i > 0) {
      const prevPoint = points[i - 1];
      const dt = elapsed - prevPoint.elapsed;
      if (dt > 0) {
        const distM = haversine(
          sampled[i - 1].lat, sampled[i - 1].lon, p.lat, p.lon
        );
        speed = (distM / dt) * 3.6;
      }
    }

    points.push({
      timestamp: elapsed,
      elapsed,
      lat: p.lat,
      lon: p.lon,
      alt,
      hr: p.hr,
      cad: p.cad,
      speed,
      power: 0,
      distance: cumulativeDistance,
      dplus: cumulativeDplus,
      pente,
      temp: null,
    });
  }

  return buildGpxActivity(points, t0);
}

function haversine(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000;
  const toRad = Math.PI / 180;
  const dLat = (lat2 - lat1) * toRad;
  const dLon = (lon2 - lon1) * toRad;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * toRad) * Math.cos(lat2 * toRad) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function buildGpxActivity(points: FitPoint[], startEpoch: number): FitActivity {
  const duration = points.length > 0 ? points[points.length - 1].elapsed : 0;
  const totalDist = points.length > 0 ? points[points.length - 1].distance : 0;
  const totalDplus = points.length > 0 ? points[points.length - 1].dplus : 0;

  const hrs = points.filter(p => p.hr > 0).map(p => p.hr);
  const cads = points.filter(p => p.cad > 0).map(p => p.cad);
  const speeds = points.filter(p => p.speed > 0).map(p => p.speed);
  const hasGps = points.some(p => p.lat !== null && p.lon !== null);
  const hasAlt = points.some(p => p.alt !== null);

  let bounds: MapBounds | null = null;
  if (hasGps) {
    const lats = points.map(p => p.lat!);
    const lons = points.map(p => p.lon!);
    bounds = {
      minLat: Math.min(...lats),
      maxLat: Math.max(...lats),
      minLon: Math.min(...lons),
      maxLon: Math.max(...lons),
    };
  }

  return {
    points,
    meta: {
      totalDuration: duration,
      totalDistance: totalDist,
      totalDplus,
      avgPower: 0,
      maxPower: 0,
      avgHr: hrs.length > 0 ? Math.round(hrs.reduce((a, b) => a + b, 0) / hrs.length) : 0,
      maxHr: hrs.length > 0 ? Math.max(...hrs) : 0,
      avgCad: cads.length > 0 ? Math.round(cads.reduce((a, b) => a + b, 0) / cads.length) : 0,
      maxSpeed: speeds.length > 0 ? Math.max(...speeds) : 0,
      avgSpeed: speeds.length > 0 ? speeds.reduce((a, b) => a + b, 0) / speeds.length : 0,
      sport: 'generic',
      startTime: new Date(startEpoch * 1000),
      hasGps,
      hasPower: false,
      hasHr: hrs.length > 0,
      hasCadence: cads.length > 0,
      hasAltitude: hasAlt,
    },
    bounds,
  };
}
