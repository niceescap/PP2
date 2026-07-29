// ═══════════════════════════════════════════════════════════════
// FIT Binary Parser
// Pure JS implementation — reads Garmin FIT files from ArrayBuffer
// Adapted from PaceParser/explorer.html with TypeScript + improvements
// ═══════════════════════════════════════════════════════════════

import { FitActivity, FitPoint, MapBounds, FIT_EPOCH, FIT_TYPES, RECORD_FIELDS } from './types.js';

interface FieldDef {
  name: string;
  size: number;
  type: string;
}

interface MsgDef {
  global: number;
  fields: FieldDef[];
  endian: number;
}

export function parseFIT(buffer: ArrayBuffer): FitActivity {
  const data = new Uint8Array(buffer);
  const view = new DataView(buffer);
  const headerLen = data[0];
  const dataSize = view.getUint32(4, true);
  const dataEnd = Math.min(headerLen + dataSize, data.length);
  
  const msgDefs: Record<number, MsgDef> = {};
  const records: Record<string, number | null>[] = [];
  let sportType: number | undefined;
  let activityStartTime: number | undefined;
  
  let i = headerLen;
  
  while (i < dataEnd) {
    if (i >= data.length) break;
    const rh = data[i++];
    const isCompressed = (rh & 0x80) !== 0;
    
    if (isCompressed) {
      // Compressed timestamp header
      const localNum = rh & 0x0F;
      const timeOffset = (rh >> 5) & 0x03;
      const defn = msgDefs[localNum];
      if (defn) {
        const rec: Record<string, number | null> = {};
        for (const f of defn.fields) {
          rec[f.name] = readField(view, data, i, f.size, f.type, defn.endian);
          i += f.size;
        }
        // Add compressed timestamp offset
        if (records.length > 0 && defn.global === 20 && rec.timestamp === null) {
          const lastTs = records[records.length - 1].timestamp;
          if (lastTs !== null) {
            rec.timestamp = (lastTs as number) + (timeOffset - 32); // signed offset
          }
        }
        if (defn.global === 20 && rec.timestamp !== null) {
          records.push(rec);
        }
      }
      continue;
    }
    
    const isDef = (rh & 0x40) !== 0;
    const hasDevFields = (rh & 0x20) !== 0;
    const localNum = rh & 0x0F;
    
    if (isDef) {
      // Message definition
      i++; // reserved byte
      const endian = data[i++];
      const arch = endian ? 'big' : 'little';
      const gn = endian ? view.getUint16(i, false) : view.getUint16(i, true);
      i += 2;
      const nf = data[i++];
      const fields: FieldDef[] = [];
      
      for (let f = 0; f < nf; f++) {
        const fnum = data[i++];
        const fsize = data[i++];
        const fbtr = data[i++] & 0x9F;
        const baseTypeNum = fbtr & 0x1F;
        const [typeName] = FIT_TYPES[baseTypeNum] || ['unknown', fsize];
        const fname = gn === 20 ? (RECORD_FIELDS[fnum] || `f${fnum}`) : `f${fnum}`;
        fields.push({ name: fname, size: fsize, type: typeName });
      }
      
      if (hasDevFields) {
        const nd = data[i++];
        for (let d = 0; d < nd; d++) {
          i++; // field number
          i++; // size
          i++; // base type index
        }
      }
      
      msgDefs[localNum] = { global: gn, fields, endian };
    } else {
      // Normal data message
      const defn = msgDefs[localNum];
      if (!defn) break;
      
      const rec: Record<string, number | null> = {};
      for (const f of defn.fields) {
        if (i + f.size > data.length) break;
        rec[f.name] = readField(view, data, i, f.size, f.type, defn.endian);
        i += f.size;
      }
      
      if (defn.global === 20 && rec.timestamp !== null) {
        records.push(rec);
      }
    }
  }
  
  // Convert raw records to FitPoints
  return convertRecords(records, activityStartTime);
}

function readField(view: DataView, data: Uint8Array, offset: number, size: number, ftype: string, endian: number): number | null {
  const le = endian === 0;
  
  try {
    switch (ftype) {
      case 'sint32': return view.getInt32(offset, le);
      case 'uint32': return view.getUint32(offset, le);
      case 'sint16': return view.getInt16(offset, le);
      case 'uint16': return view.getUint16(offset, le);
      case 'sint8': return view.getInt8(offset);
      case 'uint8': 
      case 'uint8z':
      case 'enum':
        return data[offset];
      default:
        return data[offset];
    }
  } catch {
    return null;
  }
}

