// ═══════════════════════════════════════════════════════════════
// Skin: Glassmorphism
// Translucide, flottant, iOS/macOS aesthetic
// MAP live panels · Chroma ready · User-customizable
// ═══════════════════════════════════════════════════════════════

import { FitPoint, MapBounds } from '../fit/types.js';
import { ISkin, SkinConfig, CustomizableField } from './types.js';

const GLASS_DEFAULTS: Partial<SkinConfig> = {
  bgMode: 'green',
  primaryColor: '#ffffff',
  secondaryColor: 'rgba(255,255,255,0.7)',
  accentColor: '#00e5ff',
  gaugeBgColor: 'rgba(255,255,255,0.12)',
  gaugeFillColor: '#00e5ff',
  fontFamily: "'Inter', sans-serif",
  fontSizePower: 100,
  fontSizeMetrics: 28,
  mapBgColor: 'rgba(0,0,0,0.3)',
  mapTrackColor: '#00e5ff',
};

export class Glassmorphism implements ISkin {
  readonly id = 'glassmorphism';
  readonly name = 'Glass';
  readonly description = 'Translucide, flottant, iOS-style';
  readonly category = 'moderne' as const;
  
  config: SkinConfig;
  
  constructor(config?: Partial<SkinConfig>) {
    this.config = { ...this.getDefaultConfig(), ...config };
  }
  
  private getDefaultConfig(): SkinConfig {
    const { DEFAULT_CONFIG } = require('./types.js');
    return { ...DEFAULT_CONFIG, ...GLASS_DEFAULTS } as SkinConfig;
  }
  
  getCustomizableFields(): CustomizableField[] {
    const base = new (Object.getPrototypeOf(this.constructor) as any)();
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
      { key: 'showTime', label: 'Temps', type: 'boolean' },
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
    
    // Background
    if (c.bgMode === 'green') {
      ctx.fillStyle = c.bgColor;
      ctx.fillRect(0, 0, W, H);
    }
    
    const padX = W * 0.07;
    const padY = H * 0.08;
    
    // Glass panel — power
    if (c.showPower) {
      const panelW = W * 0.42;
      const panelH = H * 0.44;
      const px = (W - panelW) / 2;
      const py = padY;
      
      // Glass panel background
      ctx.save();
      ctx.globalAlpha = 0.85;
      ctx.fillStyle = 'rgba(255,255,255,0.08)';
      ctx.beginPath();
      ctx.roundRect(px, py, panelW, panelH, 20);
      ctx.fill();
      // Glass border
      ctx.globalAlpha = 0.4;
      ctx.strokeStyle = 'rgba(255,255,255,0.2)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.roundRect(px, py, panelW, panelH, 20);
      ctx.stroke();
      ctx.restore();
      
      // Power value
      const pcx = px + panelW / 2;
      const pcy = py + panelH * 0.45;
      
      ctx.font = `800 ${c.fontSizePower}px ${c.fontFamily}`;
      ctx.fillStyle = c.primaryColor;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(Math.round(point.power).toString(), pcx, pcy);
      
      ctx.font = `500 ${c.fontSizeMetrics * 0.7}px ${c.fontFamily}`;
      ctx.fillStyle = c.secondaryColor;
      ctx.fillText('WATTS', pcx, pcy + c.fontSizePower * 0.45);
      
      // Avg line
      const avgY = py + panelH * 0.78;
      const avgW = panelW * 0.6;
      const avgX = px + (panelW - avgW) / 2;
      
      ctx.fillStyle = c.gaugeBgColor;
      ctx.beginPath();
      ctx.roundRect(avgX, avgY, avgW, 4, 2);
      ctx.fill();
      
      if (meta.maxPower > 0 && meta.avgPower > 0) {
        const avgRatio = meta.avgPower / meta.maxPower;
        ctx.fillStyle = c.gaugeFillColor;
        ctx.beginPath();
        ctx.roundRect(avgX, avgY, avgW * avgRatio, 4, 2);
        ctx.fill();
      }
      
      ctx.font = `500 ${c.fontSizeMetrics * 0.55}px ${c.fontFamily}`;
      ctx.fillStyle = c.accentColor;
      ctx.fillText(`AVG ${Math.round(meta.avgPower)}W`, pcx, avgY + 18);
    }
    
    // Glass panel — metrics grid
    this.drawMetricsGrid(ctx, point, meta, padX, H * 0.62, W - padX * 2, c.fontSizeMetrics);
    
    // Time
    if (c.showTime) {
      this.drawTime(ctx, meta.elapsed, W - padX, padY + 10);
    }
    
    // Map
    if (c.showMap && bounds) {
      this.drawMap(ctx, W, H, point, allPoints, currentIndex, bounds);
    }
  }
  
