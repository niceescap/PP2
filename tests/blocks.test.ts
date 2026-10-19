// ═══════════════════════════════════════════════════════════════
// Overlay blocks tests — layout, scaling and rendering
// ═══════════════════════════════════════════════════════════════

import { describe, it, assert, assertEqual } from './harness.js';
import {
  createDefaultConfig,
  createConfigForResolution,
  scaleBlocksToResolution,
  drawOverlay,
} from '../src/blocks.js';
import { FitPoint } from '../src/fit/types.js';

function point(overrides: Partial<FitPoint> = {}): FitPoint {
  return {
    timestamp: 0, elapsed: 0, lat: 45, lon: 6, alt: 200,
    hr: 140, cad: 90, speed: 30, power: 250, distance: 1500,
    dplus: 120, pente: 5, temp: 20,
    ...overrides,
  };
}

/** Minimal Canvas2D context recorder. */
function fakeContext() {
  const calls: string[] = [];
  const ctx = {
    calls,
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 0,
    lineCap: '',
    font: '',
    textAlign: '',
    textBaseline: '',
    globalAlpha: 1,
    save() { calls.push('save'); },
    restore() { calls.push('restore'); },
    beginPath() { calls.push('beginPath'); },
    closePath() { calls.push('closePath'); },
    moveTo() {},
    lineTo() {},
    arc() {},
    rect() { calls.push('rect'); },
    roundRect() { calls.push('roundRect'); },
    fill() { calls.push('fill'); },
    stroke() { calls.push('stroke'); },
    fillRect() { calls.push('fillRect'); },
    clearRect() { calls.push('clearRect'); },
    clip() { calls.push('clip'); },
    fillText(text: string) { calls.push(`text:${text}`); },
    measureText(t: string) { return { width: t.length * 10 }; },
  };
  return ctx as unknown as CanvasRenderingContext2D & { calls: string[] };
}

describe('blocks — default config', () => {
  it('creates the eight standard blocks', () => {
    const config = createDefaultConfig(1920, 1080);
    assertEqual(config.blocks.length, 8);
    assertEqual(config.width, 1920);
    assertEqual(config.height, 1080);
  });

  it('keeps every block inside the canvas', () => {
    const config = createDefaultConfig(1920, 1080);
    for (const block of config.blocks) {
      assert(block.x >= 0 && block.y >= 0, `${block.id} origin is negative`);
      assert(
        block.x + block.w <= 1920 && block.y + block.h <= 1080,
        `${block.id} overflows the canvas`
      );
    }
  });
});

describe('blocks — resolution scaling', () => {
  it('scales positions and sizes proportionally', () => {
    const config = createDefaultConfig(1920, 1080);
    const scaled = scaleBlocksToResolution(config.blocks, 1920, 1080, 1280, 720);
    const power = scaled.find(b => b.id === 'power')!;
    assertEqual(power.x, Math.round(24 * (1280 / 1920)));
    assertEqual(power.w, Math.round(200 * (1280 / 1920)));
  });

  it('scales to a vertical format without overflowing', () => {
    const config = createDefaultConfig(1920, 1080);
    const scaled = createConfigForResolution(config, 1080, 1920);
    for (const block of scaled.blocks) {
      assert(
        block.x + block.w <= 1080 && block.y + block.h <= 1920,
        `${block.id} overflows the vertical frame`
      );
    }
  });

  it('scales font sizes so the text stays proportional', () => {
    const config = createDefaultConfig(1920, 1080);
    const scaled = createConfigForResolution(config, 1280, 720);
    const power = scaled.blocks.find(b => b.id === 'power')!;
    assertEqual(power.style.fontSize, Math.round(64 * (1280 / 1920)));
  });

  it('returns the same config when the resolution does not change', () => {
    const config = createDefaultConfig(1920, 1080);
    assert(createConfigForResolution(config, 1920, 1080) === config);
  });
});

describe('blocks — rendering', () => {
  it('draws the background then the blocks', () => {
    const ctx = fakeContext();
    const config = createDefaultConfig(1920, 1080);
    drawOverlay(ctx, config, point(), [point()], 0, null);
    assert(ctx.calls.includes('fillRect'), 'expected a background fill');
    assert(ctx.calls.some(c => c.startsWith('text:')), 'expected some text');
  });

  it('renders the block value', () => {
    const ctx = fakeContext();
    const config = createDefaultConfig(1920, 1080);
    drawOverlay(ctx, config, point({ power: 250 }), [point()], 0, null);
    assert(ctx.calls.includes('text:250'), 'expected the power value to be drawn');
  });

  it('clears the canvas in transparent mode', () => {
    const ctx = fakeContext();
    const config = createDefaultConfig(1920, 1080);
    config.bgMode = 'transparent';
    drawOverlay(ctx, config, point(), [point()], 0, null);
    assert(ctx.calls.includes('clearRect'), 'expected a clearRect');
  });

  it('skips invisible blocks', () => {
    const ctx = fakeContext();
    const config = createDefaultConfig(1920, 1080);
    for (const block of config.blocks) block.visible = false;
    drawOverlay(ctx, config, point(), [point()], 0, null);
    assert(!ctx.calls.some(c => c.startsWith('text:')), 'expected no text');
  });
});
