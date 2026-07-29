// ═══════════════════════════════════════════════════════════════
// Overlay Blocks — fully customizable data blocks
// Each block: position, size, color, visible, label
// Drag & drop + resize support for full personalization
// ═══════════════════════════════════════════════════════════════

import { FitPoint, MapBounds } from './fit/types.js';

export type BlockType = 'power' | 'speed' | 'hr' | 'cadence' | 'distance' | 'dplus' | 'time' | 'map';

export interface BlockStyle {
  bgColor: string;
  textColor: string;
  accentColor: string;
  fontSize: number;
  labelSize: number;
  borderRadius: number;
  showLabel: boolean;
  unit: string;
  decimals: number;
}

export interface Block {
  id: string;
  type: BlockType;
  label: string;
  x: number;
  y: number;
  w: number;
  h: number;
  visible: boolean;
  style: BlockStyle;
}

export interface OverlayConfig {
  width: number;
  height: number;
  bgColor: string;
  bgMode: 'green' | 'transparent' | 'black';
  blocks: Block[];
}

const DEFAULT_STYLE: BlockStyle = {
  bgColor: 'rgba(0,0,0,0.7)',
  textColor: '#ffffff',
  accentColor: '#00e5ff',
  fontSize: 56,
  labelSize: 12,
  borderRadius: 6,
  showLabel: true,
  unit: '',
  decimals: 0,
};

export function createDefaultConfig(width: number, height: number): OverlayConfig {
  const w = width;
  const pad = 24;
  const bw = 200;
  const bh = 100;

  return {
    width,
    height,
    bgColor: '#00ff66',
    bgMode: 'green',
    blocks: [
      {
        id: 'power', type: 'power', label: 'WATTS',
        x: pad, y: pad, w: bw, h: bh,
        visible: true,
        style: { ...DEFAULT_STYLE, unit: 'W', accentColor: '#ffd600', fontSize: 64 },
      },
      {
        id: 'speed', type: 'speed', label: 'VITESSE',
        x: pad * 2 + bw, y: pad, w: bw, h: bh,
        visible: true,
        style: { ...DEFAULT_STYLE, unit: 'km/h', decimals: 1, accentColor: '#00e5ff' },
      },
      {
        id: 'hr', type: 'hr', label: 'FRÉQ. CARD.',
        x: pad, y: pad * 2 + bh, w: bw, h: bh,
        visible: true,
        style: { ...DEFAULT_STYLE, unit: 'bpm', accentColor: '#ff4444' },
      },
      {
        id: 'cadence', type: 'cadence', label: 'CADENCE',
        x: pad * 2 + bw, y: pad * 2 + bh, w: bw, h: bh,
        visible: true,
        style: { ...DEFAULT_STYLE, unit: 'rpm', accentColor: '#00ff88' },
      },
      {
        id: 'distance', type: 'distance', label: 'DISTANCE',
        x: pad, y: pad * 3 + bh * 2, w: bw, h: bh,
        visible: true,
        style: { ...DEFAULT_STYLE, unit: 'km', decimals: 2, accentColor: '#ff8800' },
      },
      {
        id: 'dplus', type: 'dplus', label: 'D+',
        x: pad * 2 + bw, y: pad * 3 + bh * 2, w: bw, h: bh,
        visible: true,
        style: { ...DEFAULT_STYLE, unit: 'm', accentColor: '#cc66ff' },
      },
      {
        id: 'time', type: 'time', label: 'TEMPS',
        x: w - bw - pad, y: pad, w: bw, h: bh,
        visible: true,
        style: { ...DEFAULT_STYLE, unit: '', accentColor: '#ffffff' },
      },
      {
        id: 'map', type: 'map', label: 'TRACE GPS',
        x: w - bw * 2 - pad * 2, y: pad * 2 + bh, w: bw * 2 + pad, h: bh + pad,
        visible: true,
        style: { ...DEFAULT_STYLE, accentColor: '#00e5ff' },
      },
    ],
  };
}

export function drawOverlay(
  ctx: CanvasRenderingContext2D,
  config: OverlayConfig,
  point: FitPoint,
  allPoints: FitPoint[],
  currentIndex: number,
  bounds: MapBounds | null
): void {
  const { width: W, height: H } = config;

  // Background
  if (config.bgMode === 'transparent') {
    ctx.clearRect(0, 0, W, H);
  } else {
    ctx.fillStyle = config.bgColor;
    ctx.fillRect(0, 0, W, H);
  }

  // Blocks
  for (const block of config.blocks) {
    if (!block.visible) continue;
    drawBlock(ctx, block, point, allPoints, currentIndex, bounds);
  }
}

