// ═══════════════════════════════════════════════════════════════
// Preset tests — the skin visual identities carried over
// ═══════════════════════════════════════════════════════════════

import { describe, it, assert, assertEqual } from './harness.js';
import { PRESET_REGISTRY, applyPresetById, getPreset } from '../src/presets.js';
import { createDefaultConfig } from '../src/blocks.js';

describe('presets', () => {
  it('exposes the six themes', () => {
    assertEqual(PRESET_REGISTRY.length, 6);
    for (const id of ['default', 'cinematic', 'glass', 'neon', 'minimal', 'dashboard']) {
      assert(getPreset(id) !== undefined, `missing preset ${id}`);
    }
  });

  it('applies a theme to every block', () => {
    const config = createDefaultConfig(1920, 1080);
    const themed = applyPresetById(config, 'neon');
    assertEqual(themed.blocks.length, config.blocks.length);
    for (const block of themed.blocks) {
      assert(block.style.accentColor.length > 0, `${block.id} has no accent color`);
    }
  });

  it('gives the neon theme its signature green accent', () => {
    const themed = applyPresetById(createDefaultConfig(1920, 1080), 'neon');
    const power = themed.blocks.find(b => b.id === 'power')!;
    assertEqual(power.style.accentColor, '#00ff88');
  });

  it('gives the minimal theme a light block background', () => {
    const themed = applyPresetById(createDefaultConfig(1920, 1080), 'minimal');
    const power = themed.blocks.find(b => b.id === 'power')!;
    assertEqual(power.style.bgColor, 'rgba(255,255,255,0.72)');
    assertEqual(power.style.textColor, '#1d1d1f');
  });

  it('keeps the block layout inside the canvas', () => {
    for (const preset of PRESET_REGISTRY) {
      const themed = preset.apply(createDefaultConfig(1920, 1080));
      for (const block of themed.blocks) {
        assert(
          block.x + block.w <= 1920 && block.y + block.h <= 1080,
          `${preset.id}/${block.id} overflows the canvas`
        );
      }
    }
  });

  it('returns the config unchanged for an unknown preset', () => {
    const config = createDefaultConfig(1920, 1080);
    assert(applyPresetById(config, 'nope') === config);
  });

  it('applies the font family of the theme', () => {
    const themed = applyPresetById(createDefaultConfig(1920, 1080), 'dashboard');
    const power = themed.blocks.find(b => b.id === 'power')!;
    assert(power.style.valueFontFamily.includes('JetBrains Mono'), 'expected the mono font');
  });
});
