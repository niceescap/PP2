// ═══════════════════════════════════════════════════════════════
// Test entry point
// ═══════════════════════════════════════════════════════════════

import { run } from './harness.js';

import './fit-parser.test.js';
import './timeline.test.js';
import './blocks.test.js';
import './presets.test.js';
import './gpx.test.js';

await run();