  private drawMetricsGrid(
    ctx: CanvasRenderingContext2D,
    point: FitPoint,
    meta: { maxSpeed: number; maxHr: number },
    x: number, y: number, width: number, fontSize: number
  ): void {
    const c = this.config;
    const metrics: Array<{ label: string; value: string; color: string }> = [];
    
    if (c.showSpeed) metrics.push({ label: 'SPEED', value: `${point.speed.toFixed(1)} km/h`, color: c.primaryColor });
    if (c.showHr) metrics.push({ label: 'HEART', value: `${point.hr} bpm`, color: '#ff6b9d' });
    if (c.showCadence) metrics.push({ label: 'CADENCE', value: `${point.cad} rpm`, color: c.accentColor });
    if (c.showDistance) metrics.push({ label: 'DIST', value: `${(point.distance/1000).toFixed(1)} km`, color: c.primaryColor });
    
    if (metrics.length === 0) return;
    
    const cols = Math.min(metrics.length, 2);
    const colW = width / cols;
    const rowH = fontSize * 2.8;
    
    metrics.forEach((m, i) => {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const mx = x + col * colW;
      const my = y + row * rowH;
      
      // Mini glass panel
      ctx.save();
      ctx.globalAlpha = 0.7;
      ctx.fillStyle = 'rgba(255,255,255,0.05)';
      ctx.beginPath();
      ctx.roundRect(mx + 4, my, colW - 8, rowH - 8, 12);
      ctx.fill();
      ctx.restore();
      
      ctx.font = `600 ${fontSize}px ${c.fontFamily}`;
      ctx.fillStyle = m.color;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(m.value, mx + colW / 2, my + rowH * 0.4);
      
      ctx.font = `500 ${fontSize * 0.4}px ${c.fontFamily}`;
      ctx.fillStyle = c.secondaryColor;
      ctx.fillText(m.label, mx + colW / 2, my + rowH * 0.72);
    });
  }
  
  private drawTime(ctx: CanvasRenderingContext2D, elapsed: number, x: number, y: number): void {
    const c = this.config;
    const m = Math.floor(elapsed / 60);
    const s = Math.floor(elapsed % 60);
    ctx.font = `500 24px ${c.fontFamily}`;
    ctx.fillStyle = c.secondaryColor;
    ctx.textAlign = 'right';
    ctx.textBaseline = 'top';
    ctx.fillText(`${m}:${String(s).padStart(2,'0')}`, x, y);
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
    const pad = 24;
    let mx: number, my: number;
    
    switch (c.mapPosition) {
      case 'bottom-left': mx = pad; my = H - mapH - pad; break;
      case 'bottom-right': mx = W - mapW - pad; my = H - mapH - pad; break;
      case 'top-left': mx = pad; my = pad; break;
      case 'top-right': mx = W - mapW - pad; my = pad; break;
      default: mx = W - mapW - pad; my = H - mapH - pad;
    }
    
    // Glass map panel
    ctx.save();
    ctx.globalAlpha = c.mapOpacity;
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
    
    // Full track
    ctx.beginPath();
    ctx.strokeStyle = 'rgba(255,255,255,0.15)';
    ctx.lineWidth = c.mapTrackWidth * 0.5;
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