function convertRecords(raw: Record<string, number | null>[], startTime?: number): FitActivity {
  // Convert raw records to structured points
  let baseTimestamp = 0;
  const points: FitPoint[] = [];
  let cumulativeDplus = 0;
  
  // Sort by FIT timestamp
  const sorted = raw.filter(r => r.timestamp !== null && r.timestamp !== undefined)
    .sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
  
  if (sorted.length === 0) {
    return createEmptyActivity();
  }
  
  baseTimestamp = sorted[0].timestamp || 0;
  
  for (let idx = 0; idx < sorted.length; idx++) {
    const r = sorted[idx];
    const ts = ((r.timestamp || 0) - baseTimestamp);
    
    const latSemircircles = r.lat as number | null;
    const lonSemicircles = r.lon as number | null;
    
    const lat = (latSemircircles !== null && latSemircircles !== undefined && latSemircircles !== 0x7FFFFFFF)
      ? latSemircircles * (180.0 / Math.pow(2, 31)) : null;
    const lon = (lonSemicircles !== null && lonSemicircles !== undefined && lonSemicircles !== 0x7FFFFFFF)
      ? lonSemicircles * (180.0 / Math.pow(2, 31)) : null;
    
    const alt = (r.alt !== null && r.alt !== undefined && r.alt !== 0xFFFF)
      ? (r.alt as number) / 5.0 - 500 : null;
      
    const hr = (r.hr !== null && r.hr !== undefined && r.hr !== 0xFF)
      ? (r.hr as number) : 0;
    const cad = (r.cad !== null && r.cad !== undefined && r.cad !== 0xFF)
      ? (r.cad as number) : 0;
    const speed = (r.speed !== null && r.speed !== undefined && r.speed !== 0xFFFF)
      ? (r.speed as number) / 1000.0 * 3.6 : 0;
    const power = (r.power !== null && r.power !== undefined && r.power !== 0xFFFF)
      ? (r.power as number) : 0;
    
    // Distance & D+
    const dist = (r.distance !== null && r.distance !== undefined && r.distance !== 0xFFFFFFFF)
      ? (r.distance as number) / 100.0 / 1000.0 : 0;
      
    let pente: number | null = null;
    
    if (idx > 0 && alt !== null && points[idx - 1].alt !== null && lat !== null && lon !== null) {
      const prev = points[idx - 1];
      if (prev.lat !== null && prev.lon !== null) {
        const dAlt = alt - prev.alt;
        const distM = haversine(prev.lat, prev.lon, lat, lon);
        if (distM > 0) {
          pente = (dAlt / distM) * 100;
          if (dAlt > 0) cumulativeDplus += dAlt;
        }
      }
    }
    
    const temp = (r.temperature !== null && r.temperature !== undefined && r.temperature !== 0x7F)
      ? (r.temperature as number) : null;
    
    points.push({
      timestamp: ts,
      elapsed: ts,
      lat, lon, alt,
      hr, cad, speed, power,
      distance: dist * 1000, // store as meters
      dplus: cumulativeDplus,
      pente,
      temp
    });
  }
  
  return buildActivity(points, baseTimestamp);
}

function haversine(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000;
  const toRad = Math.PI / 180;
  const dLat = (lat2 - lat1) * toRad;
  const dLon = (lon2 - lon1) * toRad;
  const a = Math.sin(dLat/2)**2 + Math.cos(lat1*toRad) * Math.cos(lat2*toRad) * Math.sin(dLon/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

function buildActivity(points: FitPoint[], baseTimestamp: number): FitActivity {
  const duration = points.length > 0 ? points[points.length - 1].elapsed : 0;
  const totalDist = points.length > 0 ? points[points.length - 1].distance : 0;
  const totalDplus = points.reduce((s, p) => s + Math.max(0, p.dplus), 0);
  
  const powers = points.filter(p => p.power > 0).map(p => p.power);
  const hrs = points.filter(p => p.hr > 0).map(p => p.hr);
  const cads = points.filter(p => p.cad > 0).map(p => p.cad);
  const speeds = points.filter(p => p.speed > 0).map(p => p.speed);
  
  const hasGps = points.some(p => p.lat !== null && p.lon !== null);
  const hasPower = powers.length > 0;
  const hasHr = hrs.length > 0;
  const hasCad = cads.length > 0;
  const hasAlt = points.some(p => p.alt !== null);
  
  let bounds: MapBounds | null = null;
  if (hasGps) {
    const gpsPts = points.filter(p => p.lat !== null && p.lon !== null);
    if (gpsPts.length > 0) {
      bounds = {
        minLat: Math.min(...gpsPts.map(p => p.lat!)),
        maxLat: Math.max(...gpsPts.map(p => p.lat!)),
        minLon: Math.min(...gpsPts.map(p => p.lon!)),
        maxLon: Math.max(...gpsPts.map(p => p.lon!))
      };
    }
  }
  
  return {
    points,
    meta: {
      totalDuration: duration,
      totalDistance: totalDist,
      totalDplus,
      avgPower: powers.length > 0 ? Math.round(powers.reduce((a,b)=>a+b,0)/powers.length) : 0,
      maxPower: powers.length > 0 ? Math.max(...powers) : 0,
      avgHr: hrs.length > 0 ? Math.round(hrs.reduce((a,b)=>a+b,0)/hrs.length) : 0,
      maxHr: hrs.length > 0 ? Math.max(...hrs) : 0,
      avgCad: cads.length > 0 ? Math.round(cads.reduce((a,b)=>a+b,0)/cads.length) : 0,
      maxSpeed: speeds.length > 0 ? Math.max(...speeds) : 0,
      avgSpeed: speeds.length > 0 ? speeds.reduce((a,b)=>a+b,0)/speeds.length : 0,
      sport: 'cycling',
      startTime: new Date((baseTimestamp + FIT_EPOCH) * 1000),
      hasGps, hasPower, hasHr, hasCadence: hasCad, hasAltitude: hasAlt
    },
    bounds
  };
}

function createEmptyActivity(): FitActivity {
  return {
    points: [],
    meta: {
      totalDuration: 0, totalDistance: 0, totalDplus: 0,
      avgPower: 0, maxPower: 0, avgHr: 0, maxHr: 0, avgCad: 0,
      maxSpeed: 0, avgSpeed: 0, sport: 'unknown', startTime: new Date(),
      hasGps: false, hasPower: false, hasHr: false, hasCadence: false, hasAltitude: false
    },
    bounds: null
  };
}
