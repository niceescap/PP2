// ═══════════════════════════════════════════════════════════════
// Skin Registry — all available skins
// ═══════════════════════════════════════════════════════════════

import { ISkin, SkinConfig } from './types.js';
import { CinematicDark } from './cinematic-dark.js';
import { Glassmorphism } from './glassmorphism.js';
import { NeonRacing } from './neon-racing.js';
import { AppleMinimal } from './apple-minimal.js';
import { DataDashboard } from './data-dashboard.js';

export type SkinClass = new (config?: Partial<SkinConfig>) => ISkin;

export interface SkinDefinition {
  id: string;
  name: string;
  description: string;
  category: string;
  class: SkinClass;
  thumbnail: string;
}

export const SKIN_REGISTRY: SkinDefinition[] = [
  {
    id: 'cinematic-dark',
    name: 'Cinematic Dark',
    description: 'Sombre, élégant, look signature',
    category: 'Cinématique',
    class: CinematicDark,
    thumbnail: 'linear-gradient(135deg, #0a0a0a 0%, #1a1a2e 50%, #00e5ff 100%)'
  },
  {
    id: 'glassmorphism',
    name: 'Glass',
    description: 'Translucide, flottant, iOS-style',
    category: 'Moderne',
    class: Glassmorphism,
    thumbnail: 'linear-gradient(135deg, rgba(255,255,255,0.1) 0%, rgba(0,229,255,0.3) 100%)'
  },
  {
    id: 'neon-racing',
    name: 'Neon Racing',
    description: 'Cyberpunk, néon, gaming',
    category: 'Énergique',
    class: NeonRacing,
    thumbnail: 'linear-gradient(135deg, #0f0f0f 0%, #ff006e 50%, #00ff88 100%)'
  },
  {
    id: 'apple-minimal',
    name: 'Minimal',
    description: 'Épuré, clair, premium',
    category: 'Épuré',
    class: AppleMinimal,
    thumbnail: 'linear-gradient(135deg, #f5f5f7 0%, #e0e0e5 50%, #ffffff 100%)'
  },
  {
    id: 'data-dashboard',
    name: 'Dashboard',
    description: 'Dense, pro, données complètes',
    category: 'Professionnel',
    class: DataDashboard,
    thumbnail: 'linear-gradient(135deg, #0d1117 0%, #161b22 50%, #58a6ff 100%)'
  }
];

export function createSkin(id: string): ISkin {
  const def = SKIN_REGISTRY.find(s => s.id === id);
  const SkinClass = def?.class || CinematicDark;
  return new SkinClass();
}

export function getSkinDefinition(id: string): SkinDefinition | undefined {
  return SKIN_REGISTRY.find(s => s.id === id);
}
