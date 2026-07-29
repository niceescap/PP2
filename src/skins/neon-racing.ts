// ═══════════════════════════════════════════════════════════════
// Skin: Neon Racing
// Cyberpunk, gaming, néon vert/rose sur fond sombre
// MAP live style circuit · Chroma ready
// ═══════════════════════════════════════════════════════════════

import { FitPoint, MapBounds } from '../fit/types.js';
import { ISkin, SkinConfig, CustomizableField } from './types.js';

const NEON_DEFAULTS: Partial<SkinConfig> = {
  bgMode: 'green',
  bgColor: '#00ff66',
  primaryColor: '#00ff88',
  secondaryColor: '#ff006e',
  accentColor: '#00ff88',
  textColor: '#00ff88',
  gaugeBgColor: 'rgba(0,255,136,0.10)',
  gaugeFillColor: '#00ff88',
  fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
  fontSizePower: 140,
  fontSizeMetrics: 24,
  mapBgColor: 'rgba(0,0,0,0.6)',
  mapTrackColor: '#00ff88',
  mapCurrentColor: '#ff006e',
};

export class NeonRacing implements ISkin {
  readonly id = 'neon-racing';
  readonly name = 'Neon Racing';
  readonly description = 'Cyberpunk, néon, gaming';
  readonly category = 'énergique' as const;
  
  config: SkinConfig;
  
