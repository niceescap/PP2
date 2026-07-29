// ═══════════════════════════════════════════════════════════════
// FIT Parser Types & Constants
// Binary FIT file reader — 100% browser-native, zero dependencies
// ═══════════════════════════════════════════════════════════════

export interface FitPoint {
  timestamp: number;       // seconds since activity start
  elapsed: number;         // seconds from activity start
  lat: number | null;      // degrees
  lon: number | null;      // degrees
  alt: number | null;     // meters
  hr: number;              // bpm (0 = no data)
  cad: number;             // rpm/spm (0 = no data)
  speed: number;           // km/h
  power: number;           // watts
  distance: number;        // meters from start (cumulative)
  dplus: number;          // cumulative ascent in meters
  pente: number | null;   // gradient % at point
  temp: number | null;    // °C
}

export interface FitActivity {
  points: FitPoint[];
  meta: {
    totalDuration: number;   // seconds
    totalDistance: number;   // meters
    totalDplus: number;      // meters
    avgPower: number;
    maxPower: number;
    avgHr: number;
    maxHr: number;
    avgCad: number;
    maxSpeed: number;
    avgSpeed: number;
    sport: string;
    startTime: Date;
    hasGps: boolean;
    hasPower: boolean;
    hasHr: boolean;
    hasCadence: boolean;
    hasAltitude: boolean;
  };
  bounds: MapBounds | null;
}

export interface MapBounds {
  minLat: number; maxLat: number;
  minLon: number; maxLon: number;
}

// ── FIT Protocol Constants ────────────────────────
export const FIT_EPOCH = 631065600; // seconds between UNIX and FIT epoch (1989-12-31 → 1970-01-01)

export const FIT_TYPES: Array<[string, number]> = [
  ['enum', 1], ['sint8', 1], ['uint8', 1], ['sint16', 2], ['uint16', 2],
  ['sint32', 4], ['uint32', 4], ['string', 1], ['float32', 4], ['float64', 8],
  ['uint8z', 1], ['uint16z', 2], ['uint32z', 4], ['byte', 1],
  ['sint64', 8], ['uint64', 8], ['uint64z', 8]
];

// Field numbers for record messages (global msg type 20)
export const RECORD_FIELDS: Record<number, string> = {
  0: 'lat', 1: 'lon', 2: 'alt', 3: 'hr', 4: 'cad', 5: 'distance',
  6: 'speed', 7: 'power', 13: 'temperature', 29: 'accumulated_power',
  253: 'timestamp'
};

// Sport type map (from sport message field 0)
export const SPORT_MAP: Record<number, string> = {
  0: 'generic', 1: 'running', 2: 'cycling', 3: 'transition',
  5: 'swimming', 7: 'hiking', 11: 'walking', 15: 'trail running',
  17: 'mountain biking', 19: 'rowing', 23: 'open water swim',
};
