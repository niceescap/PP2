// ═══════════════════════════════════════════════════════════════
// Skin System Types
// Each skin is a class implementing ISkin — fully customizable
// ═══════════════════════════════════════════════════════════════

import { FitPoint, MapBounds } from '../fit/types.js';

export interface SkinConfig {
  // Background
  bgMode: 'green' | 'transparent' | 'black';
  bgColor: string;
  
  // Map
  showMap: boolean;
  mapPosition: 'bottom-left' | 'bottom-right' | 'top-left' | 'top-right' | 'center';
  mapWidth: number;   // % of canvas width
  mapHeight: number;  // % of canvas height
  mapOpacity: number;
  mapBgColor: string;
  mapTrackColor: string;
  mapTrackWidth: number;
  mapCurrentColor: string;
  
  // Metrics
  showPower: boolean;
  showSpeed: boolean;
  showHr: boolean;
  showCadence: boolean;
  showDistance: boolean;
  showDplus: boolean;
  showPente: boolean;
  showTime: boolean;
  
  // Colors
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  textColor: string;
  gaugeBgColor: string;
  gaugeFillColor: string;
  
  // Layout
  powerPosition: 'center' | 'left' | 'right';
  metricsLayout: 'horizontal' | 'vertical' | 'grid';
  
  // Fonts
  fontFamily: string;
  fontSizePower: number;   // px
  fontSizeMetrics: number; // px
}

export const DEFAULT_CONFIG: SkinConfig = {
  bgMode: 'green',
  bgColor: '#00ff66',
  
  showMap: true,
  mapPosition: 'bottom-right',
  mapWidth: 22,
  mapHeight: 28,
  mapOpacity: 0.85,
  mapBgColor: 'rgba(0,0,0,0.4)',
  mapTrackColor: '#00e5ff',
  mapTrackWidth: 3,
  mapCurrentColor: '#ffffff',
  
  showPower: true,
  showSpeed: true,
  showHr: true,
  showCadence: true,
  showDistance: true,
  showDplus: true,
  showPente: false,
  showTime: true,
  
  primaryColor: '#ffffff',
  secondaryColor: '#aaaaaa',
  accentColor: '#00e5ff',
  textColor: '#ffffff',
  gaugeBgColor: 'rgba(255,255,255,0.15)',
  gaugeFillColor: '#00e5ff',
  
  powerPosition: 'center',
  metricsLayout: 'horizontal',
  
  fontFamily: "'Inter', sans-serif",
  fontSizePower: 120,
  fontSizeMetrics: 32
};

export interface ISkin {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly category: 'cinematic' | 'glass' | 'neon' | 'minimal' | 'dashboard';
  
  config: SkinConfig;
  
  // Draw one frame
  draw(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    point: FitPoint,
    allPoints: FitPoint[],
    currentIndex: number,
    bounds: MapBounds | null,
    meta: {
      maxPower: number;
      maxSpeed: number;
      maxHr: number;
      avgPower: number;
      elapsed: number;
    }
  ): void;
  
  // Return customizable fields for UI
  getCustomizableFields(): CustomizableField[];
}

export interface CustomizableField {
  key: keyof SkinConfig;
  label: string;
  type: 'color' | 'boolean' | 'select' | 'number' | 'range';
  options?: { value: string; label: string }[];
  min?: number;
  max?: number;
  step?: number;
}
