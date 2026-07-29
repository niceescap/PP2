// ═══════════════════════════════════════════════════════════════
// PP2 Render Server — server-side MP4 generation
// Uses node-canvas + ffmpeg for fast, timeline-exact overlay export
// ═══════════════════════════════════════════════════════════════

import express from 'express';
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { createCanvas } from 'canvas';
import { parseFIT } from '../src/fit/index.js';
import { createDefaultConfig, drawOverlay, resampleTo1Hz } from '../src/blocks.js';

const upload = multer({ dest: '/tmp/pp2-uploads/' });
const app = express();
const PORT = 3000;

// CORS for browser client
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }
  next();
});

app.use(express.json({ limit: '50mb' }));

app.post('/export', upload.single('fit'), async (req, res) => {
  try {
    const filePath = req.file?.path;
    if (!filePath) {
      res.status(400).json({ error: 'No FIT file uploaded' });
      return;
    }

    console.log('[PP2 Server] Received:', req.file?.originalname);

    // 1. Read and parse FIT
    const raw = fs.readFileSync(filePath);
    const buffer = raw.buffer.slice(raw.byteOffset, raw.byteOffset + raw.byteLength) as ArrayBuffer;
    const activity = parseFIT(buffer);

    // 2. Read range + resolution + bg mode
    const range = JSON.parse(req.body.range || '{"start":0,"end":0}');
    const resolution = JSON.parse(req.body.resolution || '[1920,1080]');
    const bgMode: 'green' | 'black' | 'transparent' = (req.body.bgMode as any) || 'green';

    const startIdx = Math.max(0, Math.round(range.start || 0));
    const endIdx = Math.min(activity.points.length - 1, Math.round(range.end || (activity.points.length - 1)));

    // 3. Resample to 1 Hz (exact timeline)
    const points = resampleTo1Hz(activity.points.slice(startIdx, endIdx + 1));
    const durationSec = points.length;

    console.log(`[PP2 Server] Points: ${points.length}, Duration: ${durationSec}s, Res: ${resolution[0]}x${resolution[1]}`);

    // 4. Setup overlay config
    const overlayConfig = createDefaultConfig(resolution[0], resolution[1]);
    overlayConfig.bgMode = bgMode;
    overlayConfig.bgColor = bgMode === 'green' ? '#00ff66' : bgMode === 'black' ? '#000000' : '#00ff66';

    // 5. Generate PNG frames in /tmp
    const framesDir = `/tmp/pp2-frames-${Date.now()}`;
    fs.mkdirSync(framesDir, { recursive: true });

    const canvas = createCanvas(resolution[0], resolution[1]);
    const ctx = canvas.getContext('2d');

    for (let i = 0; i < points.length; i++) {
      const point = points[i];
      const absIdx = activity.points.indexOf(point);
      drawOverlay(ctx, overlayConfig, point, activity.points, absIdx >= 0 ? absIdx : i, activity.bounds);
      const pngPath = path.join(framesDir, `frame_${String(i).padStart(4, '0')}.png`);
      fs.writeFileSync(pngPath, canvas.toBuffer('png'));
      if (i % 50 === 0 || i === points.length - 1) {
        console.log(`[PP2 Server] Frame ${i}/${points.length}`);
      }
    }

    // 6. Assemble MP4 with ffmpeg (1 fps = exact duration)
    const outputPath = `/tmp/pp2-output-${Date.now()}.mp4`;
    const ffmpegCmd = `ffmpeg -y -hide_banner -loglevel error -framerate 1 -i ${framesDir}/frame_%04d.png -c:v libx264 -r 1 -pix_fmt yuv420p -crf 18 -movflags +faststart -preset fast ${outputPath}`;
    console.log('[PP2 Server] Running ffmpeg...');
    execSync(ffmpegCmd, { stdio: 'pipe' });
    console.log('[PP2 Server] MP4 done:', outputPath);

    // 7. Send file and cleanup
    const stats = fs.statSync(outputPath);
    res.setHeader('Content-Type', 'video/mp4');
    res.setHeader('Content-Disposition', `attachment; filename="paceparser2_overlay.mp4"`);
    res.setHeader('Content-Length', stats.size);
    res.sendFile(outputPath, () => {
      // Cleanup async
      setTimeout(() => {
        try { fs.rmSync(framesDir, { recursive: true, force: true }); } catch {}
        try { fs.unlinkSync(outputPath); } catch {}
        try { fs.unlinkSync(filePath); } catch {}
      }, 5000);
    });

  } catch (e: any) {
    console.error('[PP2 Server] Error:', e);
    res.status(500).json({ error: e.message || 'Unknown server error' });
  }
});

app.listen(PORT, () => {
  console.log(`[PP2] Render server ready: http://localhost:${PORT}`);
  console.log(`[PP2] Endpoint: POST /export`);
});
