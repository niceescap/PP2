// ═══════════════════════════════════════════════════════════════
// Overlay Presets — reusable block themes
//
// These presets carry over the visual identity of the former
// "skins" system: each one is a complete styling of the default
// block layout (colors, fonts, sizes, backgrounds).
//
// A preset is a pure function of the base layout, so the user can
// switch preset at any time and keep every custom position.
// ═══════════════════════════════════════════════════════════════

import { Block, BlockStyle, OverlayConfig, createDefaultConfig } from './blocks.js';

export interface PresetDefinition {
  id: string;
  name: string;
  description: string;
  thumbnail: string;
  apply: (config: OverlayConfig) => OverlayConfig;
}

interface PresetPalette {
  bgMode: OverlayConfig['bgMode'];
  bgColor: string;
  textColor: string;
  labelColor: string;
  blockBg: string;
  powerAccent: string;
  speedAccent: string;
  hrAccent: string;
  cadAccent: string;
  distanceAccent: string;
  dplusAccent: string;
  timeAccent: string;
  mapAccent: string;
  fontFamily: string;
  valueFontFamily: string;
  powerFontSize: number;
  valueFontSize: number;
  labelSize: number;
  borderRadius: number;
}

const PALETTES: Record<string, PresetPalette> = {
  default: {
    bgMode: 'green',
    bgColor: '#00ff66',
    textColor: '#ffffff',
    labelColor: '#00e5ff',
    blockBg: 'rgba(0,0,0,0.7)',
    powerAccent: '#ffd600',
    speedAccent: '#00e5ff',
    hrAccent: '#ff4444',
    cadAccent: '#00ff88',
    distanceAccent: '#ff8800',
    dplusAccent: '#cc66ff',
    timeAccent: '#ffffff',
    mapAccent: '#00e5ff',
    fontFamily: "'Inter', sans-serif",
    valueFontFamily: "'JetBrains Mono', monospace",
    powerFontSize: 64,
    valueFontSize: 56,
    labelSize: 12,
    borderRadius: 6,
  },
  cinematic: {
    bgMode: 'green',
    bgColor: '#00ff66',
    textColor: '#ffffff',
    labelColor: '#00e5ff',
    blockBg: 'rgba(10,10,10,0.78)',
    powerAccent: '#00e5ff',
    speedAccent: '#8b949e',
    hrAccent: '#ff6b6b',
    cadAccent: '#00e5ff',
    distanceAccent: '#f0d000',
    dplusAccent: '#00e5ff',
    timeAccent: '#ffffff',
    mapAccent: '#00e5ff',
    fontFamily: "'Inter', sans-serif",
    valueFontFamily: "'Inter', sans-serif",
    powerFontSize: 120,
    valueFontSize: 44,
    labelSize: 11,
    borderRadius: 2,
  },
  glass: {
    bgMode: 'green',
    bgColor: '#00ff66',
    textColor: '#ffffff',
    labelColor: '#00e5ff',
    blockBg: 'rgba(255,255,255,0.12)',
    powerAccent: '#00e5ff',
    speedAccent: '#ffffff',
    hrAccent: '#ff5f8f',
    cadAccent: '#00ff88',
    distanceAccent: '#ffd166',
    dplusAccent: '#c792ea',
    timeAccent: '#ffffff',
    mapAccent: '#00e5ff',
    fontFamily: "'Inter', sans-serif",
    valueFontFamily: "'Inter', sans-serif",
    powerFontSize: 100,
    valueFontSize: 44,
    labelSize: 11,
    borderRadius: 16,
  },
  neon: {
    bgMode: 'green',
    bgColor: '#00ff66',
    textColor: '#00ff88',
    labelColor: '#ff006e',
    blockBg: 'rgba(15,15,15,0.72)',
    powerAccent: '#00ff88',
    speedAccent: '#ff006e',
    hrAccent: '#ff006e',
    cadAccent: '#00ff88',
    distanceAccent: '#ff006e',
    dplusAccent: '#00ff88',
    timeAccent: '#00ff88',
    mapAccent: '#00ff88',
    fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
    valueFontFamily: "'JetBrains Mono', 'Fira Code', monospace",
    powerFontSize: 140,
    valueFontSize: 40,
    labelSize: 10,
    borderRadius: 0,
  },
  minimal: {
    bgMode: 'green',
    bgColor: '#00ff66',
    textColor: '#1d1d1f',
    labelColor: '#0071e3',
    blockBg: 'rgba(255,255,255,0.72)',
    powerAccent: '#0071e3',
    speedAccent: '#1d1d1f',
    hrAccent: '#ff375f',
    cadAccent: '#34c759',
    distanceAccent: '#1d1d1f',
    dplusAccent: '#0071e3',
    timeAccent: '#1d1d1f',
    mapAccent: '#0071e3',
    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
    valueFontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
    powerFontSize: 110,
    valueFontSize: 44,
    labelSize: 11,
    borderRadius: 14,
  },
  dashboard: {
    bgMode: 'green',
    bgColor: '#00ff66',
    textColor: '#e6edf3',
    labelColor: '#58a6ff',
    blockBg: 'rgba(13,17,23,0.85)',
    powerAccent: '#58a6ff',
    speedAccent: '#e6edf3',
    hrAccent: '#f85149',
    cadAccent: '#3fb950',
    distanceAccent: '#d29922',
    dplusAccent: '#a371f7',
    timeAccent: '#e6edf3',
    mapAccent: '#58a6ff',
    fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
    valueFontFamily: "'JetBrains Mono', 'Fira Code', monospace",
    powerFontSize: 80,
    valueFontSize: 30,
    labelSize: 9,
    borderRadius: 3,
  },
};

