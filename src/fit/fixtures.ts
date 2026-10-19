// ═══════════════════════════════════════════════════════════════
// Test fixtures — synthetic FIT files built byte by byte.
//
// The repository ships no real FIT sample, so these builders produce
// minimal but spec-valid files: a 14-byte header, definition and data
// messages, and a matching CRC is not required by the parser (the
// parser stops at the declared data size).
// ═══════════════════════════════════════════════════════════════

const FIT_EPOCH = 631065600;

interface FieldDef {
  num: number;
  size: number;
  baseType: number;
}

/** Base type numbers as used in the FIT message definition. */
const BT = {
  uint8: 0x02,
  sint8: 0x01,
  uint16: 0x84,
  sint16: 0x83,
  uint32: 0x86,
  sint32: 0x85,
  string: 0x07,
  float32: 0x88,
  uint8z: 0x0A,
  uint16z: 0x8B,
  uint32z: 0x8C,
};

/**
 * Build one definition + data message pair.
 * `fields` maps the FIT field number to its value.
 */
function message(
  out: number[],
  localNum: number,
  globalNum: number,
  fields: FieldDef[],
  values: number[]
): void {
  // Definition message
  out.push(0x40 | localNum); // definition header
  out.push(0x00);            // reserved
  out.push(0x00);            // architecture: little endian
  out.push(globalNum & 0xFF);
  out.push((globalNum >> 8) & 0xFF);
  out.push(fields.length);
  for (const f of fields) {
    out.push(f.num);
    out.push(f.size);
    out.push(f.baseType);
  }
  // Data message
  out.push(localNum);
  for (let i = 0; i < fields.length; i++) {
    const f = fields[i];
    const v = values[i];
    switch (f.baseType) {
      case BT.uint8:
      case BT.uint8z:
        out.push(v & 0xFF);
        break;
      case BT.sint8:
        out.push(v & 0xFF);
        break;
      case BT.uint16:
      case BT.uint16z:
        out.push(v & 0xFF);
        out.push((v >> 8) & 0xFF);
        break;
      case BT.sint16:
        out.push(v & 0xFF);
        out.push((v >> 8) & 0xFF);
        break;
      case BT.uint32:
      case BT.uint32z:
      case BT.sint32:
      case BT.float32:
        out.push(v & 0xFF);
        out.push((v >> 8) & 0xFF);
        out.push((v >> 16) & 0xFF);
        out.push((v >> 24) & 0xFF);
        break;
      default:
        out.push(v & 0xFF);
        break;
    }
  }
}

/** Latitude/longitude encoded as semicircles (FIT stores degrees * 2^31). */
export function toSemicircles(degrees: number): number {
  return Math.round((degrees / 180) * Math.pow(2, 31));
}

export interface FitRecordSpec {
  timestamp: number;  // seconds since FIT epoch
  lat?: number;       // degrees
  lon?: number;       // degrees
  alt?: number;       // meters
  hr?: number;
  cad?: number;
  speed?: number;     // m/s
  power?: number;     // watts
  distance?: number;  // meters
}

/**
 * Build a FIT file with a record message per entry.
 * The sport message is emitted so the parser can resolve the activity sport.
 */
export function buildFitFile(records: FitRecordSpec[], sport = 2): ArrayBuffer {
  const body: number[] = [];

  // sport message (global 12), field 0 = sport
  message(body, 0, 12, [{ num: 0, size: 1, baseType: BT.uint8 }], [sport]);

  // record message (global 20)
  const recordFields: FieldDef[] = [
    { num: 253, size: 4, baseType: BT.uint32 },  // timestamp
    { num: 0, size: 4, baseType: BT.sint32 },    // position_lat
    { num: 1, size: 4, baseType: BT.sint32 },    // position_long
    { num: 2, size: 2, baseType: BT.uint16 },    // altitude
    { num: 3, size: 1, baseType: BT.uint8 },     // heart_rate
    { num: 4, size: 1, baseType: BT.uint8 },     // cadence
    { num: 5, size: 4, baseType: BT.uint32 },   // distance
    { num: 6, size: 2, baseType: BT.uint16 },    // speed
    { num: 7, size: 2, baseType: BT.uint16 },    // power
  ];
  const hasPower = records.some(r => r.power !== undefined);

  for (const r of records) {
    const fields = recordFields.filter(f => {
      switch (f.num) {
        case 0: return r.lat !== undefined;
        case 1: return r.lon !== undefined;
        case 2: return r.alt !== undefined;
        case 3: return r.hr !== undefined;
        case 4: return r.cad !== undefined;
        case 5: return r.distance !== undefined;
        case 6: return r.speed !== undefined;
        case 7: return r.power !== undefined;
        default: return true;
      }
    });
    const values = fields.map(f => {
      switch (f.num) {
        case 253: return r.timestamp;
        case 0: return toSemicircles(r.lat!);
        case 1: return toSemicircles(r.lon!);
        case 2: return Math.round((r.alt! + 500) * 5);
        case 3: return r.hr!;
        case 4: return r.cad!;
        case 5: return Math.round(r.distance! * 100);
        // FIT stores speed in mm/s
        case 6: return Math.round(r.speed! * 1000);
        case 7: return r.power!;
        default: return 0;
      }
    });
    message(body, 1, 20, fields, values);
  }

  // Header: 14 bytes
  //   [0] header size | [1] protocol | [2..3] profile | [4..7] data size
  //   [8..11] ".FIT"  | [12..13] header CRC
  const header = [
    0x0E,                   // header size
    0x10,                   // protocol version 1.0
    0x00, 0x00,             // profile version
    0x00, 0x00, 0x00, 0x00, // data size (filled below)
    0x2E, 0x46, 0x49, 0x54, // ".FIT"
    0x00, 0x00,             // header CRC
  ];

  const dataSize = body.length;
  header[4] = dataSize & 0xFF;
  header[5] = (dataSize >> 8) & 0xFF;
  header[6] = (dataSize >> 16) & 0xFF;
  header[7] = (dataSize >> 24) & 0xFF;

  const all = new Uint8Array(header.length + dataSize);
  all.set(header, 0);
  all.set(body, header.length);
  return all.buffer;
}

/** A simple straight ride: 11 points, 1 per second, climbing gently. */
export function sampleFitRecords(): FitRecordSpec[] {
  const records: FitRecordSpec[] = [];
  const base = FIT_EPOCH + 1_700_000_000;
  for (let i = 0; i <= 10; i++) {
    records.push({
      timestamp: base + i,
      lat: 45.0 + i * 0.001,
      lon: 6.0 + i * 0.001,
      alt: 200 + i * 10,
      hr: 120 + i,
      cad: 80,
      speed: 10,
      power: 200 + i,
      distance: i * 10,
    });
  }
  return records;
}
