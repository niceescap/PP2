// ═══════════════════════════════════════════════════════════════
// Skin: Cinematic Dark
// Dark, elegant, film-like — the signature look
// MAP live · Chroma key ready · Fully customizable
// ═══════════════════════════════════════════════════════════════

import { FitPoint, MapBounds } from '../fit/types.js';
import { ISkin, SkinConfig, DEFAULT_CONFIG, CustomizableField } from './types.js';

export class CinematicDark implements ISkin {
  readonly id = 'cinematic-dark';
  readonly name = 'Cinematic Dark';
  readonly description = 'Sombre, élégant, typographie fine — le look signature';
  readonly category = 'cinematic' as const;
  
  config: SkinConfig;
  
  constructor(config?: Partial<SkinConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }
  
  getCustomizableFields(): CustomizableField[] {
    return [
      { key: 'bgMode', label: 'Fond', type: 'select', options: [
        { value: 'green', label: 'Vert Chroma Key' },
        { value: 'transparent', label: 'Transparent' },
        { value: 'black', label: 'Noir' }
      ]},
      { key: 'primaryColor', label: 'Couleur primaire', type: 'color' },
      { key: 'accentColor', label: 'Couleur accent', type: 'color' },
      { key: 'showMap', label: 'Afficher carte', type: 'boolean' },
      { key: 'mapPosition', label: 'Position carte', type: 'select', options: [
        { value: 'bottom-left', label: 'Bas gauche' },
        { value: 'bottom-right', label: 'Bas droite' },
        { value: 'top-left', label: 'Haut gauche' },
        { value: 'top-right', label: 'Haut droite' }
      ]},
      { key: 'mapWidth', label: 'Largeur carte (%)', type: 'range', min: 10, max: 50, step: 1 },
      { key: 'mapHeight', label: 'Hauteur carte (%)', type: 'range', min: 10, max: 50, step: 1 },
      { key: 'mapTrackColor', label: 'Couleur tracé', type: 'color' },
      { key: 'showPower', label: 'Puissance', type: 'boolean' },
      { key: 'showSpeed', label: 'Vitesse', type: 'boolean' },
      { key: 'showHr', label: 'Fréq. cardiaque', type: 'boolean' },
      { key: 'showCadence', label: 'Cadence', type: 'boolean' },
      { key: 'showDistance', label: 'Distance', type: 'boolean' },
      { key: 'showDplus', label: 'Dénivelé', type: 'boolean' },
      { key: 'showTime', label: 'Temps', type: 'boolean' },
      { key: 'fontSizePower', label: 'Taille police puissance', type: 'range', min: 60, max: 200, step: 4 },
      { key: 'fontSizeMetrics', label: 'Taille police metrics', type: 'range', min: 16, max: 64, step: 2 },
    ];
  }
  
  draw(
    ctx: CanvasRenderingContext2D,
    W: number,
    H: number,
    point: FitPoint,
    allPoints: FitPoint[],
    currentIndex: number,
    bounds: MapBounds | null,
    meta: { maxPower: number; maxSpeed: number; maxHr: number; avgPower: number; elapsed: number }
  ): void {
    const c = this.config;
    
    // ── Background ─────────────────────────────
    this.drawBackground(ctx, W, H);
    
    // ── Main Content ───────────────────────────
    const padX = W * 0.06;
    const padY = H * 0.06;
    const contentW = W - padX * 2;
    const contentH = H - padY * 2;
    
    // Power — center stage
    if (c.showPower) {
      this.drawPower(ctx, point.power, meta.avgPower, meta.maxPower, W * 0.5, H * 0.42, c.fontSizePower);
    }
    
    // Metrics row — bottom
    this.drawMetricsRow(ctx, point, meta, padX, H * 0.72, contentW, c.fontSizeMetrics);
    
    // Time elapsed — top right
    if (c.showTime) {
      this.drawTime(ctx, meta.elapsed, W - padX, padY + 20);
    }
    
    // Map overlay
    if (c.showMap && bounds) {
      this.drawMap(ctx, W, H, point, allPoints, currentIndex, bounds);
    }
    
    // ── Vignette ───────────────────────────────
    this.drawVignette(ctx, W, H);
  }
  
