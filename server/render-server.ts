// ═══════════════════════════════════════════════════════════════
// PP2 Render Server — server-side MP4 generation
// Uses node-canvas + ffmpeg for fast, timeline-exact overlay export
// ═══════════════════════════════════════════════════════════════

import express from 'express';
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import { createCanvas } from 'canvas';
import { parseFIT } from '../src/fit/index.js';
import { createDefaultConfig, drawOverlay } from '../src/blocks.js';
import { resampleTo1Hz } from '../src/timeline.js';

export interface ServerOptions {
  /** Directory receiving the uploaded FIT files. */
  uploadDir?: string;
  /** Maximum accepted upload size, in bytes. */
  maxUploadBytes?: number;
  /** Maximum length of the exported range, in seconds. */
  maxRangeSeconds?: number;
  /** Origin allowed by CORS. Empty means "localhost only". */
  allowedOrigin?: string;
}

const DEFAULTS = {
  uploadDir: '/tmp/pp2-uploads',
  maxUploadBytes: 32 * 1024 * 1024, // 32 MB — a FIT file is a few MB max
  maxRangeSeconds: 4 * 60 * 60,    // 4 h of video per render
};

/** Error raised for an invalid client request: reported as HTTP 400. */
class BadRequestError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BadRequestError';
  }
}

/** Remove a file or directory, ignoring any failure. */
function safeRemove(target?: string): void {
  if (!target) return;
  try {
    fs.rmSync(target, { recursive: true, force: true });
  } catch {
    /* best effort */
  }
}

// CORS for browser client.
// The server writes files to disk and shells out to ffmpeg: it must not be
// reachable from any origin by default. Set ALLOWED_ORIGIN to open it up.
/**
 * Build the Express application.
 * Exported so the test suite can drive it without binding a port.
 */
export function createApp(options: ServerOptions = {}): express.Express {
const uploadDir = options.uploadDir ?? DEFAULTS.uploadDir;
const maxUploadBytes = options.maxUploadBytes ?? DEFAULTS.maxUploadBytes;
const maxRangeSeconds = options.maxRangeSeconds ?? DEFAULTS.maxRangeSeconds;
const allowedOrigin = options.allowedOrigin ?? process.env.ALLOWED_ORIGIN ?? '';

fs.mkdirSync(uploadDir, { recursive: true });

const upload = multer({
  dest: uploadDir,
  limits: { fileSize: maxUploadBytes, files: 1 },
});

const app = express();

app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (allowedOrigin) {
    res.header('Access-Control-Allow-Origin', allowedOrigin);
  } else if (origin && /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) {
    res.header('Access-Control-Allow-Origin', origin);
  }
  res.header('Vary', 'Origin');
  res.header('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }
  next();
});

app.use(express.json({ limit: '1mb' }));

