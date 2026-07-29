// ═══════════════════════════════════════════════════════════════
// Skin: Data Dashboard
// Dense, pro — all metrics visible, GitHub-dark inspired
// MAP mini · Bars · Gauges · Maximized info density
// ═══════════════════════════════════════════════════════════════

import { FitPoint, MapBounds } from '../fit/types.js';
import { ISkin, SkinConfig, CustomizableField } from './types.js';

const DASH_DEFAULTS: Partial<SkinConfig> = {
  bgMode: 'green',
  bgColor: '#00ff66',
  primaryColor: '#e6edf3',
  secondaryColor: '#8b949e',
  accentColor: '#58a6ff',
  textColor: '#e6edf3',
  gaugeBgColor: 'rgba(255,255,255,0.08)',
  gaugeFillColor: '#58a6ff',
  fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
  fontSizePower: 80,
  fontSizeMetrics: 22,
  mapBgColor: 'rgba(13,17,23,0.7)',
  mapTrackColor: '#58a6ff',
  mapCurrentColor: '#f0f6fc',
  secondaryColor: '#8b949e',
};

export class DataDashboard implements ISkin {
  readonly id = 'data-dashboard';
  readonly name = 'Dashboard';
  readonly description = 'Dense, pro, données complètes';
  readonly category = 'professionnel' as const;
  
  config: SkinConfig;
  