  constructor(config?: Partial<SkinConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...NEON_DEFAULTS, ...config } as SkinConfig;
  }
  
  getCustomizableFields(): CustomizableField[] {
    return [
      { key: 'bgMode', label: 'Fond', type: 'select', options: [
        { value: 'green', label: 'Vert Chroma' },
        { value: 'black', label: 'Noir' },
        { value: 'transparent', label: 'Transparent' }
      ]},
      { key: 'primaryColor', label: 'Couleur néon 1', type: 'color' },
      { key: 'secondaryColor', label: 'Couleur néon 2', type: 'color' },
      { key: 'showMap', label: 'Carte circuit', type: 'boolean' },
      { key: 'showPower', label: 'Puissance', type: 'boolean' },
      { key: 'showSpeed', label: 'Vitesse', type: 'boolean' },
      { key: 'showHr', label: 'FC', type: 'boolean' },
      { key: 'showCadence', label: 'Cadence', type: 'boolean' },
      { key: 'showDistance', label: 'Distance', type: 'boolean' },
    ];
  }
  
  draw(
    ctx: CanvasRenderingContext2D,
    W: number, H: number,
    point: FitPoint,
    allPoints: FitPoint[],
    currentIndex: number,
    bounds: MapBounds | null,
    meta: { maxPower: number; maxSpeed: number; maxHr: number; avgPower: number; elapsed: number }
  ): void {
    const c = this.config;
    
    if (c.bgMode === 'green') {
      ctx.fillStyle = '#00ff66';
      ctx.fillRect(0, 0, W, H);
    } else if (c.bgMode === 'black') {
      ctx.fillStyle = '#050505';
      ctx.fillRect(0, 0, W, H);
      ctx.strokeStyle = 'rgba(0,255,136,0.08)';
      ctx.lineWidth = 1;
      for (let gx = 0; gx < W; gx += 48) {
        ctx.beginPath(); ctx.moveTo(gx, 0); ctx.lineTo(gx, H); ctx.stroke();
      }
      for (let gy = 0; gy < H; gy += 48) {
        ctx.beginPath(); ctx.moveTo(0, gy); ctx.lineTo(W, gy); ctx.stroke();
      }
    }
    
    ctx.shadowColor = c.primaryColor;
    ctx.shadowBlur = 20;
    
    const pcx = W * 0.5;
    const pcy = H * 0.45;
    
    ctx.beginPath();
    ctx.arc(pcx, pcy, c.fontSizePower * 0.8, 0, Math.PI * 2);
    ctx.strokeStyle = c.gaugeBgColor;
    ctx.lineWidth = 3;
    ctx.stroke();
    
    if (meta.maxPower > 0 && point.power > 0) {
      const ratio = Math.min(1, point.power / meta.maxPower);
      ctx.beginPath();
      ctx.arc(pcx, pcy, c.fontSizePower * 0.8, -Math.PI/2, -Math.PI/2 + ratio * Math.PI * 2);
      ctx.strokeStyle = c.gaugeFillColor;
      ctx.lineWidth = 5;
      ctx.lineCap = 'round';
      ctx.stroke();
    }
    
    ctx.font = `800 ${c.fontSizePower}px ${c.fontFamily}`;
    ctx.fillStyle = c.primaryColor;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(Math.round(point.power).toString(), pcx, pcy);
    
    ctx.shadowBlur = 0;
    
    ctx.font = `600 ${c.fontSizePower * 0.18}px ${c.fontFamily}`;
    ctx.fillStyle = c.secondaryColor;
    ctx.fillText('W', pcx, pcy + c.fontSizePower * 0.5);
    
    const my = H * 0.78;
    const metrics: Array<{ v: string; l: string }> = [];
    if (c.showSpeed) metrics.push({ v: `${point.speed.toFixed(1)}`, l: 'KM/H' });
    if (c.showHr) metrics.push({ v: `${point.hr}`, l: 'BPM' });
    if (c.showCadence) metrics.push({ v: `${point.cad}`, l: 'RPM' });
    if (c.showDistance) metrics.push({ v: `${(point.distance/1000).toFixed(1)}`, l: 'KM' });
    
    const colW = W / (metrics.length + 1);
    metrics.forEach((m, i) => {
      const mx = colW * (i + 1);
      ctx.shadowColor = c.secondaryColor;
      ctx.shadowBlur = 12;
      ctx.font = `800 ${c.fontSizeMetrics}px ${c.fontFamily}`;
      ctx.fillStyle = c.secondaryColor;
      ctx.textAlign = 'center';
      ctx.fillText(m.v, mx, my);
      ctx.shadowBlur = 0;
      ctx.font = `500 ${c.fontSizeMetrics * 0.4}px ${c.fontFamily}`;
      ctx.fillStyle = c.primaryColor;
      ctx.fillText(m.l, mx, my + c.fontSizeMetrics * 0.7);
    });
    
    if (c.showTime) {
      const m = Math.floor(meta.elapsed / 60);
      const s = Math.floor(meta.elapsed % 60);
      ctx.shadowColor = c.primaryColor;
      ctx.shadowBlur = 8;
      ctx.font = `600 28px ${c.fontFamily}`;
      ctx.fillStyle = c.primaryColor;
      ctx.textAlign = 'left';
      ctx.fillText(`${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`, 30, 50);
      ctx.shadowBlur = 0;
    }
    
    if (c.showMap && bounds) {
      this.drawMap(ctx, W, H, point, allPoints, currentIndex, bounds);
    }
  }
  
  private drawMap(
    ctx: CanvasRenderingContext2D,
    W: number, H: number,
    point: FitPoint,
    allPoints: FitPoint[],
    currentIndex: number,
    bounds: MapBounds
  ): void {
    const c = this.config;
    const mapW = W * (c.mapWidth / 100);
    const mapH = H * (c.mapHeight / 100);
    const mx = W - mapW - 24;
    const my = H - mapH - 24;
    
    ctx.fillStyle = c.mapBgColor;
    ctx.beginPath();
    ctx.roundRect(mx, my, mapW, mapH, 8);
    ctx.fill();
    
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(mx, my, mapW, mapH, 8);
    ctx.clip();
    
    const latSpan = bounds.maxLat - bounds.minLat || 0.001;
    const lonSpan = bounds.maxLon - bounds.minLon || 0.001;
    const scale = Math.min((mapW - 12) / lonSpan, (mapH - 12) / latSpan);
    const offX = mx + (mapW - lonSpan * scale) / 2;
    const offY = my + (mapH - latSpan * scale) / 2;
    
    const project = (lat: number, lon: number) => ({
      x: offX + (lon - bounds.minLon) * scale,
      y: offY + (bounds.maxLat - lat) * scale
    });
    
    ctx.beginPath();
    ctx.strokeStyle = 'rgba(255,255,255,0.15)';
    ctx.lineWidth = 2;
    let started = false;
    for (const p of allPoints) {
      if (p.lat === null || p.lon === null) continue;
      const pt = project(p.lat, p.lon);
      if (!started) { ctx.moveTo(pt.x, pt.y); started = true; }
      else ctx.lineTo(pt.x, pt.y);
    }
    ctx.stroke();
    
    ctx.shadowColor = c.mapTrackColor;
    ctx.shadowBlur = 8;
    ctx.beginPath();
    ctx.strokeStyle = c.mapTrackColor;
    ctx.lineWidth = c.mapTrackWidth;
    ctx.lineCap = 'round';
    started = false;
    for (let i = 0; i <= currentIndex; i++) {
      const p = allPoints[i];
      if (p.lat === null || p.lon === null) continue;
      const pt = project(p.lat, p.lon);
      if (!started) { ctx.moveTo(pt.x, pt.y); started = true; }
      else ctx.lineTo(pt.x, pt.y);
    }
    ctx.stroke();
    ctx.shadowBlur = 0;
    
    if (point.lat !== null && point.lon !== null) {
      const pt = project(point.lat, point.lon);
      ctx.shadowColor = c.mapCurrentColor;
      ctx.shadowBlur = 15;
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, 6, 0, Math.PI * 2);
      ctx.fillStyle = c.mapCurrentColor;
      ctx.fill();
      ctx.shadowBlur = 0;
    }
    
    ctx.restore();
  }
}