app.post('/export', upload.single('fit'), async (req, res) => {
  const filePath = req.file?.path;
  let framesDir: string | undefined;
  let outputPath: string | undefined;

  // Any exit path (success, error, crash) must clean the temp files.
  const cleanup = () => {
    safeRemove(framesDir);
    safeRemove(outputPath);
    safeRemove(filePath);
  };

  try {
    if (!filePath) {
      res.status(400).json({ error: 'No FIT file uploaded' });
      return;
    }

    console.log('[PP2 Server] Received:', req.file?.originalname);

    // 1. Read and parse FIT (the parser validates the FIT header)
    const raw = fs.readFileSync(filePath);
    const buffer = raw.buffer.slice(raw.byteOffset, raw.byteOffset + raw.byteLength) as ArrayBuffer;
    let activity;
    try {
      activity = parseFIT(buffer);
    } catch (err: any) {
      // A malformed upload is a client error, not a server failure.
      throw new BadRequestError(err?.message || 'Invalid FIT file');
    }

    if (activity.points.length === 0) {
      throw new BadRequestError('No data points in FIT file');
    }

    // 2. Read range + resolution + bg mode
    let range: any;
    let resolution: any;
    try {
      range = JSON.parse(req.body.range || '{"start":0,"end":0}');
      resolution = JSON.parse(req.body.resolution || '[1920,1080]');
    } catch {
      throw new BadRequestError('Invalid range or resolution JSON');
    }
    const bgMode: 'green' | 'black' | 'transparent' = (req.body.bgMode as any) || 'green';

    if (!Array.isArray(resolution) || resolution.length !== 2) {
      throw new BadRequestError('Invalid resolution');
    }
    const width = Math.max(16, Math.min(3840, Math.round(resolution[0])));
    const height = Math.max(16, Math.min(3840, Math.round(resolution[1])));

    const startIdx = Math.max(0, Math.round(range.start || 0));
    const endIdx = Math.min(activity.points.length - 1, Math.round(range.end || (activity.points.length - 1)));

    // 3. Resample to 1 Hz (exact timeline)
    const points = resampleTo1Hz(activity.points.slice(startIdx, endIdx + 1));
    const durationSec = points.length;

    if (durationSec > maxRangeSeconds) {
      throw new BadRequestError(`Range too long (${durationSec}s > ${maxRangeSeconds}s)`);
    }

    console.log(`[PP2 Server] Points: ${points.length}, Duration: ${durationSec}s, Res: ${width}x${height}`);

    // 4. Setup overlay config
    const overlayConfig = createDefaultConfig(width, height);
    overlayConfig.bgMode = bgMode;
    overlayConfig.bgColor = bgMode === 'black' ? '#000000' : '#00ff66';

    // 5. Generate PNG frames in /tmp
    framesDir = `/tmp/pp2-frames-${Date.now()}`;
    fs.mkdirSync(framesDir, { recursive: true });

    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d');

    for (let i = 0; i < points.length; i++) {
      const point = points[i];
      const absIdx = activity.points.indexOf(point);
      drawOverlay(ctx, overlayConfig, point, activity.points, absIdx >= 0 ? absIdx : i, activity.bounds);
      const pngPath = path.join(framesDir, `frame_${String(i).padStart(4, '0')}.png`);
      fs.writeFileSync(pngPath, canvas.toBuffer('image/png'));
      if (i % 50 === 0 || i === points.length - 1) {
        console.log(`[PP2 Server] Frame ${i}/${points.length}`);
      }
    }

    // 6. Assemble MP4 with ffmpeg (1 fps = exact duration).
    //    spawn() with an argument array: no shell, so no interpolation risk.
    outputPath = `/tmp/pp2-output-${Date.now()}.mp4`;
    console.log('[PP2 Server] Running ffmpeg...');
    await runFfmpeg([
      '-y', '-hide_banner', '-loglevel', 'error',
      '-framerate', '1',
      '-i', path.join(framesDir, 'frame_%04d.png'),
      '-c:v', 'libx264', '-r', '1', '-pix_fmt', 'yuv420p',
      '-crf', '18', '-movflags', '+faststart', '-preset', 'fast',
      outputPath,
    ]);
    console.log('[PP2 Server] MP4 done:', outputPath);

    // 7. Send file, then clean up once the transfer is done
    const stats = fs.statSync(outputPath);
    res.setHeader('Content-Type', 'video/mp4');
    res.setHeader('Content-Disposition', `attachment; filename="paceparser2_overlay.mp4"`);
    res.setHeader('Content-Length', stats.size);
    res.sendFile(outputPath, () => cleanup());

  } catch (e: any) {
    cleanup();
    if (res.headersSent) return;

    if (e instanceof BadRequestError) {
      res.status(400).json({ error: e.message });
      return;
    }
    console.error('[PP2 Server] Error:', e);
    res.status(500).json({ error: e?.message || 'Unknown server error' });
  }
});

/** Run ffmpeg without a shell, rejecting on a non-zero exit code. */
function runFfmpeg(args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn('ffmpeg', args, { stdio: ['ignore', 'ignore', 'pipe'] });
    let stderr = '';
    child.stderr.on('data', chunk => { stderr += String(chunk); });
    child.on('error', err => reject(new Error(`ffmpeg not available: ${err.message}`)));
    child.on('close', code => {
      if (code === 0) resolve();
      else reject(new Error(`ffmpeg failed (exit ${code}): ${stderr.trim().slice(0, 500)}`));
    });
  });
}

// Errors raised by the upload middleware never reach the route handler:
// map them to explicit status codes instead of Express' default 500.
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  if (err && err.code === 'LIMIT_FILE_SIZE') {
    res.status(413).json({ error: `File too large (max ${maxUploadBytes} bytes)` });
    return;
  }
  if (err && err.code === 'LIMIT_UNEXPECTED_FILE') {
    res.status(400).json({ error: 'Unexpected file field, expected "fit"' });
    return;
  }
  if (err && err.code === 'LIMIT_FILE_COUNT') {
    res.status(400).json({ error: 'Only one file accepted' });
    return;
  }
  console.error('[PP2 Server] Unhandled error:', err);
  if (!res.headersSent) {
    res.status(500).json({ error: err?.message || 'Unknown server error' });
  }
});

return app;
}

/** Start the render server. */
export function startServer(port = Number(process.env.PORT) || 3000): void {
  const app = createApp();
  app.listen(port, () => {
    console.log(`[PP2] Render server ready: http://localhost:${port}`);
    console.log(`[PP2] Endpoint: POST /export`);
  });
}

// Only start listening when the file is executed directly, so the test
// suite can import `createApp` without binding a port.
const isDirectRun = !!process.argv[1] &&
  /render-server(\.ts|\.js)?$/.test(process.argv[1].split('\\').join('/'));

if (isDirectRun) {
  startServer();
}