type AccentKey =
  | 'powerAccent' | 'speedAccent' | 'hrAccent' | 'cadAccent'
  | 'distanceAccent' | 'dplusAccent' | 'timeAccent' | 'mapAccent';

const ACCENTS: Record<string, AccentKey> = {
  power: 'powerAccent',
  speed: 'speedAccent',
  hr: 'hrAccent',
  cadence: 'cadAccent',
  distance: 'distanceAccent',
  dplus: 'dplusAccent',
  time: 'timeAccent',
  map: 'mapAccent',
};

function styleBlock(block: Block, palette: PresetPalette): Block {
  const accentKey = ACCENTS[block.type];
  const accent = accentKey ? palette[accentKey] : palette.labelColor;
  const isPower = block.type === 'power';

  const style: BlockStyle = {
    ...block.style,
    bgColor: palette.blockBg,
    textColor: palette.textColor,
    accentColor: accent,
    labelSize: palette.labelSize,
    borderRadius: palette.borderRadius,
    fontFamily: palette.fontFamily,
    valueFontFamily: palette.valueFontFamily,
    fontSize: isPower ? palette.powerFontSize : palette.valueFontSize,
  };

  return { ...block, style };
}

/**
 * Apply a preset to a config, preserving block layout.
 * The base layout (positions/sizes) is always the default one so a
 * preset switch yields a predictable, reproducible result.
 */
function applyPreset(config: OverlayConfig, palette: PresetPalette): OverlayConfig {
  const base = createDefaultConfig(config.width, config.height);
  return {
    ...config,
    bgMode: palette.bgMode,
    bgColor: palette.bgColor,
    blocks: base.blocks.map(block => styleBlock(block, palette)),
  };
}

export const PRESET_REGISTRY: PresetDefinition[] = [
  {
    id: 'default',
    name: 'Standard',
    description: 'Blocs lisibles, fond vert chroma',
    thumbnail: 'linear-gradient(135deg, #00ff66 0%, #001a0f 100%)',
    apply: config => applyPreset(config, PALETTES.default),
  },
  {
    id: 'cinematic',
    name: 'Cinématique',
    description: 'Sombre, typographie fine, look signature',
    thumbnail: 'linear-gradient(135deg, #0a0a0a 0%, #1a1a2e 50%, #00e5ff 100%)',
    apply: config => applyPreset(config, PALETTES.cinematic),
  },
  {
    id: 'glass',
    name: 'Glass',
    description: 'Translucide, flottant, iOS-style',
    thumbnail: 'linear-gradient(135deg, rgba(255,255,255,0.15) 0%, rgba(0,229,255,0.35) 100%)',
    apply: config => applyPreset(config, PALETTES.glass),
  },
  {
    id: 'neon',
    name: 'Neon',
    description: 'Cyberpunk, néon, gaming',
    thumbnail: 'linear-gradient(135deg, #0f0f0f 0%, #ff006e 50%, #00ff88 100%)',
    apply: config => applyPreset(config, PALETTES.neon),
  },
  {
    id: 'minimal',
    name: 'Minimal',
    description: 'Épuré, clair, premium',
    thumbnail: 'linear-gradient(135deg, #f5f5f7 0%, #e0e0e5 50%, #ffffff 100%)',
    apply: config => applyPreset(config, PALETTES.minimal),
  },
  {
    id: 'dashboard',
    name: 'Dashboard',
    description: 'Dense, pro, données complètes',
    thumbnail: 'linear-gradient(135deg, #0d1117 0%, #161b22 50%, #58a6ff 100%)',
    apply: config => applyPreset(config, PALETTES.dashboard),
  },
];

export function getPreset(id: string): PresetDefinition | undefined {
  return PRESET_REGISTRY.find(p => p.id === id);
}

export function applyPresetById(config: OverlayConfig, id: string): OverlayConfig {
  const preset = getPreset(id);
  return preset ? preset.apply(config) : config;
}
