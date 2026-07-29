// ═══════════════════════════════════════════════════════════════
// Skin: Apple Minimal
// Clean, bright, premium — light theme overlay
// MAP light · White translucent panels · CapCut chroma ready
// ═══════════════════════════════════════════════════════════════

import { FitPoint, MapBounds } from '../fit/types.js';
import { ISkin, SkinConfig, DEFAULT_CONFIG, CustomizableField } from './types.js';

const APPLE_DEFAULTS: Partial<SkinConfig> = {
  bgMode: 'green',
  bgColor: '#00ff66',
  primaryColor: '#1d1d1f',
  secondaryColor: '#86868b',
  accentColor: '#0071e3',
  textColor: '#1d1d1f',
  gaugeBgColor: 'rgba(0,0,0,0.08)',
  gaugeFillColor: '#0071e3',
  fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
  fontSizePower: 110,
  fontSizeMetrics: 26,
  mapBgColor: 'rgba(255,255,255,0.6)',
  mapTrackColor: '#0071e3',
  mapCurrentColor: '#1d1d1f',
};

export class AppleMinimal implements ISkin {
  readonly id = 'apple-minimal';
  readonly name = 'Minimal';
  readonly description = 'Épuré, clair, premium';
  readonly category = 'épuré' as const;
  
  config: SkinConfig;
  
  constructor(config?: Partial<SkinConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...APPLE_DEFAULTS, ...config } as SkinConfig;
  }
  
  getCustomizableFields(): CustomizableField[] {
    return [
      { key: 'bgMode', label: 'Fond', type: 'select', options: [
        { value: 'green', label: 'Vert Chroma' },
        { value: 'transparent', label: 'Transparent' },
        { value: 'black', label: 'Noir' }
      ]},
      { key: 'primaryColor', label: 'Couleur texte', type: 'color' },
      { key: 'accentColor', label: 'Couleur accent', type: 'color' },
      { key: 'showMap', label: 'Carte', type: 'boolean' },
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
      ctx.fillStyle = c.bgColor;
      ctx.fillRect(0, 0, W, H);
    } else if (c.bgMode === 'black') {
      ctx.fillStyle = '#000000';
      ctx.fillRect(0, 0, W, H);
    }
    
    const padX = W * 0.08;
    const padY = H * 0.1;
    
    const pcx = W * 0.5;
    const pcy = H * 0.42;
    
    const r = c.fontSizePower * 0.7;
    ctx.beginPath();
    ctx.arc(pcx, pcy, r, 0, Math.PI * 2);
    ctx.strokeStyle = c.gaugeBgColor;
    ctx.lineWidth = 4;
    ctx.stroke();
    
    if (meta.maxPower > 0 && point.power > 0) {
      const ratio = Math.min(1, point.power / meta.maxPower);
      ctx.beginPath();
      ctx.arc(pcx, pcy, r, -Math.PI/2, -Math.PI/2 + ratio * Math.PI * 2);
      ctx.strokeStyle = c.gaugeFillColor;
      ctx.lineWidth = 4;
      ctx.lineCap = 'round';
      ctx.stroke();
    }
    
    ctx.font = `700 ${c.fontSizePower}px ${c.fontFamily}`;
    ctx.fillStyle = c.primaryColor;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(Math.round(point.power).toString(), pcx, pcy - 8);
    
    ctx.font = `400 ${c.fontSizePower * 0.16}px ${c.fontFamily}`;
    ctx.fillStyle = c.secondaryColor;
    ctx.fillText('watts', pcx, pcy + c.fontSizePower * 0.38);
    
    const metrics: Array<{ v: string; l: string }> = [];
    if (c.showSpeed) metrics.push({ v: `${point.speed.toFixed(1)}`, l: 'km/h' });
    if (c.showHr) metrics.push({ v: `${point.hr}`, l: 'bpm' });
    if (c.showCadence) metrics.push({ v: `${point.cad}`, l: 'rpm' });
    if (c.showDistance) metrics.push({ v: `${(point.distance/1000).toFixed(1)}`, l: 'km' });
    
    const colW = (W - padX * 2) / metrics.length;
    metrics.forEach((m, i) => {
      const mx = padX + colW * i + colW / 2;
      const my = H * 0.74;
      ctx.font = `600 ${c.fontSizeMetrics}px ${c.fontFamily}`;
      ctx.fillStyle = c.primaryColor;
      ctx.textAlign = 'center';
      ctx.fillText(m.v, mx, my);
      ctx.font = `400 ${c.fontSizeMetrics * 0.45}px ${c.fontFamily}`;
      ctx.fillStyle = c.secondaryColor;
      ctx.fillText(m.l, mx, my + c.fontSizeMetrics * 0.7);
    });
    
    if (c.showTime) {
      const m = Math.floor(meta.elapsed / 60);
      const s = Math.floor(meta.elapsed % 60);
      ctx.font = `500 22px ${c.fontFamily}`;
      ctx.fillStyle = c.secondaryColor;
      ctx.textAlign = 'right';
      ctx.fillText(`${m}:${String(s).padStart(2,'0')}`, W - padX, padY + 10);
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
    
    ctx.save();
    ctx.globalAlpha = 0.85;
    ctx.fillStyle = c.mapBgColor;
    ctx.beginPath();
    ctx.roundRect(mx, my, mapW, mapH, 12);
    ctx.fill();
    ctx.restore();
    
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(mx, my, mapW, mapH, 12);
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
    ctx.strokeStyle = 'rgba(0,0,0,0.15)';
    ctx.lineWidth = 2;
    let started = false;
    for (const p of allPoints) {
      if (p.lat === null || p.lon === null) continue;
      const pt = project(p.lat, p.lon);
      if (!started) { ctx.moveTo(pt.x, pt.y); started = true; }
      else ctx.lineTo(pt.x, pt.y);
    }
    ctx.stroke();
    
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
    
    if (point.lat !== null && point.lon !== null) {
      const pt = project(point.lat, point.lon);
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, 5, 0, Math.PI * 2);
      ctx.fillStyle = c.mapCurrentColor;
      ctx.fill();
    }
    
    ctx.restore();
  }
}