  constructor(config?: Partial<SkinConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...DASH_DEFAULTS, ...config } as SkinConfig;
  }
  
  getCustomizableFields(): CustomizableField[] {
    return [
      { key: 'bgMode', label: 'Fond', type: 'select', options: [
        { value: 'green', label: 'Vert Chroma' },
        { value: 'black', label: 'Noir' },
        { value: 'transparent', label: 'Transparent' }
      ]},
      { key: 'primaryColor', label: 'Texte principal', type: 'color' },
      { key: 'accentColor', label: 'Accent', type: 'color' },
      { key: 'showMap', label: 'Mini-carte', type: 'boolean' },
      { key: 'showPower', label: 'Puissance', type: 'boolean' },
      { key: 'showSpeed', label: 'Vitesse', type: 'boolean' },
      { key: 'showHr', label: 'FC', type: 'boolean' },
      { key: 'showCadence', label: 'Cadence', type: 'boolean' },
      { key: 'showDistance', label: 'Distance', type: 'boolean' },
      { key: 'showDplus', label: 'Dénivelé', type: 'boolean' },
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
      ctx.fillStyle = '#010409';
      ctx.fillRect(0, 0, W, H);
    }
    
    const padX = 40;
    const padY = 50;
    
    // ── Top row: Power big + bar gauges ──
    const topH = H * 0.45;
    
    // Power number
    ctx.font = `800 ${c.fontSizePower}px ${c.fontFamily}`;
    ctx.fillStyle = c.primaryColor;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText(Math.round(point.power).toString(), padX, padY);
    
    // WATTS label
    const pw = ctx.measureText(Math.round(point.power).toString()).width;
    ctx.font = `500 ${c.fontSizePower * 0.2}px ${c.fontFamily}`;
    ctx.fillStyle = c.accentColor;
    ctx.fillText('WATTS', padX, padY + c.fontSizePower * 1.05);
    
    // AVG / MAX bars
    const barX = padX + pw + 50;
    const barW = W * 0.25;
    const barY = padY + 10;
    const barH = 14;
    
    this.drawBarGauge(ctx, 'AVG', meta.avgPower, meta.maxPower, barX, barY, barW, barH, c.gaugeFillColor);
    this.drawBarGauge(ctx, 'MAX', meta.maxPower, meta.maxPower, barX, barY + 45, barW, barH, '#f0883e');
    
    // FC gauge bar
    if (meta.maxHr > 0 && c.showHr) {
      this.drawBarGauge(ctx, 'HR', point.hr, meta.maxHr, barX, barY + 90, barW, barH, '#ff7b72');
    }
    
    // ── Right column: metrics grid ──
    const rightX = W * 0.62;
    const rightW = W * 0.34;
    const colPad = 16;
    
    const metrics: Array<{ l: string; v: string; unit: string }> = [];
    if (c.showSpeed) metrics.push({ l: 'SPEED', v: point.speed.toFixed(1), unit: 'km/h' });
    if (c.showCadence) metrics.push({ l: 'CAD', v: `${point.cad}`, unit: 'rpm' });
    if (c.showDistance) metrics.push({ l: 'DIST', v: (point.distance/1000).toFixed(1), unit: 'km' });
    if (c.showDplus) metrics.push({ l: 'D+', v: `${Math.round(point.dplus)}`, unit: 'm' });
    if (c.showPente && point.pente !== null) metrics.push({ l: 'GRADE', v: point.pente.toFixed(1), unit: '%' });
    
    const cellH = 48;
    metrics.forEach((m, i) => {
      const my = padY + i * (cellH + colPad);
      
      // Value
      ctx.font = `700 32px ${c.fontFamily}`;
      ctx.fillStyle = c.primaryColor;
      ctx.textAlign = 'right';
      ctx.textBaseline = 'top';
      ctx.fillText(m.v, rightX + rightW, my);
      
      // Unit
      ctx.font = `500 14px ${c.fontFamily}`;
      ctx.fillStyle = c.secondaryColor;
      ctx.fillText(m.unit, rightX + rightW, my + 36);
      
      // Label
      ctx.font = `600 12px ${c.fontFamily}`;
      ctx.fillStyle = c.accentColor;
      ctx.textAlign = 'left';
      ctx.fillText(m.l, rightX, my + 6);
    });
    
    // Time — bottom right
    if (c.showTime) {
      const h = Math.floor(meta.elapsed / 3600);
      const m = Math.floor((meta.elapsed % 3600) / 60);
      const s = Math.floor(meta.elapsed % 60);
      const timeStr = h > 0
        ? `${h}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`
        : `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
      ctx.font = `600 28px ${c.fontFamily}`;
      ctx.fillStyle = c.primaryColor;
      ctx.textAlign = 'right';
      ctx.textBaseline = 'bottom';
      ctx.fillText(timeStr, W - padX, H - padY);
    }
    
    // Map — bottom left
    if (c.showMap && bounds) {
      this.drawMap(ctx, W, H, point, allPoints, currentIndex, bounds);
    }
  }
  
  private drawBarGauge(
    ctx: CanvasRenderingContext2D,
    label: string,
    value: number,
    max: number,
    x: number, y: number, w: number, h: number,
    color: string
  ): void {
    const c = this.config;
    // Label
    ctx.font = `600 11px ${c.fontFamily}`;
    ctx.fillStyle = c.secondaryColor;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText(label, x, y - 16);
    
    // BG
    ctx.fillStyle = c.gaugeBgColor;
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, 3);
    ctx.fill();
    
    // Fill
    if (max > 0 && value > 0) {
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.roundRect(x, y, Math.min(w, (value / max) * w), h, 3);
      ctx.fill();
    }
    
    // Value text
    ctx.font = `600 12px ${c.fontFamily}`;
    ctx.fillStyle = c.primaryColor;
    ctx.textAlign = 'right';
    ctx.fillText(Math.round(value).toString(), x + w, y - 16);
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
    const mx = 30;
    const my = H - mapH - 30;
    
    ctx.fillStyle = 'rgba(13,17,23,0.8)';
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
    
    // Full track
    ctx.beginPath();
    ctx.strokeStyle = 'rgba(255,255,255,0.12)';
    ctx.lineWidth = 1.5;
    let started = false;
    for (const p of allPoints) {
      if (p.lat === null || p.lon === null) continue;
      const pt = project(p.lat, p.lon);
      if (!started) { ctx.moveTo(pt.x, pt.y); started = true; }
      else ctx.lineTo(pt.x, pt.y);
    }
    ctx.stroke();
    
    // Completed track
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
    
    // Current dot
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