function drawBlock(
  ctx: CanvasRenderingContext2D,
  block: Block,
  point: FitPoint,
  allPoints: FitPoint[],
  currentIndex: number,
  bounds: MapBounds | null
): void {
  const { x, y, w, h, type, label, style } = block;

  // Background
  if (style.bgColor !== 'transparent') {
    ctx.save();
    ctx.fillStyle = style.bgColor;
    ctx.beginPath();
    if (ctx.roundRect) {
      ctx.roundRect(x, y, w, h, style.borderRadius);
    } else {
      ctx.rect(x, y, w, h);
    }
    ctx.fill();
    // Accent top bar
    ctx.fillStyle = style.accentColor;
    if (ctx.roundRect) {
      ctx.beginPath();
      ctx.roundRect(x, y, w, 3, style.borderRadius);
      ctx.fill();
    } else {
      ctx.fillRect(x, y, w, 3);
    }
    ctx.restore();
  }

  // Value
  let valueStr = '--';
  switch (type) {
    case 'power':
      valueStr = Math.round(point.power || 0).toString();
      break;
    case 'speed':
      valueStr = (point.speed || 0).toFixed(style.decimals);
      break;
    case 'hr':
      valueStr = Math.round(point.hr || 0).toString();
      break;
    case 'cadence':
      valueStr = Math.round(point.cad || 0).toString();
      break;
    case 'distance':
      valueStr = ((point.distance || 0) / 1000).toFixed(style.decimals);
      break;
    case 'dplus':
      valueStr = Math.round(point.dplus || 0).toString();
      break;
    case 'time': {
      const e = point.elapsed || 0;
      const hh = Math.floor(e / 3600);
      const mm = Math.floor((e % 3600) / 60);
      const ss = Math.floor(e % 60);
      valueStr = hh > 0
        ? `${hh}:${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`
        : `${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`;
      break;
    }
    case 'map':
      if (bounds) drawMapMini(ctx, x, y, w, h, point, allPoints, currentIndex, bounds, style.accentColor, label, style);
      return;
  }

  // Label
  if (style.showLabel) {
    ctx.font = `600 ${style.labelSize}px 'Inter', sans-serif`;
    ctx.fillStyle = style.accentColor;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText(label, x + w / 2, y + 8);
  }

  // Value
  ctx.fillStyle = style.textColor;
  ctx.font = `800 ${style.fontSize}px 'JetBrains Mono', monospace`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(valueStr, x + w / 2, y + h / 2 + 4);

  // Unit
  if (style.unit) {
    ctx.font = `500 ${style.labelSize}px 'Inter', sans-serif`;
    ctx.fillStyle = style.accentColor;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.fillText(style.unit, x + w / 2, y + h - 6);
  }
}

function drawMapMini(
  ctx: CanvasRenderingContext2D,
  bx: number, by: number, bw: number, bh: number,
  point: FitPoint,
  allPoints: FitPoint[],
  currentIndex: number,
  bounds: MapBounds,
  accent: string,
  label: string,
  style: BlockStyle
): void {
  const pad = 8;
  const drawW = bw - pad * 2;
  const drawH = bh - pad * 2 - 14;
  const ox = bx + pad;
  const oy = by + 16;

  // Label
  if (style.showLabel) {
    ctx.font = `600 ${style.labelSize}px 'Inter', sans-serif`;
    ctx.fillStyle = accent;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText(label, bx + bw / 2, by + 4);
  }

  ctx.save();
  ctx.beginPath();
  ctx.rect(ox, oy, drawW, drawH);
  ctx.clip();

  const latSpan = bounds.maxLat - bounds.minLat || 0.001;
  const lonSpan = bounds.maxLon - bounds.minLon || 0.001;
  const scale = Math.min(drawW / lonSpan, drawH / latSpan);
  const offX = ox + (drawW - lonSpan * scale) / 2;
  const offY = oy + (drawH - latSpan * scale) / 2;

  const project = (lat: number, lon: number) => ({
    x: offX + (lon - bounds.minLon) * scale,
    y: offY + (bounds.maxLat - lat) * scale,
  });

  // Full track
  ctx.beginPath();
  ctx.strokeStyle = 'rgba(255,255,255,0.15)';
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
  ctx.strokeStyle = accent;
  ctx.lineWidth = 2.5;
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
    ctx.fillStyle = accent;
    ctx.fill();
    ctx.beginPath();
    ctx.arc(pt.x, pt.y, 2.5, 0, Math.PI * 2);
    ctx.fillStyle = '#000';
    ctx.fill();
  }

  ctx.restore();
}