  private drawBackground(ctx: CanvasRenderingContext2D, W: number, H: number): void {
    const c = this.config;
    if (c.bgMode === 'green') {
      ctx.fillStyle = c.bgColor;
      ctx.fillRect(0, 0, W, H);
    } else if (c.bgMode === 'black') {
      ctx.fillStyle = '#000000';
      ctx.fillRect(0, 0, W, H);
    }
    // transparent = nothing drawn
  }
  
  private drawPower(
    ctx: CanvasRenderingContext2D,
    power: number,
    avgPower: number,
    maxPower: number,
    cx: number, cy: number,
    fontSize: number
  ): void {
    const c = this.config;
    
    // Gauge arc background
    const radius = fontSize * 0.9;
    const startAngle = 0.75 * Math.PI;
    const endAngle = 2.25 * Math.PI;
    
    ctx.beginPath();
    ctx.arc(cx, cy, radius, startAngle, endAngle);
    ctx.strokeStyle = c.gaugeBgColor;
    ctx.lineWidth = 6;
    ctx.lineCap = 'round';
    ctx.stroke();
    
    // Gauge arc fill
    if (maxPower > 0 && power > 0) {
      const ratio = Math.min(1, power / maxPower);
      const fillEnd = startAngle + ratio * 1.5 * Math.PI;
      ctx.beginPath();
      ctx.arc(cx, cy, radius, startAngle, fillEnd);
      ctx.strokeStyle = c.gaugeFillColor;
      ctx.lineWidth = 6;
      ctx.lineCap = 'round';
      ctx.stroke();
    }
    
    // Power value
    ctx.font = `700 ${fontSize}px ${c.fontFamily}`;
    ctx.fillStyle = c.primaryColor;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(Math.round(power).toString(), cx, cy - fontSize * 0.05);
    
    // Unit
    ctx.font = `500 ${fontSize * 0.22}px ${c.fontFamily}`;
    ctx.fillStyle = c.secondaryColor;
    ctx.fillText('WATTS', cx, cy + fontSize * 0.32);
    
    // Avg indicator
    if (avgPower > 0) {
      ctx.font = `400 ${fontSize * 0.14}px ${c.fontFamily}`;
      ctx.fillStyle = c.accentColor;
      ctx.fillText(`AVG ${Math.round(avgPower)}W`, cx, cy + fontSize * 0.52);
    }
  }
  
  private drawMetricsRow(
    ctx: CanvasRenderingContext2D,
    point: FitPoint,
    meta: { maxSpeed: number; maxHr: number },
    x: number, y: number, width: number,
    fontSize: number
  ): void {
    const c = this.config;
    const metrics: Array<{ label: string; value: string; color: string }> = [];
    
    if (c.showSpeed) metrics.push({ label: 'VITESSE', value: `${point.speed.toFixed(1)}`, color: c.primaryColor });
    if (c.showHr) metrics.push({ label: 'FC', value: `${point.hr}`, color: '#ff4466' });
    if (c.showCadence) metrics.push({ label: 'CAD', value: `${point.cad}`, color: c.accentColor });
    if (c.showDistance) metrics.push({ label: 'DIST', value: `${(point.distance/1000).toFixed(1)}km`, color: c.primaryColor });
    if (c.showDplus) metrics.push({ label: 'D+', value: `${Math.round(point.dplus)}m`, color: '#ffd600' });
    
    if (metrics.length === 0) return;
    
    const colW = width / metrics.length;
    
    metrics.forEach((m, i) => {
      const mx = x + colW * i + colW / 2;
      
      // Value
      ctx.font = `700 ${fontSize}px ${c.fontFamily}`;
      ctx.fillStyle = m.color;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(m.value, mx, y);
      
      // Label
      ctx.font = `500 ${fontSize * 0.35}px ${c.fontFamily}`;
      ctx.fillStyle = c.secondaryColor;
      ctx.fillText(m.label, mx, y + fontSize * 0.65);
    });
  }
  
  private drawTime(ctx: CanvasRenderingContext2D, elapsed: number, x: number, y: number): void {
    const c = this.config;
    const h = Math.floor(elapsed / 3600);
    const m = Math.floor((elapsed % 3600) / 60);
    const s = Math.floor(elapsed % 60);
    const timeStr = h > 0 
      ? `${h}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`
      : `${m}:${String(s).padStart(2,'0')}`;
    
    ctx.font = `500 28px ${c.fontFamily}`;
    ctx.fillStyle = c.secondaryColor;
    ctx.textAlign = 'right';
    ctx.textBaseline = 'top';
    ctx.fillText(timeStr, x, y);
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
    
    // Calculate map area
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
    
    // Map background
    ctx.save();
    ctx.globalAlpha = c.mapOpacity;
    ctx.fillStyle = c.mapBgColor;
    ctx.beginPath();
    ctx.roundRect(mx, my, mapW, mapH, 8);
    ctx.fill();
    
    // Clip to map area
    ctx.beginPath();
    ctx.roundRect(mx, my, mapW, mapH, 8);
    ctx.clip();
    
    // Project coordinates
    const latSpan = bounds.maxLat - bounds.minLat || 0.001;
    const lonSpan = bounds.maxLon - bounds.minLon || 0.001;
    const scale = Math.min((mapW - 16) / lonSpan, (mapH - 16) / latSpan);
    const offX = mx + (mapW - lonSpan * scale) / 2;
    const offY = my + (mapH - latSpan * scale) / 2;
    
    const project = (lat: number, lon: number) => ({
      x: offX + (lon - bounds.minLon) * scale,
      y: offY + (bounds.maxLat - lat) * scale
    });
    
    // Full track (dim)
    ctx.beginPath();
    ctx.strokeStyle = 'rgba(255,255,255,0.2)';
    ctx.lineWidth = c.mapTrackWidth * 0.6;
    let started = false;
    for (const p of allPoints) {
      if (p.lat === null || p.lon === null) continue;
      const pt = project(p.lat, p.lon);
      if (!started) { ctx.moveTo(pt.x, pt.y); started = true; }
      else ctx.lineTo(pt.x, pt.y);
    }
    ctx.stroke();
    
    // Completed track (bright)
    ctx.beginPath();
    ctx.strokeStyle = c.mapTrackColor;
    ctx.lineWidth = c.mapTrackWidth;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    started = false;
    for (let i = 0; i <= currentIndex; i++) {
      const p = allPoints[i];
      if (p.lat === null || p.lon === null) continue;
      const pt = project(p.lat, p.lon);
      if (!started) { ctx.moveTo(pt.x, pt.y); started = true; }
      else ctx.lineTo(pt.x, pt.y);
    }
    ctx.stroke();
    
    // Current position dot
    if (point.lat !== null && point.lon !== null) {
      const pt = project(point.lat, point.lon);
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, 6, 0, Math.PI * 2);
      ctx.fillStyle = c.mapCurrentColor;
      ctx.fill();
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, 10, 0, Math.PI * 2);
      ctx.strokeStyle = c.mapTrackColor;
      ctx.lineWidth = 2;
      ctx.stroke();
    }
    
    ctx.restore();
  }
  
  private drawVignette(ctx: CanvasRenderingContext2D, W: number, H: number): void {
    if (this.config.bgMode !== 'black') return;
    const gradient = ctx.createRadialGradient(W/2, H/2, W*0.3, W/2, H/2, W*0.7);
    gradient.addColorStop(0, 'rgba(0,0,0,0)');
    gradient.addColorStop(1, 'rgba(0,0,0,0.4)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, W, H);
  }
}
